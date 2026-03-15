/**
 * FocusEngine — auto-zoom "virtual camera" engine
 *
 * Feed it raw mouse events; call tick() at 60 fps to get the
 * current (x, y, zoom) the compositor should render.
 *
 * All x/y values are **normalized 0–1** relative to the capture display.
 * zoom is a scale factor (1.0 = no zoom, 1.5 = 150 %, etc.)
 */

// ── Public types ────────────────────────────────────────────────────────────

export interface FocusPoint {
  x: number // 0–1
  y: number // 0–1
}

export interface CameraFrame {
  x: number     // 0–1  — center of the virtual viewport
  y: number     // 0–1
  zoom: number  // ≥ 1.0
}

export type EngineState = 'idle' | 'moving' | 'dwelling' | 'focused'

export interface TickResult extends CameraFrame {
  state:    EngineState
  velocity: number      // px/s — instantaneous mouse speed
  target:   FocusPoint  // where the camera is heading
}

export interface EngineConfig {
  /** px of mouse stillness radius before dwell clock starts (default 20) */
  dwellRadius?: number
  /** ms the mouse must stay within dwellRadius to trigger focus (default 500) */
  dwellMs?: number
  /** px/s — above this speed the target is frozen and zoom decreases (default 400) */
  deadZoneSpeed?: number
  /** target zoom while focused (default 1.5) */
  zoomInLevel?: number
  /** higher = faster position smoothing; good range 3–8 (default 5) */
  smoothLambda?: number
  /** higher = faster zoom smoothing; good range 1.5–4 (default 2.5) */
  zoomLambda?: number
  /** display dimensions for velocity normalisation (default 1920 × 1080) */
  displayWidth?: number
  displayHeight?: number
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/**
 * Frame-rate-independent exponential smoothing.
 * `alpha = 1 − e^(−λ·dt)` where dt is in seconds.
 */
function expSmooth(current: number, target: number, lambda: number, dtSec: number) {
  const alpha = 1 - Math.exp(-lambda * dtSec)
  return lerp(current, target, alpha)
}

/** Clamp camera center so the zoomed viewport never overshoots the edges. */
function clampCenter(v: number, zoom: number) {
  const margin = 0.5 / zoom
  return Math.max(margin, Math.min(1 - margin, v))
}

// ── Engine ───────────────────────────────────────────────────────────────────

export class FocusEngine {
  private cfg: Required<EngineConfig>

  // Raw mouse state
  private mouseX = 960
  private mouseY = 540
  private prevX = 960
  private prevY = 540
  private prevTs = Date.now()

  // Velocity (px/s, exponentially smoothed)
  private velocity = 0

  // Dwell tracking — "stable point" the mouse has been near
  private stableX = 960
  private stableY = 540
  private stableTs = Date.now()

  // Virtual camera
  private camX = 0.5
  private camY = 0.5
  private camZoom = 1.0

  // Where camera is heading
  private targetX = 0.5
  private targetY = 0.5
  private targetZoom = 1.0

  private state: EngineState = 'idle'

  constructor(cfg: EngineConfig = {}) {
    this.cfg = {
      dwellRadius:    cfg.dwellRadius    ?? 20,
      dwellMs:        cfg.dwellMs        ?? 500,
      deadZoneSpeed:  cfg.deadZoneSpeed  ?? 400,
      zoomInLevel:    cfg.zoomInLevel    ?? 1.5,
      smoothLambda:   cfg.smoothLambda   ?? 5,
      zoomLambda:     cfg.zoomLambda     ?? 2.5,
      displayWidth:   cfg.displayWidth   ?? 1920,
      displayHeight:  cfg.displayHeight  ?? 1080,
    }

    // Initialise stable point to display center
    this.stableX = this.cfg.displayWidth  / 2
    this.stableY = this.cfg.displayHeight / 2
  }

  // ── Input events ────────────────────────────────────────────────────────

