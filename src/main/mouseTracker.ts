/**
 * MouseTracker — records mouse position via screen.getCursorScreenPoint() at 60 fps,
 * feeds it into FocusEngine, and stores a downsampled camera log (~10 Hz).
 *
 * Also captures global mouse click events and keyboard events via uiohook-napi
 * so the editor can overlay click ripples and key badges on the exported video.
 *
 * Call start() when recording begins, stop() when recording ends.
 * stop() returns the accumulated FocusLogRecord[], ClickEvent[], and KeyEvent[].
 */

import { screen } from 'electron'
import { FocusEngine } from './focusEngine'

// uiohook-napi is an N-API module (ABI stable) — no electron-rebuild needed.
// We use a dynamic require + type-cast to keep TypeScript happy without
// @types/uiohook-napi being available.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const uiohook = (() => {
  try { return require('uiohook-napi') } catch { return null }
})()

export interface FocusLogRecord {
  ts: number            // ms since recording start
  camera: { x: number; y: number; zoom: number }
  mouse: { x: number; y: number }  // logical pixels
  mouseNorm?: { x: number; y: number }  // cursor normalized 0–1 within display
  scaleFactor: number
}

export interface ClickEventRecord {
  ts: number   // ms since recording start
  x: number    // normalized 0–1
  y: number    // normalized 0–1
}

export interface KeyEventRecord {
  ts: number   // ms since recording start
  key: string  // human-readable label, e.g. "⌘C", "Space"
}

// ── Key label helpers ────────────────────────────────────────────────────────

const KEY_NAMES: Record<number, string> = {
  1: 'Esc', 28: 'Enter', 14: '⌫', 57: 'Space',
  15: 'Tab', 58: 'F1', 59: 'F2', 60: 'F3', 61: 'F4',
  62: 'F5', 63: 'F6', 64: 'F7', 65: 'F8', 66: 'F9',
  67: 'F10', 68: 'F11', 87: 'F12',
  71: 'Num Lock', 74: '←', 75: '→', 72: '↑', 80: '↓',
}

function keyLabel(keycode: number, modifiers: number): string {
  const LSHIFT = 1, RSHIFT = 2, LCTRL = 4, RCTRL = 8
  const LALT = 16, RALT = 32, LMETA = 64, RMETA = 128

  const parts: string[] = []
  if (modifiers & (LMETA | RMETA))  parts.push('⌘')
  if (modifiers & (LCTRL | RCTRL))  parts.push('⌃')
  if (modifiers & (LALT  | RALT))   parts.push('⌥')
  if (modifiers & (LSHIFT | RSHIFT)) parts.push('⇧')

  const named = KEY_NAMES[keycode]
  if (named) {
    parts.push(named)
  } else if (keycode >= 2 && keycode <= 13) {
    // Number row 1–0
    parts.push(String.fromCharCode(48 + ((keycode - 1) % 10)))
  } else if (keycode >= 16 && keycode <= 27) {
    // QWERTY top row
    parts.push('QWERTYUIOP'[keycode - 16] ?? '?')
  } else if (keycode >= 30 && keycode <= 40) {
    parts.push('ASDFGHJKL;'[keycode - 30] ?? '?')
  } else if (keycode >= 44 && keycode <= 53) {
    parts.push('ZXCVBNM,./'[keycode - 44] ?? '?')
  } else {
    return ''  // skip unmappable keycodes
  }

  return parts.join('')
}

// ── MouseTracker ──────────────────────────────────────────────────────────────

export class MouseTracker {
  private engine: FocusEngine
  private intervalId: ReturnType<typeof setInterval> | null = null
  private log: FocusLogRecord[] = []
  private clickLog: ClickEventRecord[] = []
  private keyLog: KeyEventRecord[] = []
  private startMs = 0
  private scaleFactor = 1.0

  private displayBoundsW = 1
  private displayBoundsH = 1

