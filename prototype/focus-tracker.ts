/**
 * focus-tracker.ts — standalone prototype for the FocusEngine
 *
 * Tracks global mouse position & clicks via uiohook-napi,
 * runs the FocusEngine at 60 fps, and streams results to:
 *   • stdout  (human-readable table)
 *   • focus-log.ndjson  (newline-delimited JSON for post-processing)
 *
 * ── Setup ───────────────────────────────────────────────────────────────────
 *
 *   cd prototype
 *   npm install
 *   npm start
 *
 * Press Ctrl+C to stop.  The log file will be written to ./focus-log.ndjson.
 * ────────────────────────────────────────────────────────────────────────────
 */

import { uIOhook, UiohookMouseEvent } from 'uiohook-napi'
import * as fs   from 'fs'
import * as path from 'path'
import { screen } from 'electron'

import { FocusEngine, TickResult } from '../src/main/focusEngine'

// ── Display info ──────────────────────────────────────────────────────────────
//
// We need PHYSICAL pixel dimensions for the FocusEngine so that:
//   • Velocity is in physical px/s (matches video frame pixels)
//   • Normalised camera coords map correctly to the recorded video
//
// On macOS Retina: logical pixels = 1440, physical = 2880  (scaleFactor = 2)
// On Windows HiDPI: similar relationship
//
// The log's mouse.x/y are in LOGICAL pixels (getCursorScreenPoint returns logical).
// auto_zoom.py must multiply them by scaleFactor to get video pixel coords.

let DISPLAY_W  = 1920   // physical pixels
let DISPLAY_H  = 1080
let SCALE_FACTOR = 1.0  // logical → physical

try {
  const primary = screen.getPrimaryDisplay()
  SCALE_FACTOR = primary.scaleFactor ?? 1
  // Use the SIZE property (physical) if available, otherwise scale bounds
  const phys = primary.size ?? primary.bounds
  DISPLAY_W = Math.round(phys.width  * (primary.size ? 1 : SCALE_FACTOR))
  DISPLAY_H = Math.round(phys.height * (primary.size ? 1 : SCALE_FACTOR))
  console.log(
    `Display: ${DISPLAY_W}×${DISPLAY_H} physical  ` +
    `(${primary.bounds.width}×${primary.bounds.height} logical  ×${SCALE_FACTOR})`
  )
} catch {
  console.log(`Display: ${DISPLAY_W}×${DISPLAY_H} (fallback — edit if wrong)`)
}

// ── Engine setup ──────────────────────────────────────────────────────────────

const engine = new FocusEngine({
  dwellMs:              500,
  dwellRadius:          20,
  deadZoneSpeed:        400,
  zoomInLevel:          1.5,
  smoothLambda:         5,
  zoomLambda:           2.5,
  clickSpeedBoost:      3.0,   // camera snaps 3× faster on click
  distanceSlowFactor:   4.0,   // large pan → slow zoom
  clickBoostDurationMs: 600,
  displayWidth:         DISPLAY_W,
  displayHeight:        DISPLAY_H,
})

// ── Log file ──────────────────────────────────────────────────────────────────

const LOG_PATH  = path.join(__dirname, 'focus-log.ndjson')
const logStream = fs.createWriteStream(LOG_PATH, { flags: 'a' })
console.log(`Logging to: ${LOG_PATH}`)

function writeLog(frame: TickResult & { mouseX: number; mouseY: number }) {
  const record = {
    ts:          Date.now(),
    state:       frame.state,
    triggerType: frame.triggerType,           // 'click' | 'dwell' | null
    lambdaMult:  frame.lambdaMult,            // current speed multiplier
    scaleFactor: SCALE_FACTOR,                // Retina: logical→physical ratio
    mouse:       { x: frame.mouseX, y: frame.mouseY },   // LOGICAL pixels
    target:      { x: +frame.target.x.toFixed(4), y: +frame.target.y.toFixed(4) },
    camera:      { x: +frame.x.toFixed(4),   y: +frame.y.toFixed(4), zoom: +frame.zoom.toFixed(3) },
    velocity:    frame.velocity,
  }
  logStream.write(JSON.stringify(record) + '\n')
}

// ── Console renderer ──────────────────────────────────────────────────────────

const STATE_COLORS: Record<string, string> = {
  idle:     '\x1b[90m',
  dwelling: '\x1b[33m',
  focused:  '\x1b[32m',
  moving:   '\x1b[36m',
}
const RESET = '\x1b[0m'

let frameCount  = 0
let lastPrintTs = 0

function printFrame(frame: TickResult, mouseX: number, mouseY: number) {
  const now = Date.now()
  if (now - lastPrintTs < 100) return
  lastPrintTs = now

  const col     = STATE_COLORS[frame.state] ?? ''
  const trigger = frame.triggerType ? `[${frame.triggerType[0].toUpperCase()}]` : '   '
  const mult    = `×${frame.lambdaMult.toFixed(2)}`.padStart(6)
  const zoom    = frame.zoom.toFixed(2)
  const cx      = (frame.x * 100).toFixed(1).padStart(5)
  const cy      = (frame.y * 100).toFixed(1).padStart(5)
  const vel     = String(frame.velocity).padStart(5)
  const state   = frame.state.padEnd(8)

  process.stdout.write(
    `\r${col}[${state}]${RESET}` +
    `${trigger} λ${mult}` +
    `  mouse(${mouseX},${mouseY})` +
    `  vel=${vel}px/s` +
    `  cam(${cx}%,${cy}%)` +
    `  zoom=×${zoom}   `
  )
}

// ── Mouse tracking ────────────────────────────────────────────────────────────

let latestMouseX = Math.round(DISPLAY_W / SCALE_FACTOR / 2)
let latestMouseY = Math.round(DISPLAY_H / SCALE_FACTOR / 2)

uIOhook.on('mousemove', (e: UiohookMouseEvent) => {
  latestMouseX = e.x
  latestMouseY = e.y
  // Convert logical → physical for engine (velocity, normalisation)
  engine.onMouseMove(e.x * SCALE_FACTOR, e.y * SCALE_FACTOR)
})

uIOhook.on('mousedown', (e: UiohookMouseEvent) => {
  engine.onMouseClick(e.x * SCALE_FACTOR, e.y * SCALE_FACTOR)
})

uIOhook.start()
console.log('Mouse tracking active. Move the mouse or click. Ctrl+C to quit.\n')

// ── 60 fps tick loop ──────────────────────────────────────────────────────────

const FPS      = 60
const FRAME_MS = 1000 / FPS
const LOG_EVERY = 6    // ~10 Hz log

const intervalId = setInterval(() => {
  const frame = engine.tick(FRAME_MS / 1000)
  frameCount++

  printFrame(frame, latestMouseX, latestMouseY)

  if (frameCount % LOG_EVERY === 0) {
    writeLog({ ...frame, mouseX: latestMouseX, mouseY: latestMouseY })
  }
}, FRAME_MS)

// ── Shutdown ──────────────────────────────────────────────────────────────────

function shutdown() {
  clearInterval(intervalId)
  uIOhook.stop()
  logStream.end()
  console.log(`\n\nStopped. ${frameCount} frames  →  ${LOG_PATH}`)
  process.exit(0)
}

process.on('SIGINT',  shutdown)
process.on('SIGTERM', shutdown)
