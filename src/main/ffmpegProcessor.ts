/**
 * ffmpegProcessor.ts — FFmpeg binary detection, filter-complex builder, and
 * spawn wrapper for the "Screen Studio" post-processing pipeline.
 *
 * Pipeline overview
 * ─────────────────
 *   1. crop=iw:ih-{cropTopPx}:0:{cropTopPx}   Remove browser chrome from top
 *   2. scale=…*0.9:…*0.9                       Scale to 90 % (or custom %)
 *   3. format=yuva420p + geq alpha mask         Rounded corners (r=20 px)
 *   4. color[bg] + overlay=(W-w)/2:(H-h)/2     Center on solid-color background
 */

import { spawn } from 'child_process'
import { existsSync } from 'fs'

// ─── Binary detection ─────────────────────────────────────────────────────────

/** Ordered list of candidate FFmpeg binary paths */
const FFMPEG_SEARCH_PATHS = [
  '/opt/homebrew/bin/ffmpeg',        // macOS Apple-Silicon Homebrew
  '/usr/local/bin/ffmpeg',           // macOS Intel Homebrew
  '/usr/bin/ffmpeg',                 // Linux apt / system
  '/usr/local/homebrew/bin/ffmpeg',  // macOS alternate prefix
  'C:\\ffmpeg\\bin\\ffmpeg.exe',     // Windows manual install
  'C:\\ProgramData\\chocolatey\\bin\\ffmpeg.exe', // Windows Chocolatey
]

/**
 * Return the first usable FFmpeg binary path, or null if not found.
 * Falls back to the bare name "ffmpeg" (relies on PATH) when none of the
 * known paths exist.
 */
export function findFfmpegBin(): string | null {
  for (const p of FFMPEG_SEARCH_PATHS) {
    if (existsSync(p)) return p
  }
  // Check if ffmpeg is on PATH by trying the bare name — callers must handle
  // spawn errors to distinguish "not found" from other errors.
  return 'ffmpeg'
}

// ─── Filter-complex builder ───────────────────────────────────────────────────

export interface ScreenStudioOptions {
  /** Absolute path to the source MP4/WebM */
  inputPath: string
  /** Absolute path for the output MP4 */
  outputPath: string
  /** Output canvas width  (default 1920) */
  canvasWidth?: number
  /** Output canvas height (default 1080) */
  canvasHeight?: number
  /** Pixels to crop from the top (browser chrome).  Default 100. */
  cropTopPx?: number
  /** Scale factor 0-100 applied to the cropped video.  Default 90. */
  scalePct?: number
  /** Corner-rounding radius in pixels.  Default 20. */
  cornerRadius?: number
  /** Background hex colour without leading #.  Default 1a1a2e. */
  backgroundColor?: string
  /** Output frame-rate.  Default 30. */
  fps?: number
}

/**
 * Build the filter_complex string and assemble the full FFmpeg args array for
 * the Screen Studio layout:
 *
 *   crop  →  scale  →  rounded-corners  →  overlay on solid background
 */
