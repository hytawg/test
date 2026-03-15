#!/usr/bin/env python3
"""
auto_zoom.py — Apply FocusEngine virtual-camera log to a screen recording.

Two-stage pipeline:
    ┌──────────┐  BGR24 frames   ┌──────────────────────────────┐  BGR24 frames  ┌──────────┐
    │ FFmpeg   │ ──────────────▶ │  Python per-frame:           │ ─────────────▶ │ FFmpeg   │
    │ decoder  │   via pipe      │  1. Remove original cursor   │   via pipe     │ encoder  │
    └──────────┘                 │  2. crop + scale (zoom)      │                └──────────┘
                                 │  3. Composite hi-res cursor  │
                                 └──────────────────────────────┘
                                      audio copied unchanged → muxed into output

Usage:
    python auto_zoom.py recording.mp4 focus-log.ndjson [output.mp4] [OPTIONS]

Options:
    --crf INT            H.264 quality  0=lossless  18=near-lossless  23=default (default 18)
    --preset NAME        x264 preset: ultrafast / fast / medium / slow / veryslow
    --hw videotoolbox    macOS VideoToolbox hardware encoder
    --hw nvenc           NVIDIA NVENC hardware encoder
    --offset FLOAT       Shift log by ±N seconds to fix sync  (default 0)
    --display-scale F    Retina / HiDPI scale factor applied to log mouse coords (default: auto)
    --cursor-size INT    Replacement cursor height in px at zoom=1  (default 28)
    --no-cursor          Skip cursor replacement entirely

Requirements:
    pip install ffmpeg-python numpy opencv-python-headless scipy tqdm
    brew install ffmpeg
"""

from __future__ import annotations

import argparse
import json
import math
import os
import subprocess
import sys
import tempfile
from pathlib import Path
from typing import NamedTuple

# ── Dependency guard ──────────────────────────────────────────────────────────

_missing: list[str] = []
for pkg, name in [
    ("cv2",   "opencv-python-headless"),
    ("numpy", "numpy"),
    ("ffmpeg","ffmpeg-python"),
    ("scipy", "scipy"),
    ("tqdm",  "tqdm"),
]:
    try:
        __import__(pkg)
    except ImportError:
        _missing.append(name)

if _missing:
    sys.exit(
        "Missing packages. Install with:\n"
        f"  pip install {' '.join(_missing)}\n\n"
        "Also install FFmpeg:\n"
        "  macOS:  brew install ffmpeg\n"
        "  Linux:  sudo apt install ffmpeg"
    )

import cv2
import numpy as np
import ffmpeg
from scipy.interpolate import PchipInterpolator
from tqdm import tqdm

# ── Data types ────────────────────────────────────────────────────────────────

class VideoInfo(NamedTuple):
    width:     int
    height:    int
    fps:       float
    n_frames:  int
    duration:  float
    codec:     str
    has_audio: bool


class CropBox(NamedTuple):
    x: int
    y: int
    w: int
    h: int


# ─────────────────────────────────────────────────────────────────────────────
#  SECTION 1 — Log loading & PCHIP spline interpolation
# ─────────────────────────────────────────────────────────────────────────────

def load_log(path: str) -> list[dict]:
    records: list[dict] = []
    with open(path, encoding="utf-8") as fh:
        for lineno, raw in enumerate(fh, 1):
            raw = raw.strip()
            if not raw:
                continue
            try:
                records.append(json.loads(raw))
            except json.JSONDecodeError as exc:
                print(f"  ⚠ line {lineno}: {exc}", file=sys.stderr)
    if not records:
        raise ValueError(f"No valid JSON records in {path}")
    records.sort(key=lambda r: r["ts"])
    return records


