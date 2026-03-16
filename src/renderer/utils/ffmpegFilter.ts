/**
 * ffmpegFilter.ts — Pure renderer-side FFmpeg command builder.
 *
 * Mirrors the main-process logic in ffmpegProcessor.ts but runs entirely in
 * the renderer (no Node.js / spawn).  Used to:
 *   • Show the user a copyable FFmpeg command before executing
 *   • Derive the ScreenStudioOptions from the current EditState
 */

import type { EditState } from '../types'

export interface FfmpegExportOptions {
  canvasWidth: number
  canvasHeight: number
  cropTopPx: number       // physical pixels to crop from top
  scalePct: number        // 0–100, default 90
  cornerRadius: number    // px, default 20
  backgroundColor: string // hex without #, e.g. "1a1a2e"
  fps: number
}

// ─── Derive options from EditState ────────────────────────────────────────────

/** Canvas dimensions map — must stay in sync with VideoEditor.tsx:canvasDimensions */
function canvasDims(ar: EditState['canvasSettings']['aspectRatio']): { W: number; H: number } {
  switch (ar) {
    case '4:3':  return { W: 1440, H: 1080 }
    case '1:1':  return { W: 1080, H: 1080 }
    case '9:16': return { W: 1080, H: 1920 }
    default:     return { W: 1920, H: 1080 }
  }
}

/**
 * Derive FFmpeg export options from the current editor state.
 *
 * @param state       Current EditState (canvas settings, capture region, …)
 * @param videoHeight Physical pixel height of the raw video track
 * @param fps         Output frame-rate (typically matches recording FPS)
 */
export function optionsFromEditState(
  state: EditState,
  videoHeight: number,
  fps = 30,
): FfmpegExportOptions {
  const cs = state.canvasSettings
  const { W, H } = canvasDims(cs.aspectRatio)

  // Crop: use the CaptureRegion.y fraction × video height
  const cropTopPx = state.captureRegion
    ? Math.round(state.captureRegion.y * videoHeight)
    : 0

  // Scale: derive from padding — padding px / canvas px → margin fraction
  // scalePct = (1 − 2 × padding / min(W, H)) × 100, clamped to [50, 95]
  const rawPct = (1 - (2 * cs.padding) / Math.min(W, H)) * 100
  const scalePct = Math.min(95, Math.max(50, Math.round(rawPct)))

  // Background: use solid colour when backgroundType=solid; otherwise
  // fall back to a deep-navy default that looks like the Screen Studio default.
  const backgroundColor =
    cs.backgroundType === 'solid'
      ? cs.backgroundColor.replace(/^#/, '')
      : '1a1a2e'

  return {
    canvasWidth:  W,
    canvasHeight: H,
    cropTopPx,
    scalePct,
    cornerRadius: Math.max(cs.cornerRadius, 20),   // at least 20 px per spec
    backgroundColor,
    fps,
  }
}

// ─── Command preview builder ──────────────────────────────────────────────────

/**
 * Return a formatted FFmpeg command string suitable for display / copying.
 * Uses shell-safe single-quoting around the filter_complex value.
 */
export function buildCommandPreview(
  inputPath: string,
  outputPath: string,
  o: FfmpegExportOptions,
): string {
  const scale = o.scalePct / 100
  const r     = o.cornerRadius
  const rM1   = r - 1
  const bg    = o.backgroundColor.replace(/^#/, '')

  const alphaExpr = [
    `255*not(`,
    `lt(X,${r})*lt(Y,${r})*gt(hypot(X-${r},Y-${r}),${rM1})+`,
    `gt(X,W-1-${r})*lt(Y,${r})*gt(hypot(X-(W-1-${r}),Y-${r}),${rM1})+`,
    `lt(X,${r})*gt(Y,H-1-${r})*gt(hypot(X-${r},Y-(H-1-${r})),${rM1})+`,
    `gt(X,W-1-${r})*gt(Y,H-1-${r})*gt(hypot(X-(W-1-${r}),Y-(H-1-${r})),${rM1})`,
    `)`,
  ].join('')

  const filterLines = [
    `  color=c=0x${bg}:size=${o.canvasWidth}x${o.canvasHeight}:rate=${o.fps}[bg]`,
    `  [0:v]crop=iw:ih-${o.cropTopPx}:0:${o.cropTopPx}[cropped]`,
    `  [cropped]scale=trunc(iw*${scale}/2)*2:trunc(ih*${scale}/2)*2:flags=lanczos[scaled]`,
    `  [scaled]format=yuva420p[scaled_a]`,
    `  [scaled_a]geq=lum='lum(X,Y)':cb='cb(X,Y)':cr='cr(X,Y)':a='${alphaExpr}'[rounded]`,
    `  [bg][rounded]overlay=(W-w)/2:(H-h)/2:format=auto:shortest=1[out]`,
  ]

  return [
    `ffmpeg -i '${inputPath}' \\`,
    `  -filter_complex '`,
    filterLines.join(';\\\n') + `' \\`,
    `  -map '[out]' -map '0:a?' \\`,
    `  -c:v libx264 -preset medium -crf 18 \\`,
    `  -pix_fmt yuv420p -movflags +faststart \\`,
    `  '${outputPath}'`,
  ].join('\n')
}