  constructor() {
    const primary = screen.getPrimaryDisplay()
    this.scaleFactor = primary.scaleFactor ?? 1
    this.displayBoundsW = primary.bounds.width   // logical pixels
    this.displayBoundsH = primary.bounds.height
    // Physical pixel dimensions
    const dw = Math.round(primary.bounds.width  * this.scaleFactor)
    const dh = Math.round(primary.bounds.height * this.scaleFactor)

    this.engine = new FocusEngine({
      dwellMs:              500,
      dwellRadius:          20,
      deadZoneSpeed:        400,
      zoomInLevel:          1.5,
      smoothLambda:         5,
      zoomLambda:           2.5,
      clickSpeedBoost:      3.0,
      distanceSlowFactor:   4.0,
      clickBoostDurationMs: 600,
      displayWidth:         dw,
      displayHeight:        dh,
    })
  }

  start() {
    this.log = []
    this.clickLog = []
    this.keyLog = []
    this.startMs = Date.now()
    this.engine.reset()

    // ── uiohook: global mouse click + keyboard events ────────────────────────
    if (uiohook) {
      uiohook.uIOhook.on('mousedown', (e: { x: number; y: number; button: number }) => {
        if (e.button !== 1) return  // left button only
        const ts = Date.now() - this.startMs
        const xNorm = e.x / (this.displayBoundsW * this.scaleFactor)
        const yNorm = e.y / (this.displayBoundsH * this.scaleFactor)
        this.clickLog.push({ ts, x: +xNorm.toFixed(5), y: +yNorm.toFixed(5) })
        this.engine.onMouseClick(e.x, e.y)
      })

      uiohook.uIOhook.on('keydown', (e: { keycode: number; ctrlKey: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean }) => {
        const modifiers =
          (e.shiftKey  ? 1  : 0) |
          (e.ctrlKey   ? 4  : 0) |
          (e.altKey    ? 16 : 0) |
          (e.metaKey   ? 64 : 0)
        const label = keyLabel(e.keycode, modifiers)
        if (!label) return
        const ts = Date.now() - this.startMs
        this.keyLog.push({ ts, key: label })
      })

      try { uiohook.uIOhook.start() } catch { /* permission denied or not available */ }
    }

    // ── 60 fps cursor position poll ──────────────────────────────────────────
    let prevX = -1
    let prevY = -1
    let frameCount = 0
    const LOG_EVERY = 6  // log every 6th frame → ~10 Hz at 60 fps

    this.intervalId = setInterval(() => {
      const pt = screen.getCursorScreenPoint()  // logical pixels

      // Feed physical pixels to engine (velocity + normalization)
      const px = pt.x * this.scaleFactor
      const py = pt.y * this.scaleFactor
      if (px !== prevX || py !== prevY) {
        this.engine.onMouseMove(px, py)
        prevX = px
        prevY = py
      }

      const result = this.engine.tick(1 / 60)
      frameCount++

      if (frameCount % LOG_EVERY === 0) {
        this.log.push({
          ts:          Date.now() - this.startMs,
          camera:      { x: +result.x.toFixed(4), y: +result.y.toFixed(4), zoom: +result.zoom.toFixed(3) },
          mouse:       { x: pt.x, y: pt.y },
          mouseNorm:   { x: +(pt.x / this.displayBoundsW).toFixed(5), y: +(pt.y / this.displayBoundsH).toFixed(5) },
          scaleFactor: this.scaleFactor,
        })
      }
    }, Math.round(1000 / 60))
  }

  stop(): { focusLog: FocusLogRecord[]; clickLog: ClickEventRecord[]; keyLog: KeyEventRecord[] } {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    if (uiohook) {
      try { uiohook.uIOhook.stop() } catch { /* ignore */ }
      uiohook.uIOhook.removeAllListeners('mousedown')
      uiohook.uIOhook.removeAllListeners('keydown')
    }
    return {
      focusLog:  [...this.log],
      clickLog:  [...this.clickLog],
      keyLog:    [...this.keyLog],
    }
  }
}