export function buildFfmpegArgs(opts: ScreenStudioOptions): string[] {
  const {
    inputPath,
    outputPath,
    canvasWidth  = 1920,
    canvasHeight = 1080,
    cropTopPx    = 100,
    scalePct     = 90,
    cornerRadius = 20,
    backgroundColor = '1a1a2e',
    fps = 30,
  } = opts

  const scale = scalePct / 100
  const r     = cornerRadius
  const bgHex = backgroundColor.replace(/^#/, '')

  // ── Rounded-corner mask expression ───────────────────────────────────────
  //
  // For each pixel (X, Y) in a W×H frame, alpha = 0 when the pixel falls in
  // one of the four corner exclusion zones (outside the arc of radius r).
  //
  // Corner zones                Arc-center coords
  //   top-left     X<r, Y<r     (r,     r    )
  //   top-right    X>W-1-r, Y<r (W-1-r, r    )
  //   bottom-left  X<r, Y>H-1-r (r,     H-1-r)
  //   bottom-right X>W-1-r, Y>H-1-r (W-1-r, H-1-r)
  //
  // Pixel is in corner zone AND outside arc  →  alpha = 0
  // Otherwise                                →  alpha = 255
  const rM1 = r - 1  // r-1, so gt(X,W-1-r) ≡ X > W-1-r (i.e. X in last r pixels)
  const alphaExpr = [
    `255*not(`,
    // top-left
    `lt(X,${r})*lt(Y,${r})*gt(hypot(X-${r},Y-${r}),${rM1})+`,
    // top-right    (arc center at W-1-r, r)
    `gt(X,W-1-${r})*lt(Y,${r})*gt(hypot(X-(W-1-${r}),Y-${r}),${rM1})+`,
    // bottom-left  (arc center at r, H-1-r)
    `lt(X,${r})*gt(Y,H-1-${r})*gt(hypot(X-${r},Y-(H-1-${r})),${rM1})+`,
    // bottom-right (arc center at W-1-r, H-1-r)
    `gt(X,W-1-${r})*gt(Y,H-1-${r})*gt(hypot(X-(W-1-${r}),Y-(H-1-${r})),${rM1})`,
    `)`,
  ].join('')

  // ── Filter complex ────────────────────────────────────────────────────────
  //
  // Step A  [bg]      Solid background, same size as output canvas
  // Step B  [cropped] Crop top N pixels (browser chrome)
  // Step C  [scaled]  Scale to scalePct % (even dimensions required by H.264)
  // Step D  [scaled_a] Add alpha plane so geq can write transparency
  // Step E  [rounded] Apply rounded-corner alpha mask via geq
  // Step F  [out]     Overlay the rounded video on the background, centred
  const filterComplex = [
    // A — background
    `color=c=0x${bgHex}:size=${canvasWidth}x${canvasHeight}:rate=${fps}[bg]`,
    // B — crop browser chrome
    `[0:v]crop=iw:ih-${cropTopPx}:0:${cropTopPx}[cropped]`,
    // C — scale to scalePct% (trunc ensures even W/H for libx264)
    `[cropped]scale=` +
      `trunc(iw*${scale}/2)*2:trunc(ih*${scale}/2)*2:flags=lanczos[scaled]`,
    // D — add alpha channel
    `[scaled]format=yuva420p[scaled_a]`,
    // E — rounded corners
    `[scaled_a]geq=` +
      `lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='${alphaExpr}'[rounded]`,
    // F — centre on background; stop when video stream ends
    `[bg][rounded]overlay=(W-w)/2:(H-h)/2:format=auto:shortest=1[out]`,
  ].join(';')

  return [
    '-i', inputPath,
    '-filter_complex', filterComplex,
    '-map', '[out]',
    '-map', '0:a?',            // pass-through audio if present
    '-c:v', 'libx264',
    '-preset', 'medium',
    '-crf', '18',
    '-pix_fmt', 'yuv420p',     // required for broad QuickTime / browser compat
    '-movflags', '+faststart', // streaming-friendly MP4 atom ordering
    '-y',                      // overwrite output without prompting
    outputPath,
  ]
}

// ─── Spawn wrapper ────────────────────────────────────────────────────────────

export interface FfmpegCallbacks {
  onProgress: (pct: number) => void
  onDone: (result: { success: boolean; error?: string }) => void
}

/**
 * Spawn FFmpeg with the given args, parse progress from stdout (`-progress
 * pipe:1`), and invoke callbacks.  Returns a cancel function.
 */
export function runFfmpeg(
  ffmpegBin: string,
  args: string[],
  { onProgress, onDone }: FfmpegCallbacks,
): () => void {
  let durationUs = 0
  let settled    = false

  const finish = (result: { success: boolean; error?: string }) => {
    if (settled) return
    settled = true
    onDone(result)
  }

  // -progress pipe:1 writes key=value pairs to stdout; -nostats suppresses the
  // default verbose stderr stats banner that overlaps with our duration parse.
  const proc = spawn(ffmpegBin, ['-progress', 'pipe:1', '-nostats', ...args])

  // Parse total duration from stderr (e.g. "Duration: 00:01:23.45")
  proc.stderr.on('data', (chunk: Buffer) => {
    const m = chunk.toString().match(/Duration:\s*(\d+):(\d+):(\d+\.\d+)/)
    if (m) {
      durationUs =
        (parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3])) * 1_000_000
    }
  })

  // Parse current output time from -progress pipe output
  proc.stdout.on('data', (chunk: Buffer) => {
    const m = chunk.toString().match(/out_time_us=(\d+)/)
    if (m && durationUs > 0) {
      onProgress(Math.min(99, (parseInt(m[1]) / durationUs) * 100))
    }
  })

  proc.on('close', (code) => {
    if (code === 0) {
      onProgress(100)
      finish({ success: true })
    } else {
      finish({ success: false, error: `FFmpeg exited with code ${code}` })
    }
  })

  proc.on('error', (err) => {
    finish({ success: false, error: err.message })
  })

  return () => {
    if (!settled) proc.kill()
  }
}
