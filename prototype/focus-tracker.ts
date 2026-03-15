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

// Resolve the engine one level up (works whether running via ts-node or tsc)
import { FocusEngine, TickResult } from '../src/main/focusEngine'

// ── Display info ─────────────────────────────────────────────────────────────

// When running as plain Node (ts-node), electron.screen isn't available.
// Fall back to a common resolution; replace with your actual display size.
let DISPLAY_W = 1920
let DISPLAY_H = 1080

try {
  const primary = screen.getPrimaryDisplay()
  DISPLAY_W = primary.bounds.width
  DISPLAY_H = primary.bounds.height
  console.log(`Display: ${DISPLAY_W}×${DISPLAY_H} (from Electron screen API)`)
} catch {
  console.log(`Display: ${DISPLAY_W}×${DISPLAY_H} (fallback — set manually if wrong)`)
}

// ── Engine setup ─────────────────────────────────────────────────────────────

const engine = new FocusEngine({
  dwellMs:       500,    // ms of stillness → trigger focus
  dwellRadius:   20,     // px — stillness radius
  deadZoneSpeed: 400,    // px/s — above this: freeze focus, zoom out
  zoomInLevel:   1.5,    // zoom factor when focused
  smoothLambda:  5,      // position smoothing speed
  zoomLambda:    2.5,    // zoom smoothing speed
  displayWidth:  DISPLAY_W,
  displayHeight: DISPLAY_H,
})

// ── Log file ──────────────────────────────────────────────────────────────────

const LOG_PATH = path.join(__dirname, 'focus-log.ndjson')
const logStream = fs.createWriteStream(LOG_PATH, { flags: 'a' })
console.log(`Logging to: ${LOG_PATH}`)

function writeLog(frame: TickResult & { mouseX: number; mouseY: number }) {
  const record = {
    ts:       Date.now(),
    state:    frame.state,
    mouse:    { x: frame.mouseX, y: frame.mouseY },
    target:   { x: +frame.target.x.toFixed(4), y: +frame.target.y.toFixed(4) },
    camera:   { x: +frame.x.toFixed(4),        y: +frame.y.toFixed(4), zoom: +frame.zoom.toFixed(3) },
    velocity: frame.velocity,
  }
  logStream.write(JSON.stringify(record) + '\n')
}

// ── Console renderer ──────────────────────────────────────────────────────────

const STATE_COLORS: Record<string, string> = {
  idle:     '\x1b[90m',   // grey
  dwelling: '\x1b[33m',   // yellow
  focused:  '\x1b[32m',   // green
  moving:   '\x1b[36m',   // cyan
}
const RESET = '\x1b[0m'

let frameCount = 0
let lastPrintTs = 0

function printFrame(frame: TickResult, mouseX: number, mouseY: number) {
  // Only print every ~6 frames (~10 Hz) to keep the terminal readable
  const now = Date.now()
  if (now - lastPrintTs < 100) return
  lastPrintTs = now

  const col   = STATE_COLORS[frame.state] ?? ''
  const zoom  = frame.zoom.toFixed(2)
  const cx    = (frame.x * 100).toFixed(1).padStart(5)
  const cy    = (frame.y * 100).toFixed(1).padStart(5)
  const tx    = (frame.target.x * 100).toFixed(1).padStart(5)
  const ty    = (frame.target.y * 100).toFixed(1).padStart(5)
  const vel   = String(frame.velocity).padStart(5)
  const mx    = String(mouseX).padStart(4)
  const my    = String(mouseY).padStart(4)
  const state = frame.state.padEnd(8)

  process.stdout.write(
    `\r${col}[${state}]${RESET}` +
    `  mouse(${mx},${my})` +
    `  vel=${vel}px/s` +
    `  target(${tx}%,${ty}%)` +
    `  cam(${cx}%,${cy}%)` +
    `  zoom=×${zoom}   `
  )
}

// ── Mouse tracking via uiohook-napi ───────────────────────────────────────────

let latestMouseX = DISPLAY_W / 2
let latestMouseY = DISPLAY_H / 2

uIOhook.on('mousemove', (e: UiohookMouseEvent) => {
  latestMouseX = e.x
  latestMouseY = e.y
  engine.onMouseMove(e.x, e.y)
})

uIOhook.on('mousedown', (e: UiohookMouseEvent) => {
  engine.onMouseClick(e.x, e.y)
})

uIOhook.start()
console.log('Mouse tracking started. Move the mouse or click. Ctrl+C to quit.\n')

// ── 60 fps tick loop ──────────────────────────────────────────────────────────

const FPS        = 60
const FRAME_MS   = 1000 / FPS
const LOG_EVERY  = 6          // write to JSON every N frames (~10 Hz)

const intervalId = setInterval(() => {
  const frame = engine.tick(FRAME_MS / 1000)
  frameCount++

  printFrame(frame, latestMouseX, latestMouseY)

  if (frameCount % LOG_EVERY === 0) {
    writeLog({ ...frame, mouseX: latestMouseX, mouseY: latestMouseY })
  }
}, FRAME_MS)

// ── Graceful shutdown ─────────────────────────────────────────────────────────

function shutdown() {
  clearInterval(intervalId)
  uIOhook.stop()
  logStream.end()
  console.log(`\n\nStopped. ${frameCount} frames logged → ${LOG_PATH}`)
  process.exit(0)
}

process.on('SIGINT',  shutdown)
process.on('SIGTERM', shutdown)