def build_timeline(
    records:     list[dict],
    fps:         float,
    n_frames:    int,
    offset_ms:   float = 0.0,
    display_scale: float = 1.0,
) -> list[dict]:
    """
    Pre-compute camera + mouse state for every video frame using
    PCHIP (monotone cubic Hermite) spline interpolation.

    PCHIP guarantees no overshoot between data points — the camera path
    faithfully reflects the engine's smoothed output without adding
    spurious oscillations across the 10 fps log boundaries.

    Returns list of {'x','y','zoom','mx','my'} dicts, one per frame.

    `display_scale` converts logical mouse coords in the log to video pixels.
    (Pass 2.0 for Retina; auto-detected from log's 'scaleFactor' field if present.)
    """
    ts_arr = np.array([r["ts"] for r in records], dtype=float)
    cx_arr = np.array([r["camera"]["x"]    for r in records], dtype=float)
    cy_arr = np.array([r["camera"]["y"]    for r in records], dtype=float)
    cz_arr = np.array([r["camera"]["zoom"] for r in records], dtype=float)
    mx_arr = np.array([r["mouse"]["x"]     for r in records], dtype=float) * display_scale
    my_arr = np.array([r["mouse"]["y"]     for r in records], dtype=float) * display_scale

    # PCHIP splines — smooth, monotone, no overshoot
    sp_cx = PchipInterpolator(ts_arr, cx_arr)
    sp_cy = PchipInterpolator(ts_arr, cy_arr)
    sp_cz = PchipInterpolator(ts_arr, cz_arr)
    sp_mx = PchipInterpolator(ts_arr, mx_arr)
    sp_my = PchipInterpolator(ts_arr, my_arr)

    start_ts  = records[0]["ts"] - offset_ms
    frame_ms  = 1000.0 / fps
    query_ts  = np.clip(
        np.array([start_ts + i * frame_ms for i in range(n_frames)]),
        ts_arr[0], ts_arr[-1]
    )

    cx_vals = sp_cx(query_ts)
    cy_vals = sp_cy(query_ts)
    cz_vals = np.maximum(1.0, sp_cz(query_ts))
    mx_vals = sp_mx(query_ts)
    my_vals = sp_my(query_ts)

    return [
        {
            "x":    float(cx_vals[i]),
            "y":    float(cy_vals[i]),
            "zoom": float(cz_vals[i]),
            "mx":   float(mx_vals[i]),   # video pixels (physical)
            "my":   float(my_vals[i]),
        }
        for i in range(n_frames)
    ]


# ─────────────────────────────────────────────────────────────────────────────
#  SECTION 2 — 16:9 crop computation
# ─────────────────────────────────────────────────────────────────────────────

_AR = 16 / 9


def _output_size(w: int, h: int) -> tuple[int, int]:
    """Largest 16:9 resolution that fits inside (w × h)."""
    if abs(w / h - _AR) < 0.01:
        return w, h
    if w / h > _AR:
        return int(h * _AR) & ~1, h
    return w, int(w / _AR) & ~1


def compute_crop(cam: dict, video_w: int, video_h: int) -> CropBox:
    """
    Return the pixel crop box for a given camera state.
    Crop dimensions always have the same AR as _output_size() → 16:9 output.
    """
    out_w, out_h = _output_size(video_w, video_h)
    zoom = max(1.0, cam["zoom"])

    cw = out_w / zoom
    ch = out_h / zoom

    cx = cam["x"] * video_w
    cy = cam["y"] * video_h

    x = max(0.0, min(video_w - cw, cx - cw / 2))
    y = max(0.0, min(video_h - ch, cy - ch / 2))

    xi = int(x) & ~1
    yi = int(y) & ~1
    wi = int(cw) & ~1
    hi = int(ch) & ~1

    return CropBox(x=min(xi, video_w - wi), y=min(yi, video_h - hi), w=wi, h=hi)


# ─────────────────────────────────────────────────────────────────────────────
#  SECTION 3 — Cursor renderer
#
#  Improvement 2: replace the blurry recorded cursor with a crisp overlay.
#
#  Pipeline per frame:
#    (a) remove_from_original(frame, mx, my)
#          → local inpaint at cursor hotspot in original resolution frame
#    (b) crop + scale  (done in main loop)
#    (c) draw_on_output(out_frame, mx_out, my_out, zoom)
#          → composite BGRA cursor image at zoomed output coordinates
# ─────────────────────────────────────────────────────────────────────────────

