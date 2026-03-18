/**
 * FocusEngine — auto-zoom "virtual camera" engine
 *
 * Feed it raw mouse events; call tick() at 60 fps to get the
 * current (x, y, zoom) the compositor should render.
 *
 * All x/y values are **normalized 0–1** relative to the capture display.
 * zoom is a scale factor (1.0 = no zoom, 1.5 = 150 %, etc.)
 *
 * ── Dynamic speed model ───────────────────────────────────────────────────────
 *
 *  • Click    → camera snaps quickly to click position  (λ boosted by clickSpeedBoost)
 *  • Far dwell → camera pans slowly across the screen   (λ reduced by distance)
 *  • Near dwell / already close → normal speed
 *
 *  Lambda multiplier (M):
 *    Click:   M = clickSpeedBoost (e.g., 3.0)  →  fades back to 1.0 over clickBoostDurationMs
 *    Dwell:   M = 1 / (1 + camDist × distanceSlowFactor)
 *               camDist=0.0 → M=1.0 (normal),  camDist=0.5 → M≈0.33 (slow),  camDist=0.7 → M≈0.22 (very slow)
 *
 *  Effective lambdas used each tick:
 *    smoothLambda × M  (position)
 *    zoomLambda   × M  (zoom)
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

/** What caused the current focus target to be set. */
export type TriggerType = 'click' | 'dwell' | null

export interface TickResult extends CameraFrame {
  state:       EngineState
  velocity:    number       // px/s — instantaneous mouse speed
  target:      FocusPoint   // where the camera is heading
  triggerType: TriggerType  // what triggered the current focus
  lambdaMult:  number       // current lambda multiplier (diagnostic; also written to log)
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
  /** baseline position smoothing speed; good range 3–8 (default 5) */
  smoothLambda?: number
  /** baseline zoom smoothing speed; good range 1.5–4 (default 2.5) */
  zoomLambda?: number
  /** display dimensions for velocity normalization (default 1920 × 1080) */
  displayWidth?: number
  displayHeight?: number
  /**
   * Lambda multiplier applied immediately after a click.
   * Higher = camera snaps more quickly to the click point.  (default 3.0)
   */
  clickSpeedBoost?: number
  /**
   * How strongly the camera-to-target distance reduces zoom speed.
   * effectiveLambda = baseLambda / (1 + dist × factor)
   * where dist is Euclidean distance in 0–1 space.
   * Higher = slower pan over large distances.  (default 4.0)
   */
  distanceSlowFactor?: number
  /**
   * Duration in ms over which the click boost fades back to normal.  (default 600)
   */
  clickBoostDurationMs?: number
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t
}

