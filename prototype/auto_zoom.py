#!/usr/bin/env python3
"""
auto_zoom.py — Apply FocusEngine virtual-camera log to a screen recording.

Architecture:
    ┌──────────┐  raw BGR frames   ┌─────────────┐  processed frames  ┌──────────┐
    │ FFmpeg   │ ────────────────▶ │  Python:    │ ─────────────────▶ │ FFmpeg   │
    │ decoder  │    via pipe       │  crop+scale │    via pipe        │ encoder  │
    └──────────┘                   └─────────────┘                    └──────────┘
         ↓ audio (untouched)                                                ↓
    ─────────────────────────────────────────────────────── mux ───────────▶ output.mp4

Usage:
    python auto_zoom.py recording.mp4 focus-log.ndjson [output.mp4] [OPTIONS]

Options:
    --crf INT          H.264 quality (0=lossless, 18=near-lossless, 23=default)
    --preset NAME      x264 preset: ultrafast / fast / medium / slow
    --hw videotoolbox  Use macOS VideoToolbox hardware encoder
    --hw nvenc         Use NVIDIA NVENC hardware encoder
    --offset FLOAT     Shift log time by N seconds (+/-) to fix sync
    --no-audio         Drop audio track from output

Requirements:
    pip install ffmpeg-python numpy opencv-python-headless tqdm
    brew install ffmpeg          (macOS)
    sudo apt install ffmpeg     (Ubuntu/Debian)
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
try:
    import cv2
except ImportError:
    _missing.append("opencv-python-headless")
try:
    import numpy as np
except ImportError:
    _missing.append("numpy")
try:
    import ffmpeg  # ffmpeg-python
except ImportError:
    _missing.append("ffmpeg-python")
try:
    from tqdm import tqdm
except ImportError:
    _missing.append("tqdm")

if _missing:
    sys.exit(
        "Missing Python packages. Install with:\n"
        f"  pip install {' '.join(_missing)}\n\n"
        "Also ensure FFmpeg is installed:\n"
        "  macOS:   brew install ffmpeg\n"
        "  Ubuntu:  sudo apt install ffmpeg"
    )

# ── Data types ────────────────────────────────────────────────────────────────

class VideoInfo(NamedTuple):
    width:     int
    height:    int
    fps:       float
    n_frames:  int
    duration:  float   # seconds
    codec:     str
    has_audio: bool


class CropBox(NamedTuple):
    """Pixel-space crop rectangle (top-left + size, even-aligned)."""
    x: int
    y: int
    w: int
    h: int


# ── Log loading & interpolation ───────────────────────────────────────────────

def load_log(path: str) -> list[dict]:
    """Parse NDJSON focus log; return records sorted by timestamp."""
    records: list[dict] = []
    with open(path, encoding="utf-8") as fh:
        for lineno, raw in enumerate(fh, 1):
            raw = raw.strip()
            if not raw:
                continue
            try:
                records.append(json.loads(raw))
            except json.JSONDecodeError as exc:
                print(f"  ⚠ skipping malformed line {lineno}: {exc}", file=sys.stderr)
    if not records:
        raise ValueError(f"No valid JSON records found in {path}")
    records.sort(key=lambda r: r["ts"])
    return records


def _lerp(a: float, b: float, t: float) -> float:
    return a + (b - a) * t


def _interp_camera(records: list[dict], target_ts: float) -> dict:
    """
    Linear interpolation of camera state at `target_ts` (ms).
    Clamps at boundaries.
    """
    if target_ts <= records[0]["ts"]:
        return records[0]["camera"]
    if target_ts >= records[-1]["ts"]:
        return records[-1]["camera"]

    # Binary search for surrounding records
    lo, hi = 0, len(records) - 1
    while lo + 1 < hi:
        mid = (lo + hi) // 2
        if records[mid]["ts"] <= target_ts:
            lo = mid
        else:
            hi = mid

    r0, r1 = records[lo], records[hi]
    span = max(1.0, r1["ts"] - r0["ts"])
    alpha = max(0.0, min(1.0, (target_ts - r0["ts"]) / span))
    c0, c1 = r0["camera"], r1["camera"]
    return {
        "x":    _lerp(c0["x"],    c1["x"],    alpha),
        "y":    _lerp(c0["y"],    c1["y"],    alpha),
        "zoom": _lerp(c0["zoom"], c1["zoom"], alpha),
    }


def build_timeline(
    records: list[dict],
    fps: float,
    n_frames: int,
    offset_ms: float = 0.0,
) -> list[dict]:
    """
    Pre-compute camera state for every video frame.

    `offset_ms` shifts the log timeline relative to the video:
      positive = log leads video (shift log back)
      negative = video leads log (shift log forward)

    Returns a list of {'x', 'y', 'zoom'} dicts, length == n_frames.
    """
    start_ts = records[0]["ts"] - offset_ms
    frame_ms  = 1000.0 / fps
    return [_interp_camera(records, start_ts + i * frame_ms) for i in range(n_frames)]


# ── 16:9 crop computation ─────────────────────────────────────────────────────

_AR_16_9 = 16 / 9


def _output_size(video_w: int, video_h: int) -> tuple[int, int]:
    """
    Determine the output (width, height) that is 16:9 and fits inside the
    original video.  For inputs already 16:9 this is identity.
    """
    if abs(video_w / video_h - _AR_16_9) < 0.01:
        return video_w, video_h
    # Letterbox/pillarbox: pick the largest 16:9 box that fits
    if video_w / video_h > _AR_16_9:          # wider than 16:9 → crop sides
        out_w = int(video_h * _AR_16_9) & ~1
        return out_w, video_h
    else:                                      # taller than 16:9 → crop top/bottom
        out_h = int(video_w / _AR_16_9) & ~1
        return video_w, out_h


def compute_crop(cam: dict, video_w: int, video_h: int) -> CropBox:
    """
    Compute a 16:9-preserving crop box for the given camera state.

    The crop region has the same aspect ratio as _output_size() so that when
    it is scaled back to output resolution the image is always 16:9.
    """
    out_w, out_h = _output_size(video_w, video_h)
    zoom = max(1.0, cam["zoom"])

    # Crop size at this zoom level (same AR as output_size)
    cw = out_w / zoom
    ch = out_h / zoom

    # Map normalised camera centre to pixel coordinates within the VIDEO
    # (not the output box, because the input may be non-16:9)
    cx = cam["x"] * video_w
    cy = cam["y"] * video_h

    # Top-left of crop box
    x = cx - cw / 2
    y = cy - ch / 2

    # Clamp so the box doesn't leave the video frame
    x = max(0.0, min(video_w - cw, x))
    y = max(0.0, min(video_h - ch, y))

    # Align to even pixels (H.264 chroma-subsampling requirement)
    xi = int(x) & ~1
    yi = int(y) & ~1
    wi = int(cw) & ~1
    hi = int(ch) & ~1

    # Re-clamp after rounding
    xi = min(xi, video_w  - wi)
    yi = min(yi, video_h - hi)

    return CropBox(x=xi, y=yi, w=wi, h=hi)


# ── Video probe ───────────────────────────────────────────────────────────────

def probe_video(path: str) -> VideoInfo:
    probe  = ffmpeg.probe(path)
    vinfo  = next(s for s in probe["streams"] if s["codec_type"] == "video")
    ainfo  = next((s for s in probe["streams"] if s["codec_type"] == "audio"), None)

    num, den = map(int, vinfo["avg_frame_rate"].split("/"))
    fps = num / max(1, den)

    n_frames = int(vinfo.get("nb_frames") or 0)
    duration = float(probe["format"]["duration"])
    if not n_frames:
        n_frames = math.ceil(duration * fps)

    return VideoInfo(
        width=int(vinfo["width"]),
        height=int(vinfo["height"]),
        fps=fps,
        n_frames=n_frames,
        duration=duration,
        codec=vinfo["codec_name"],
        has_audio=ainfo is not None,
    )


# ── Core pipeline ─────────────────────────────────────────────────────────────

def process_video(
    input_path:  str,
    log_path:    str,
    output_path: str,
    crf:         int   = 18,
    preset:      str   = "medium",
    hw_accel:    str | None = None,
    offset_sec:  float = 0.0,
    keep_audio:  bool  = True,
) -> None:

    # ── Step 1: Probe ────────────────────────────────────────────────────────
    print(f"\n▸ Probing {Path(input_path).name}")
    info = probe_video(input_path)
    out_w, out_h = _output_size(info.width, info.height)
    print(
        f"  Input : {info.width}×{info.height}  {info.fps:.3f} fps  "
        f"{info.n_frames} frames  {info.duration:.1f}s  [{info.codec}]"
    )
    print(f"  Output: {out_w}×{out_h}  (16:9{'  ← letterboxed' if (out_w, out_h) != (info.width, info.height) else ''})")
    if not info.has_audio:
        keep_audio = False

    # ── Step 2: Load log ─────────────────────────────────────────────────────
    print(f"\n▸ Loading log {Path(log_path).name}")
    records = load_log(log_path)
    log_dur = (records[-1]["ts"] - records[0]["ts"]) / 1000
    print(f"  {len(records)} records  {log_dur:.1f}s  offset={offset_sec:+.2f}s")

    # ── Step 3: Pre-compute per-frame camera positions ───────────────────────
    print(f"\n▸ Building per-frame camera timeline ({info.n_frames} frames)…")
    timeline = build_timeline(records, info.fps, info.n_frames, offset_ms=offset_sec * 1000)
    zoom_values = [c["zoom"] for c in timeline]
    print(
        f"  Zoom range: {min(zoom_values):.2f}× – {max(zoom_values):.2f}×  "
        f"avg {sum(zoom_values)/len(zoom_values):.2f}×"
    )

    # ── Step 4: Build FFmpeg pipelines ───────────────────────────────────────
    frame_bytes = info.width * info.height * 3   # BGR24

    # Decoder: input → raw BGR24 frames on stdout
    decoder_args = (
        ffmpeg
        .input(input_path)
        .video
        .output("pipe:", format="rawvideo", pix_fmt="bgr24")
        .compile()
    )

    # Encoder: raw BGR24 frames on stdin → H.264 MP4
    if hw_accel == "videotoolbox":
        enc_kwargs = dict(vcodec="h264_videotoolbox", q=str(65), pix_fmt="yuv420p")
        accel_label = "VideoToolbox HW"
    elif hw_accel == "nvenc":
        enc_kwargs = dict(vcodec="h264_nvenc", cq=str(crf), preset=preset, pix_fmt="yuv420p")
        accel_label = "NVENC HW"
    else:
        enc_kwargs = dict(vcodec="libx264", crf=str(crf), preset=preset, pix_fmt="yuv420p")
        accel_label = f"libx264 CRF={crf} preset={preset}"

    print(f"\n▸ Encoder: {accel_label}")

    # ── Step 5: Process frames ───────────────────────────────────────────────
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as tmp_file:
        video_only_path = tmp_file.name

    try:
        encoder_args = (
            ffmpeg
            .input(
                "pipe:",
                format="rawvideo",
                pix_fmt="bgr24",
                s=f"{out_w}x{out_h}",
                framerate=info.fps,
            )
            .output(video_only_path, **enc_kwargs)
            .overwrite_output()
            .compile()
        )

        print(f"▸ Processing frames…\n")

        decoder = subprocess.Popen(
            decoder_args,
            stdout=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )
        encoder = subprocess.Popen(
            encoder_args,
            stdin=subprocess.PIPE,
            stderr=subprocess.DEVNULL,
        )

        try:
            with tqdm(
                total=info.n_frames,
                unit="fr",
                dynamic_ncols=True,
                bar_format="{l_bar}{bar}| {n_fmt}/{total_fmt} [{elapsed}<{remaining} {rate_fmt}]",
            ) as bar:
                for frame_idx in range(info.n_frames):
                    # Read one raw frame from decoder
                    raw = decoder.stdout.read(frame_bytes)
                    if len(raw) < frame_bytes:
                        break  # stream ended early

                    frame = np.frombuffer(raw, dtype=np.uint8).reshape(
                        (info.height, info.width, 3)
                    )
                    cam = timeline[frame_idx]
                    box = compute_crop(cam, info.width, info.height)

                    # ── Crop (zero-copy numpy slice) ──────────────────────
                    cropped = frame[box.y : box.y + box.h, box.x : box.x + box.w]

                    # ── Scale to output size ──────────────────────────────
                    # INTER_AREA = best for shrink (downscale)
                    # INTER_LANCZOS4 = best for enlarge (upscale / zoom-in)
                    if cropped.shape[1] == out_w and cropped.shape[0] == out_h:
                        out_frame = cropped
                    else:
                        interp = (
                            cv2.INTER_LANCZOS4
                            if cropped.shape[1] < out_w
                            else cv2.INTER_AREA
                        )
                        out_frame = cv2.resize(
                            cropped, (out_w, out_h), interpolation=interp
                        )

                    encoder.stdin.write(out_frame.tobytes())

                    bar.update(1)
                    bar.set_postfix(
                        zoom=f"{cam['zoom']:.2f}×",
                        x=f"{cam['x']:.2f}",
                        y=f"{cam['y']:.2f}",
                    )

        finally:
            decoder.stdout.close()
            decoder.wait()
            encoder.stdin.close()
            encoder.wait()

        # ── Step 6: Mux audio ─────────────────────────────────────────────
        print(f"\n▸ Muxing {'audio + ' if keep_audio else ''}video…")
        inputs = [ffmpeg.input(video_only_path)]
        if keep_audio:
            inputs.append(ffmpeg.input(input_path).audio)

        out_streams = [inputs[0].video]
        out_kwargs: dict = {"vcodec": "copy"}

        if keep_audio:
            out_streams.append(inputs[1])
            out_kwargs["acodec"] = "aac"
            out_kwargs["audio_bitrate"] = "192k"

        (
            ffmpeg
            .output(*out_streams, output_path, **out_kwargs)
            .overwrite_output()
            .run(quiet=True)
        )

    finally:
        if os.path.exists(video_only_path):
            os.unlink(video_only_path)

    # ── Step 7: Report ───────────────────────────────────────────────────────
    out_size = Path(output_path).stat().st_size / (1024 * 1024)
    in_size  = Path(input_path).stat().st_size  / (1024 * 1024)
    print(
        f"\n✓ Done → {output_path}\n"
        f"  Size: {in_size:.1f} MB → {out_size:.1f} MB\n"
    )


# ── CLI ───────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Apply FocusEngine camera log to a video (auto-zoom).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("input",          help="Input MP4 recording")
    parser.add_argument("log",            help="focus-log.ndjson from focus-tracker")
    parser.add_argument("output", nargs="?", help="Output MP4 (default: <input>_autozoom.mp4)")

    parser.add_argument(
        "--crf", type=int, default=18,
        help="H.264 CRF quality  0=lossless  18=near-lossless  23=default  51=worst (default: 18)",
    )
    parser.add_argument(
        "--preset", default="medium",
        choices=["ultrafast", "superfast", "veryfast", "faster", "fast", "medium", "slow", "veryslow"],
        help="x264 encoding preset — slower = better compression (default: medium)",
    )
    parser.add_argument(
        "--hw", dest="hw_accel", choices=["videotoolbox", "nvenc"],
        help="Hardware encoder: videotoolbox (macOS) or nvenc (NVIDIA)",
    )
    parser.add_argument(
        "--offset", type=float, default=0.0, dest="offset_sec",
        metavar="SEC",
        help="Shift the log relative to the video in seconds (+log leads, -video leads)",
    )
    parser.add_argument(
        "--no-audio", action="store_true",
        help="Drop audio track from output",
    )

    args = parser.parse_args()

    # Default output path
    if not args.output:
        p = Path(args.input)
        args.output = str(p.parent / f"{p.stem}_autozoom.mp4")

    # Sanity checks
    if not Path(args.input).is_file():
        sys.exit(f"Input file not found: {args.input}")
    if not Path(args.log).is_file():
        sys.exit(f"Log file not found: {args.log}")

    process_video(
        input_path=args.input,
        log_path=args.log,
        output_path=args.output,
        crf=args.crf,
        preset=args.preset,
        hw_accel=args.hw_accel,
        offset_sec=args.offset_sec,
        keep_audio=not args.no_audio,
    )


if __name__ == "__main__":
    main()