class CursorRenderer:
    """
    Manages cursor removal (inpaint) and hi-res cursor compositing.

    The cursor image is generated programmatically as a macOS-style
    arrow cursor at 4× supersampling and then downscaled — giving
    sub-pixel smooth edges without any external image files.
    """

    # Hotspot offset: tip of the macOS arrow is ~2px from top-left of bounding box
    HOTSPOT_X = 2
    HOTSPOT_Y = 2

    def __init__(self, base_size: int = 28, max_size: int = 56) -> None:
        self.base_size = base_size
        self.max_size  = max_size
        # Pre-render at max_size; resize down per-frame as needed
        self._cursor_bgra = self._make_arrow_cursor(max_size)
        # Cache last rendered size to avoid redundant resizes
        self._cache: dict[int, np.ndarray] = {}

    # ── Cursor image generation ───────────────────────────────────────────────

    @staticmethod
    def _make_arrow_cursor(display_size: int) -> np.ndarray:
        """
        Generate a crisp macOS-style arrow cursor as a BGRA ndarray.
        Rendered at 4× supersampling for smooth anti-aliased edges.

        Layout (24-unit reference space, tip at top-left):

          Outer (black border):          Inner (white fill, inset ~1.5u):
          (1,1)                          (2.5, 2.5)
          ↓ left edge                    ↓ left edge
          (1,20)                         (2.5, 17)
          → left notch                   → left notch
          (5,15)                         (6.5, 13)
          ↘ tail bottom-left             ↘ tail bottom-left
          (9,24)                         (9.5, 21)
          → tail bottom-right            → tail bottom-right
          (13,22)                        (11.5, 19.5)
          ↑ right notch                  ↑ right notch
          (8,14)                         (8.5, 12.5)
          ← rightmost                    ← rightmost
          (15,14)                        (13, 12.5)
          ↖ back to tip                  ↖ back to tip
        """
        S = 4
        h = w = display_size * S
        REF = 24.0

        def pts(coords: list[tuple[float, float]]) -> np.ndarray:
            scale = S * display_size / REF
            return np.array(
                [(int(x * scale), int(y * scale)) for x, y in coords],
                dtype=np.int32,
            )

        outer = pts([
            (1, 1), (1, 20), (5, 15), (9, 24),
            (13, 22), (8, 14), (15, 14),
        ])
        inner = pts([
            (2.5, 2.5), (2.5, 17), (6.5, 13), (9.5, 21),
            (11.5, 19.5), (8.5, 12.5), (13, 12.5),
        ])

        # ── Shadow layer ──────────────────────────────────────────────────
        shadow_img = np.zeros((h, w), dtype=np.uint8)
        shadow_offset = max(1, S * display_size // 14)   # ~2px at 28px
        shadow_pts = outer + np.array([[shadow_offset, shadow_offset * 2]])
        cv2.fillPoly(shadow_img, [shadow_pts], 200)
        # Blur the shadow
        ksize = shadow_offset * 4 + 1
        shadow_img = cv2.GaussianBlur(shadow_img, (ksize, ksize), sigma=shadow_offset)

        # ── Cursor layers ─────────────────────────────────────────────────
        bgr   = np.zeros((h, w, 3), dtype=np.uint8)
        alpha = np.zeros((h, w),    dtype=np.uint8)

        # Paint shadow into alpha (semi-transparent)
        alpha = np.maximum(alpha, (shadow_img * 0.55).astype(np.uint8))

        # Outer (black) — sets full opacity in cursor area
        cv2.fillPoly(bgr,   [outer], (0,   0,   0))
        cv2.fillPoly(alpha, [outer], 255)

        # Inner (white fill)
        cv2.fillPoly(bgr,   [inner], (255, 255, 255))

        # Combine and downscale
        cursor_4x = np.dstack([bgr, alpha])
        result = cv2.resize(
            cursor_4x, (display_size, display_size),
            interpolation=cv2.INTER_AREA,
        )
        return result  # BGRA

    def _get_cursor(self, render_size: int) -> np.ndarray:
        """Return the cursor BGRA image at the requested pixel size (cached)."""
        if render_size not in self._cache:
            if render_size == self.max_size:
                self._cache[render_size] = self._cursor_bgra
            else:
                self._cache[render_size] = cv2.resize(
                    self._cursor_bgra,
                    (render_size, render_size),
                    interpolation=cv2.INTER_AREA if render_size < self.max_size else cv2.INTER_LANCZOS4,
                )
        return self._cache[render_size]

    # ── Step (a): remove cursor from original frame ────────────────────────────

    def remove_from_original(
        self,
        frame:  np.ndarray,
        mx:     float,
        my:     float,
        cursor_px: int = 28,   # cursor bounding-box width in original video px
    ) -> np.ndarray:
        """
        Inpaint the cursor region in the full-resolution frame.
        Uses a local ROI for speed (only the patch around the cursor is processed).

        cursor_px should reflect the native cursor size in the video.
        For macOS @1×: ~28px.  For Retina @2×: ~56px.
        """
        H, W = frame.shape[:2]
        tip_x = int(round(mx)) - self.HOTSPOT_X
        tip_y = int(round(my)) - self.HOTSPOT_Y

        # Bounding box: cursor extends down and right from tip
        pad   = 8
        x1    = max(0,  tip_x - pad)
        y1    = max(0,  tip_y - pad)
        x2    = min(W,  tip_x + cursor_px + pad)
        y2    = min(H,  tip_y + cursor_px + pad)

        if x2 <= x1 or y2 <= y1:
            return frame  # off-screen

        roi       = frame[y1:y2, x1:x2].copy()
        mask_roi  = np.zeros((y2 - y1, x2 - x1), dtype=np.uint8)

        # Arrow-shaped mask in ROI space
        tip_rx = tip_x - x1
        tip_ry = tip_y - y1
        scale  = cursor_px / 24.0
        outer_pts = np.array([
            (tip_rx + int(1  * scale), tip_ry + int(1  * scale)),
            (tip_rx + int(1  * scale), tip_ry + int(20 * scale)),
            (tip_rx + int(5  * scale), tip_ry + int(15 * scale)),
            (tip_rx + int(9  * scale), tip_ry + int(24 * scale)),
            (tip_rx + int(13 * scale), tip_ry + int(22 * scale)),
            (tip_rx + int(8  * scale), tip_ry + int(14 * scale)),
            (tip_rx + int(15 * scale), tip_ry + int(14 * scale)),
        ], dtype=np.int32)
        cv2.fillPoly(mask_roi, [outer_pts], 255)

        roi_clean = cv2.inpaint(roi, mask_roi, inpaintRadius=6, flags=cv2.INPAINT_TELEA)

        result = frame.copy()
        result[y1:y2, x1:x2] = roi_clean
        return result

    # ── Step (c): draw hi-res cursor on output frame ──────────────────────────

    def draw_on_output(
        self,
        frame:    np.ndarray,
        mx_out:   float,
        my_out:   float,
        zoom:     float,
    ) -> np.ndarray:
        """
        Composite the hi-res cursor onto the output frame.

        Cursor size scales with zoom so it maintains the same
        apparent size regardless of zoom level.
        """
        H, W = frame.shape[:2]

        # Cursor render size: scale with zoom, capped at max_size
        render_size = min(self.max_size, max(self.base_size, int(self.base_size * zoom)))
        cursor      = self._get_cursor(render_size)
        cH, cW      = cursor.shape[:2]

        # Top-left of cursor bounding box (tip is at HOTSPOT offset inside it)
        cx0 = int(round(mx_out)) - self.HOTSPOT_X
        cy0 = int(round(my_out)) - self.HOTSPOT_Y

        # Clip to frame bounds
        sx  = max(0, -cx0);  sy  = max(0, -cy0)
        ex  = min(cW, W - cx0);  ey = min(cH, H - cy0)
        if ex <= sx or ey <= sy:
            return frame  # fully outside

        dst_x0 = cx0 + sx;  dst_x1 = cx0 + ex
        dst_y0 = cy0 + sy;  dst_y1 = cy0 + ey

        patch_cursor = cursor[sy:ey, sx:ex]        # H×W×4 BGRA
        patch_frame  = frame[dst_y0:dst_y1, dst_x0:dst_x1]

        alpha = patch_cursor[:, :, 3:4].astype(np.float32) / 255.0
        blend = (patch_cursor[:, :, :3].astype(np.float32) * alpha +
                 patch_frame.astype(np.float32) * (1.0 - alpha))

        result = frame.copy()
        result[dst_y0:dst_y1, dst_x0:dst_x1] = blend.astype(np.uint8)
        return result


# ─────────────────────────────────────────────────────────────────────────────
#  SECTION 4 — Video probe
# ─────────────────────────────────────────────────────────────────────────────

def probe_video(path: str) -> VideoInfo:
    probe = ffmpeg.probe(path)
    v     = next(s for s in probe["streams"] if s["codec_type"] == "video")
    a     = next((s for s in probe["streams"] if s["codec_type"] == "audio"), None)
    num, den = map(int, v["avg_frame_rate"].split("/"))
    fps       = num / max(1, den)
    duration  = float(probe["format"]["duration"])
    n_frames  = int(v.get("nb_frames") or 0) or math.ceil(duration * fps)
    return VideoInfo(
        width=int(v["width"]), height=int(v["height"]),
        fps=fps, n_frames=n_frames, duration=duration,
        codec=v["codec_name"], has_audio=a is not None,
    )


# ─────────────────────────────────────────────────────────────────────────────
#  SECTION 5 — Core pipeline
# ─────────────────────────────────────────────────────────────────────────────

def process_video(
    input_path:    str,
    log_path:      str,
    output_path:   str,
    crf:           int   = 18,
    preset:        str   = "medium",
    hw_accel:      str | None = None,
    offset_sec:    float = 0.0,
    display_scale: float | None = None,   # None = auto-detect from log
    cursor_size:   int   = 28,
    replace_cursor: bool = True,
) -> None:

    # ── Probe ────────────────────────────────────────────────────────────────
    print(f"\n▸ Probing {Path(input_path).name}")
    info = probe_video(input_path)
    out_w, out_h = _output_size(info.width, info.height)
    print(
        f"  {info.width}×{info.height}  {info.fps:.3f} fps  "
        f"{info.n_frames} frames  {info.duration:.1f}s  [{info.codec}]"
    )
    print(f"  Output: {out_w}×{out_h}  (16:9)")

    # ── Load log ─────────────────────────────────────────────────────────────
    print(f"\n▸ Loading log {Path(log_path).name}")
    records = load_log(log_path)
    log_dur = (records[-1]["ts"] - records[0]["ts"]) / 1000

    # Auto-detect display_scale from the log's scaleFactor field
    if display_scale is None:
        display_scale = float(records[0].get("scaleFactor", 1.0))
    print(f"  {len(records)} records  {log_dur:.1f}s  display_scale=×{display_scale}")

    # Native cursor size in video pixels
    native_cursor_px = int(cursor_size * display_scale)

    # ── Build per-frame timeline (PCHIP spline) ───────────────────────────────
    print(f"\n▸ Building PCHIP timeline ({info.n_frames} frames)…")
    timeline = build_timeline(
        records, info.fps, info.n_frames,
        offset_ms=offset_sec * 1000,
        display_scale=display_scale,
    )
    zooms = [f["zoom"] for f in timeline]
    print(
        f"  Zoom  {min(zooms):.2f}×–{max(zooms):.2f}×  "
        f"avg {sum(zooms)/len(zooms):.2f}×"
    )

    # ── Cursor renderer ───────────────────────────────────────────────────────
    cursor_renderer: CursorRenderer | None = None
    if replace_cursor:
        cursor_renderer = CursorRenderer(base_size=cursor_size, max_size=cursor_size * 2)
        print(f"\n▸ Cursor replacement enabled  (base={cursor_size}px  native={native_cursor_px}px)")
    else:
        print("\n▸ Cursor replacement disabled")

    # ── Encoder settings ──────────────────────────────────────────────────────
    if hw_accel == "videotoolbox":
        enc_kw    = dict(vcodec="h264_videotoolbox", q="65", pix_fmt="yuv420p")
        enc_label = "VideoToolbox HW"
    elif hw_accel == "nvenc":
        enc_kw    = dict(vcodec="h264_nvenc", cq=str(crf), preset=preset, pix_fmt="yuv420p")
        enc_label = "NVENC HW"
    else:
        enc_kw    = dict(vcodec="libx264", crf=str(crf), preset=preset, pix_fmt="yuv420p")
        enc_label = f"libx264  CRF={crf}  preset={preset}"
    print(f"▸ Encoder: {enc_label}")

    frame_bytes = info.width * info.height * 3

    # ── Main pipeline ─────────────────────────────────────────────────────────
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp:
        video_only = tmp.name

    try:
        decoder_cmd = (
            ffmpeg.input(input_path).video
            .output("pipe:", format="rawvideo", pix_fmt="bgr24")
            .compile()
        )
        encoder_cmd = (
            ffmpeg
            .input("pipe:", format="rawvideo", pix_fmt="bgr24",
                   s=f"{out_w}x{out_h}", framerate=info.fps)
            .output(video_only, **enc_kw)
            .overwrite_output()
            .compile()
        )

        print(f"\n▸ Processing frames…\n")

        decoder = subprocess.Popen(decoder_cmd, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
        encoder = subprocess.Popen(encoder_cmd, stdin=subprocess.PIPE,  stderr=subprocess.DEVNULL)

        try:
            with tqdm(
                total=info.n_frames, unit="fr", dynamic_ncols=True,
                bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining} {rate_fmt}]",
            ) as bar:
                for i in range(info.n_frames):
                    raw = decoder.stdout.read(frame_bytes)
                    if len(raw) < frame_bytes:
                        break

                    frame = np.frombuffer(raw, dtype=np.uint8).reshape(
                        (info.height, info.width, 3)
                    )
                    cam = timeline[i]
                    box = compute_crop(cam, info.width, info.height)

                    # ── (a) Remove original cursor ────────────────────────
                    if cursor_renderer is not None:
                        frame = cursor_renderer.remove_from_original(
                            frame, cam["mx"], cam["my"], native_cursor_px
                        )

                    # ── (b) Crop (zero-copy) + scale ──────────────────────
                    cropped = frame[box.y : box.y + box.h, box.x : box.x + box.w]
                    if cropped.shape[1] != out_w or cropped.shape[0] != out_h:
                        interp   = cv2.INTER_LANCZOS4 if cropped.shape[1] < out_w else cv2.INTER_AREA
                        out_frame = cv2.resize(cropped, (out_w, out_h), interpolation=interp)
                    else:
                        out_frame = cropped.copy()

                    # ── (c) Composite hi-res cursor ───────────────────────
                    if cursor_renderer is not None:
                        # Cursor tip position in output frame
                        mx_in_crop = cam["mx"] - box.x
                        my_in_crop = cam["my"] - box.y
                        mx_out_f   = mx_in_crop / box.w * out_w
                        my_out_f   = my_in_crop / box.h * out_h
                        # Only draw if cursor is within the visible crop region
                        if 0 <= mx_out_f <= out_w and 0 <= my_out_f <= out_h:
                            out_frame = cursor_renderer.draw_on_output(
                                out_frame, mx_out_f, my_out_f, cam["zoom"]
                            )

                    encoder.stdin.write(out_frame.tobytes())
                    bar.update(1)
                    bar.set_postfix(
                        zoom=f"{cam['zoom']:.2f}×",
                        λ="click" if cam["zoom"] > 1.45 else "—",
                    )

        finally:
            decoder.stdout.close(); decoder.wait()
            encoder.stdin.close();  encoder.wait()

        # ── Mux audio ─────────────────────────────────────────────────────
        print(f"\n▸ Muxing {'audio + ' if info.has_audio else ''}video…")
        streams  = [ffmpeg.input(video_only).video]
        out_kw: dict = {"vcodec": "copy"}
        if info.has_audio:
            streams.append(ffmpeg.input(input_path).audio)
            out_kw.update(acodec="aac", audio_bitrate="192k")

        ffmpeg.output(*streams, output_path, **out_kw).overwrite_output().run(quiet=True)

    finally:
        if os.path.exists(video_only):
            os.unlink(video_only)

    out_mb = Path(output_path).stat().st_size / (1024 * 1024)
    in_mb  = Path(input_path).stat().st_size  / (1024 * 1024)
    print(f"\n✓ Done → {output_path}  ({in_mb:.1f} MB → {out_mb:.1f} MB)\n")


