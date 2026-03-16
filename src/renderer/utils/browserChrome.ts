/**
 * browserChrome.ts
 *
 * Browser-name-based detection of toolbar (chrome) height and calculation of
 * the web-content CaptureRegion.
 *
 * Why two phases exist in the app:
 *   Phase 1 – source selected (no stream yet): thumbnail-variance analysis in
 *             detectWindowContentRegion() gives a first estimate.
 *   Phase 2 – stream acquired: calcBrowserContentRegion() here uses the exact
 *             physical pixel resolution of the stream together with the constant
 *             table below for a pixel-accurate crop.  It overrides Phase 1 when
 *             the browser is identified.
 *
 * All heights are in LOGICAL CSS pixels at 1× display scaling.
 * Physical pixel offset = logicalHeight × scaleFactor.
 */

import type { CaptureRegion } from '../types'

// ─── Browser type enum ───────────────────────────────────────────────────────

export type BrowserType =
  | 'chrome'
  | 'safari'
  | 'firefox'
  | 'edge'
  | 'arc'
  | 'brave'
  | 'opera'
  | 'vivaldi'
  | 'unknown'

// ─── Constant table ──────────────────────────────────────────────────────────

export interface BrowserChromeInfo {
  readonly type: BrowserType
  /**
   * Height of the primary toolbar strip in logical pixels.
   * Includes: native title bar (if any) + tab bar + address/URL bar.
   * Excludes the bookmarks bar (handled separately below).
   */
  readonly toolbarHeight: number
  /**
   * Additional height added when the bookmarks bar is visible.
   * Pass includeBookmarksBar=true to calcBrowserContentRegion() to add this.
   */
  readonly bookmarksBarHeight: number
}

/**
 * Approximate toolbar heights at 1× logical pixel scale (macOS values).
 * Windows values are similar; the scaleFactor argument compensates for HiDPI.
 *
 *  Chrome/Brave/Edge  tab bar ≈ 36 px  +  address bar ≈ 56 px  = 92 px
 *  Firefox            tab bar ≈ 37 px  +  address bar ≈ 59 px  = 96 px
 *  Safari             combined compact toolbar                  = 72 px
 *  Arc                sidebar-based; top bar only               = 52 px
 *  Vivaldi/Opera      extra menus/tabs                         = 105 / 98 px
 */
export const BROWSER_CHROME_TABLE: Readonly<Record<BrowserType, BrowserChromeInfo>> = {
  chrome:  { type: 'chrome',  toolbarHeight: 92,  bookmarksBarHeight: 37 },
  edge:    { type: 'edge',    toolbarHeight: 92,  bookmarksBarHeight: 37 },
  brave:   { type: 'brave',   toolbarHeight: 92,  bookmarksBarHeight: 37 },
  vivaldi: { type: 'vivaldi', toolbarHeight: 105, bookmarksBarHeight: 37 },
  opera:   { type: 'opera',   toolbarHeight: 98,  bookmarksBarHeight: 37 },
  firefox: { type: 'firefox', toolbarHeight: 96,  bookmarksBarHeight: 37 },
  safari:  { type: 'safari',  toolbarHeight: 72,  bookmarksBarHeight: 30 },
  arc:     { type: 'arc',     toolbarHeight: 52,  bookmarksBarHeight: 0  },
  unknown: { type: 'unknown', toolbarHeight: 100, bookmarksBarHeight: 0  },
}

// ─── Browser detection ───────────────────────────────────────────────────────

/**
 * Identify the browser type from the window source name reported by
 * desktopCapturer.  Returns 'unknown' when no known browser is matched.
 *
 * Order matters: check for more specific names (Arc, Brave, Vivaldi) before
 * the generic Chromium/Chrome match to avoid false positives.
 */
export function detectBrowserType(sourceName: string): BrowserType {
  const n = sourceName.toLowerCase()
  if (n.includes('arc'))                                            return 'arc'
  if (n.includes('brave'))                                         return 'brave'
  if (n.includes('vivaldi'))                                       return 'vivaldi'
  if (n.includes('opera'))                                         return 'opera'
  if (n.includes('edge') || n.includes('microsoft edge'))          return 'edge'
  if (n.includes('chrome') || n.includes('chromium') ||
      n.includes('google chrome'))                                  return 'chrome'
  if (n.includes('firefox') || n.includes('mozilla'))             return 'firefox'
  if (n.includes('safari'))                                        return 'safari'
  return 'unknown'
}

// ─── Content region calculation ──────────────────────────────────────────────

/**
 * Calculate the web-content CaptureRegion for a captured browser window.
 *
 * The returned coordinates are normalised 0–1 fractions of the stream
 * dimensions, matching the CaptureRegion convention used throughout the app.
 *
 * @param sourceName         Window title from desktopCapturer (e.g. "Google Chrome")
 * @param streamWidth        Physical pixel width  reported by videoTrack.getSettings()
 * @param streamHeight       Physical pixel height reported by videoTrack.getSettings()
 * @param scaleFactor        Display device pixel ratio (1 = non-Retina, 2 = Retina)
 * @param includeBookmarksBar  Add bookmarks-bar height on top of the toolbar
 * @returns CaptureRegion or null when the source is not a recognised browser
 */
export function calcBrowserContentRegion(
  sourceName: string,
  streamWidth: number,
  streamHeight: number,
  scaleFactor: number,
  includeBookmarksBar = true,
): CaptureRegion | null {
  const type = detectBrowserType(sourceName)
  if (type === 'unknown') return null   // not a recognised browser

  const info = BROWSER_CHROME_TABLE[type]
  const logicalOffset = info.toolbarHeight +
    (includeBookmarksBar ? info.bookmarksBarHeight : 0)

  // Convert logical pixels → physical pixels used by the capture stream
  const physicalOffset = Math.round(logicalOffset * scaleFactor)

  // Guard: don't crop more than 40% of the frame (same limit as thumbnail path)
  if (physicalOffset <= 0 || physicalOffset >= streamHeight * 0.40) return null

  const y = physicalOffset / streamHeight
  return { x: 0, y, w: 1, h: 1 - y }
}
