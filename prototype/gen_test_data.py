#!/usr/bin/env python3
"""
gen_test_data.py — Generate a synthetic test video + focus log for offline testing.

Creates:
    test_recording.mp4   — 10-second 1920×1080 @30fps test video (colour bars + timer)
    test_log.ndjson      — simulated FocusEngine output matching the video

Usage:
    python gen_test_data.py
    python auto_zoom.py test_recording.mp4 test_log.ndjson
"""

import json, math, os, subprocess, sys, time
from pathlib import Path

try:
    import ffmpeg
    import numpy as np
    import cv2
except ImportError as e:
    sys.exit(f"Install dependencies first: pip install ffmpeg-python numpy opencv-python-headless\n{e}")

# ── Config ────────────────────────────────────────────────────────────────────
WIDTH, HEIGHT = 1920, 1080
FPS           = 30
DURATION_SEC  = 10
OUT_DIR       = Path(__file__).parent

# ── Generate test video ───────────────────────────────────────────────────────
video_path = OUT_DIR / "test_recording.mp4"
print(f"Generating {video_path}…")

encoder = (
    ffmpeg
    .input("pipe:", format="rawvideo", pix_fmt="bgr24", s=f"{WIDTH}x{HEIGHT}", framerate=FPS)
    .output(str(video_path), vcodec="libx264", pix_fmt="yuv420p", crf=23)
    .overwrite_output()
    .run_async(pipe_stdin=True, quiet=True)
)

COLORS = [  # SMPTE-ish colour bars
    (192, 192, 192), (192, 192,   0), (  0, 192, 192),
    (  0, 192,   0), (192,   0, 192), (192,   0,   0), (  0,   0, 192),
]

total_frames = FPS * DURATION_SEC
for i in range(total_frames):
    frame = np.zeros((HEIGHT, WIDTH, 3), dtype=np.uint8)
    # Colour bars
    bar_w = WIDTH // len(COLORS)
    for bi, (r, g, b) in enumerate(COLORS):
        frame[:int(HEIGHT * 0.75), bi*bar_w:(bi+1)*bar_w] = (b, g, r)  # BGR
    # Frame counter
    t_sec = i / FPS
    cv2.putText(frame, f"{t_sec:6.2f}s  frame {i}", (60, HEIGHT - 60),
                cv2.FONT_HERSHEY_SIMPLEX, 2.0, (255, 255, 255), 3, cv2.LINE_AA)
    # Moving dot (simulates cursor)
    dot_x = int(WIDTH  * (0.2 + 0.6 * abs(math.sin(t_sec * 0.8))))
    dot_y = int(HEIGHT * (0.2 + 0.6 * abs(math.cos(t_sec * 0.6))))
    cv2.circle(frame, (dot_x, dot_y), 20, (0, 64, 255), -1)
    encoder.stdin.write(frame.tobytes())

encoder.stdin.close()
encoder.wait()
print(f"  ✓ {total_frames} frames written")

# ── Generate synthetic focus log ──────────────────────────────────────────────
log_path = OUT_DIR / "test_log.ndjson"
print(f"Generating {log_path}…")

LOG_FPS = 10    # log at 10 Hz (matches focus-tracker default)
start_ts = int(time.time() * 1000)

records = []
cam_x, cam_y, cam_z = 0.5, 0.5, 1.0

def exp_smooth(cur, tgt, lam, dt):
    return cur + (tgt - cur) * (1 - math.exp(-lam * dt))

for i in range(DURATION_SEC * LOG_FPS):
    t_sec = i / LOG_FPS

    # Simulate focus engine output: dwell at various points
    if t_sec < 2.0:
        tx, ty, tz = 0.5, 0.5, 1.0          # idle at centre
    elif t_sec < 4.0:
        tx, ty, tz = 0.25, 0.3, 1.5         # focused top-left
    elif t_sec < 4.5:
        tx, ty, tz = 0.5, 0.5, 1.0          # moving (zoom out)
    elif t_sec < 7.0:
        tx, ty, tz = 0.75, 0.65, 1.5        # focused bottom-right
    elif t_sec < 7.5:
        tx, ty, tz = 0.5, 0.5, 1.0          # moving
    else:
        tx, ty, tz = 0.5, 0.25, 1.5         # focused top-centre

    dt = 1 / LOG_FPS
    cam_x = exp_smooth(cam_x, tx, 5.0, dt)
    cam_y = exp_smooth(cam_y, ty, 5.0, dt)
    cam_z = exp_smooth(cam_z, tz, 2.5, dt)

    vel = 0 if tz == 1.0 else 10
    state = "moving" if t_sec in [4.0, 7.0] else ("focused" if tz > 1.0 else "idle")

    record = {
        "ts":       start_ts + int(t_sec * 1000),
        "state":    state,
        "mouse":    {"x": int(tx * 1920), "y": int(ty * 1080)},
        "target":   {"x": round(tx, 4), "y": round(ty, 4)},
        "camera":   {"x": round(cam_x, 4), "y": round(cam_y, 4), "zoom": round(cam_z, 3)},
        "velocity": vel,
    }
    records.append(record)

with open(log_path, "w") as fh:
    for r in records:
        fh.write(json.dumps(r) + "\n")

print(f"  ✓ {len(records)} records written")
print(f"\nNow run:\n  python auto_zoom.py {video_path} {log_path}")
