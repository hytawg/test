/**
 * MouseTracker — records mouse position via screen.getCursorScreenPoint() at 60 fps,
 * feeds it into FocusEngine, and stores a downsampled camera log (~10 Hz).
 *
 * Call start() when recording begins, stop() when recording ends.
 * stop() returns the accumulated FocusLogRecord[].
 */

import { screen } from 'electron'
import { FocusEngine } from './focusEngine'

export interface FocusLogRecord {
  ts: number            // ms since recording start
  camera: { x: number; y: number; zoom: number }
  mouse: { x: number; y: number }  // logical pixels
  scaleFactor: number
}

export class MouseTracker {
  private engine: FocusEngine
  private intervalId: ReturnType<typeof setInterval> | null = null
  private log: FocusLogRecord[] = []
  private startMs = 0
  private scaleFactor = 1.0

  constructor() {
    const primary = screen.getPrimaryDisplay()
    this.scaleFactor = primary.scaleFactor ?? 1
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
    this.startMs = Date.now()
    this.engine.reset()

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
          scaleFactor: this.scaleFactor,
        })
      }
    }, Math.round(1000 / 60))
  }

  stop(): FocusLogRecord[] {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    return [...this.log]
  }
}