  onMouseMove(x: number, y: number) {
    const now = Date.now()
    const dtSec = Math.max(1, now - this.prevTs) / 1000

    const dx = x - this.prevX
    const dy = y - this.prevY
    const instantV = Math.sqrt(dx * dx + dy * dy) / dtSec

    // Smooth velocity with a fast exponential filter (λ=20 → τ≈50 ms)
    this.velocity = expSmooth(this.velocity, instantV, 20, dtSec)

    // Dwell: if mouse drifted outside the stable radius, reset clock
    const driftSq = (x - this.stableX) ** 2 + (y - this.stableY) ** 2
    if (driftSq > this.cfg.dwellRadius ** 2) {
      this.stableX  = x
      this.stableY  = y
      this.stableTs = now
    }

    this.mouseX = x
    this.mouseY = y
    this.prevX  = x
    this.prevY  = y
    this.prevTs = now
  }

  /**
   * Call on every click (left or right button).
   * Immediately sets the focus target — no dwell wait.
   */
  onMouseClick(x: number, y: number) {
    this.stableX  = x
    this.stableY  = y
    // Pretend the mouse has already been still for dwellMs → instant focus
    this.stableTs = Date.now() - this.cfg.dwellMs

    this.targetX    = x / this.cfg.displayWidth
    this.targetY    = y / this.cfg.displayHeight
    this.targetZoom = this.cfg.zoomInLevel
    this.state      = 'focused'
  }

  // ── Tick (called at ~60 fps) ─────────────────────────────────────────────

  /**
   * Advance the engine by one frame and return the current camera state.
   * @param dtSec  elapsed seconds since last tick (pass undefined to use 1/60)
   */
  tick(dtSec = 1 / 60): TickResult {
    const now   = Date.now()
    const dwell = now - this.stableTs

    // ── State machine ────────────────────────────────────────────────────

    if (this.velocity > this.cfg.deadZoneSpeed) {
      // Fast movement: freeze the focus point, start zooming out
      this.state      = 'moving'
      this.targetZoom = 1.0
      // Gently drift camera target toward the center of the screen
      // so it doesn't stay stuck in a corner while the user pans
      this.targetX = lerp(this.targetX, 0.5, 0.02)
      this.targetY = lerp(this.targetY, 0.5, 0.02)

    } else if (dwell >= this.cfg.dwellMs) {
      // Dwell complete: lock focus
      this.state      = 'focused'
      this.targetX    = this.stableX / this.cfg.displayWidth
      this.targetY    = this.stableY / this.cfg.displayHeight
      this.targetZoom = this.cfg.zoomInLevel

    } else if (this.velocity > 0.5) {
      // Slow movement, dwell clock running
      this.state = 'dwelling'

    } else {
      this.state = 'idle'
    }

    // ── Smooth camera toward target ───────────────────────────────────────

    this.camX    = expSmooth(this.camX,    this.targetX,    this.cfg.smoothLambda, dtSec)
    this.camY    = expSmooth(this.camY,    this.targetY,    this.cfg.smoothLambda, dtSec)
    this.camZoom = expSmooth(this.camZoom, this.targetZoom, this.cfg.zoomLambda,   dtSec)

    // Prevent camera from showing outside the display at current zoom
    const cx = clampCenter(this.camX, this.camZoom)
    const cy = clampCenter(this.camY, this.camZoom)
    this.camX = cx
    this.camY = cy

    return {
      x:        cx,
      y:        cy,
      zoom:     this.camZoom,
      state:    this.state,
      velocity: Math.round(this.velocity),
      target:   { x: this.targetX, y: this.targetY },
    }
  }

  // ── Utility ──────────────────────────────────────────────────────────────

  /** Reset to initial state (e.g. between recordings). */
  reset() {
    const cx = this.cfg.displayWidth  / 2
    const cy = this.cfg.displayHeight / 2
    this.mouseX = cx;  this.mouseY = cy
    this.prevX  = cx;  this.prevY  = cy
    this.stableX = cx; this.stableY = cy
    this.stableTs = Date.now()
    this.velocity = 0
    this.camX = 0.5;  this.camY = 0.5;  this.camZoom = 1.0
    this.targetX = 0.5; this.targetY = 0.5; this.targetZoom = 1.0
    this.state = 'idle'
  }
}