/**
 * Frame-rate-independent exponential smoothing.
 * alpha = 1 − e^(−λ·dt), where dt is in seconds.
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
  private prevState: EngineState = 'idle'

  // ── Dynamic speed state ────────────────────────────────────────────────────
  private triggerType: TriggerType = null
  /**
   * Countdown (ms) for click boost.
   * Starts at clickBoostDurationMs on each click, ticks down to 0.
   */
  private clickBoostRemaining = 0

  constructor(cfg: EngineConfig = {}) {
    this.cfg = {
      dwellRadius:          cfg.dwellRadius          ?? 20,
      dwellMs:              cfg.dwellMs              ?? 500,
      deadZoneSpeed:        cfg.deadZoneSpeed        ?? 400,
      zoomInLevel:          cfg.zoomInLevel          ?? 1.5,
      smoothLambda:         cfg.smoothLambda         ?? 5,
      zoomLambda:           cfg.zoomLambda           ?? 2.5,
      displayWidth:         cfg.displayWidth         ?? 1920,
      displayHeight:        cfg.displayHeight        ?? 1080,
      clickSpeedBoost:      cfg.clickSpeedBoost      ?? 3.0,
      distanceSlowFactor:   cfg.distanceSlowFactor   ?? 4.0,
      clickBoostDurationMs: cfg.clickBoostDurationMs ?? 600,
    }

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

    // Smooth velocity with a fast filter (λ=20 → τ≈50 ms)
    this.velocity = expSmooth(this.velocity, instantV, 20, dtSec)

    // Dwell: reset stable clock when mouse drifts outside radius
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
   * Call on every click.
   * Immediately sets the focus target (no dwell wait) and
   * activates the click-speed boost so the camera snaps quickly.
   */
  onMouseClick(x: number, y: number) {
    this.stableX  = x
    this.stableY  = y
    this.stableTs = Date.now() - this.cfg.dwellMs

    this.targetX    = x / this.cfg.displayWidth
    this.targetY    = y / this.cfg.displayHeight
    this.targetZoom = this.cfg.zoomInLevel
    this.state      = 'focused'

    // Activate click boost
    this.clickBoostRemaining = this.cfg.clickBoostDurationMs
    this.triggerType         = 'click'
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

    this.prevState = this.state

    if (this.velocity > this.cfg.deadZoneSpeed) {
      this.state      = 'moving'
      this.targetZoom = 1.0
      this.targetX    = lerp(this.targetX, 0.5, 0.02)
      this.targetY    = lerp(this.targetY, 0.5, 0.02)

    } else if (dwell >= this.cfg.dwellMs) {
      this.state      = 'focused'
      this.targetX    = this.stableX / this.cfg.displayWidth
      this.targetY    = this.stableY / this.cfg.displayHeight
      this.targetZoom = this.cfg.zoomInLevel

      // Mark trigger as dwell on the first frame we enter focused via dwell
      if (this.prevState !== 'focused' && this.triggerType !== 'click') {
        this.triggerType = 'dwell'
      }

    } else if (this.velocity > 0.5) {
      this.state = 'dwelling'
    } else {
      this.state = 'idle'
    }

    // ── Dynamic lambda multiplier ────────────────────────────────────────
    //
    //  Tick down the click boost timer.
    //  After it expires, switch to the distance-based slow model.

    const dtMs = dtSec * 1000
    this.clickBoostRemaining = Math.max(0, this.clickBoostRemaining - dtMs)

    let lambdaMult: number

    if (this.clickBoostRemaining > 0) {
      // Click boost: fade from clickSpeedBoost → 1.0 over the last 200 ms
      const fadeRatio = Math.min(1, this.clickBoostRemaining / 200)
      lambdaMult = 1 + (this.cfg.clickSpeedBoost - 1) * fadeRatio
    } else {
      // Distance-based slowdown:
      //   lambdaMult = 1 / (1 + camDist × distanceSlowFactor)
      //   Far target  → small M → slow pan (ease-in like behaviour)
      //   Near target → M → 1   → normal speed (natural ease-out)
      const camDist = Math.sqrt(
        (this.camX - this.targetX) ** 2 +
        (this.camY - this.targetY) ** 2
      )
      lambdaMult = 1 / (1 + camDist * this.cfg.distanceSlowFactor)
    }

    // ── Smooth camera toward target (with dynamic lambdas) ─────────────

    const effSmooth = this.cfg.smoothLambda * lambdaMult
    const effZoom   = this.cfg.zoomLambda   * lambdaMult

    this.camX    = expSmooth(this.camX,    this.targetX,    effSmooth, dtSec)
    this.camY    = expSmooth(this.camY,    this.targetY,    effSmooth, dtSec)
    this.camZoom = expSmooth(this.camZoom, this.targetZoom, effZoom,   dtSec)

    // Prevent camera from showing outside the display at current zoom
    const cx = clampCenter(this.camX, this.camZoom)
    const cy = clampCenter(this.camY, this.camZoom)
    this.camX = cx
    this.camY = cy

    return {
      x:           cx,
      y:           cy,
      zoom:        this.camZoom,
      state:       this.state,
      velocity:    Math.round(this.velocity),
      target:      { x: this.targetX, y: this.targetY },
      triggerType: this.triggerType,
      lambdaMult:  Math.round(lambdaMult * 100) / 100,
    }
  }

  // ── Utility ──────────────────────────────────────────────────────────────

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
    this.triggerType = null
    this.clickBoostRemaining = 0
  }
}