# ─────────────────────────────────────────────────────────────────────────────
#  SECTION 6 — CLI
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    p = argparse.ArgumentParser(
        description="Apply FocusEngine camera log to a video (auto-zoom + cursor replacement).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("input")
    p.add_argument("log")
    p.add_argument("output", nargs="?")
    p.add_argument("--crf",    type=int, default=18)
    p.add_argument("--preset", default="medium",
                   choices=["ultrafast","superfast","veryfast","faster","fast",
                            "medium","slow","veryslow"])
    p.add_argument("--hw", dest="hw_accel", choices=["videotoolbox","nvenc"])
    p.add_argument("--offset",        type=float, default=0.0,  metavar="SEC",
                   help="Log time offset in seconds (default 0)")
    p.add_argument("--display-scale", type=float, default=None, metavar="F",
                   help="Logical→physical pixel scale (auto-detected from log if omitted; "
                        "pass 2 for Retina if log lacks scaleFactor field)")
    p.add_argument("--cursor-size",   type=int,   default=28,
                   help="Replacement cursor height in logical pixels (default 28)")
    p.add_argument("--no-cursor", action="store_true",
                   help="Disable cursor removal and replacement")
    args = p.parse_args()

    if not args.output:
        stem = Path(args.input).stem
        args.output = str(Path(args.input).parent / f"{stem}_autozoom.mp4")

    for f in (args.input, args.log):
        if not Path(f).is_file():
            sys.exit(f"File not found: {f}")

    process_video(
        input_path=args.input,
        log_path=args.log,
        output_path=args.output,
        crf=args.crf,
        preset=args.preset,
        hw_accel=args.hw_accel,
        offset_sec=args.offset,
        display_scale=args.display_scale,
        cursor_size=args.cursor_size,
        replace_cursor=not args.no_cursor,
    )


if __name__ == "__main__":
    main()
