export type CaptureSource = {
  id: string
  name: string
  thumbnailDataURL: string
  appIconDataURL: string | null
  display_id: string
}

export type DisplayInfo = {
  id: number
  label: string
  bounds: { x: number; y: number; width: number; height: number }
  scaleFactor: number
  isPrimary: boolean
}

export type CameraPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' | 'custom'
export type CameraShape = 'circle' | 'rounded' | 'square'
export type BackgroundType = 'gradient' | 'solid' | 'wallpaper' | 'image' | 'blur' | 'none'
export type AspectRatio = '16:9' | '4:3' | '1:1' | '9:16' | 'fill'
export type RecordingFormat = 'mp4' | 'webm' | 'gif'
export type RecordingQuality = 'high' | 'medium' | 'low'

export type GradientPreset = {
  id: string
  name: string
  value: string
}

export type WallpaperPreset = {
  id: string
  name: string
  css: string
}

export type CanvasSettings = {
  padding: number
  cornerRadius: number
  shadowEnabled: boolean
  shadowIntensity: number
  backgroundType: BackgroundType
  backgroundGradient: string
  backgroundColor: string
  backgroundWallpaper: string
  backgroundImageDataUrl: string | null
  backgroundImagePath: string | null
  aspectRatio: AspectRatio
  showWallpaper: boolean
}

export type CameraSettings = {
  enabled: boolean
  deviceId: string | null
  position: CameraPosition
  shape: CameraShape
  size: number // percentage of canvas width
  x: number // custom x (0-100%)
  y: number // custom y (0-100%)
  borderEnabled: boolean
  borderColor: string
  borderWidth: number
  mirrorEnabled: boolean
}

export type AudioSettings = {
  micEnabled: boolean
  micDeviceId: string | null
  systemAudioEnabled: boolean
  micVolume: number
}

export type RecordingSettings = {
  format: RecordingFormat
  quality: RecordingQuality
  fps: number
  saveLocation: 'dialog' | 'downloads'
}

export type AppState = {
  captureSource: CaptureSource | null
  canvas: CanvasSettings
  camera: CameraSettings
  audio: AudioSettings
  recording: RecordingSettings
  recordingState: 'idle' | 'countdown' | 'recording' | 'paused' | 'processing'
  recordingDuration: number
  activePanel: 'source' | 'canvas' | 'camera' | 'audio' | 'export' | 'files'
}

export type RecordingHistoryEntry = {
  id: string
  filePath: string
  fileName: string
  savedAt: number       // Unix timestamp ms
  durationSec: number
  format: string        // 'mp4' | 'webm' | 'gif'
}

export const WALLPAPER_PRESETS: WallpaperPreset[] = [
  { id: 'big-sur',   name: 'Big Sur',   css: 'radial-gradient(ellipse at 75% 110%, #f7971e 0%, #ffd200 25%, #ff6b6b 55%, #c44dff 100%)' },
  { id: 'monterey',  name: 'Monterey',  css: 'radial-gradient(ellipse at 25% 75%, #0052d4 0%, #4364f7 45%, #6fb1fc 100%)' },
  { id: 'ventura',   name: 'Ventura',   css: 'radial-gradient(ellipse at 60% 40%, #0d0221 0%, #3a0d6e 40%, #0d1b6e 70%, #000814 100%)' },
  { id: 'sonoma',    name: 'Sonoma',    css: 'radial-gradient(ellipse at 50% 110%, #f8a44c 0%, #ffd580 30%, #ffe5b4 60%, #d4b896 100%)' },
  { id: 'sequoia',   name: 'Sequoia',   css: 'radial-gradient(ellipse at 50% 100%, #0f4c2a 0%, #2d7a4f 40%, #6abf8a 70%, #b8dfc8 100%)' },
  { id: 'high-sierra', name: 'High Sierra', css: 'radial-gradient(ellipse at 50% 100%, #b8cce8 0%, #7ba7d4 35%, #3d6fa8 65%, #1a3a5c 100%)' },
  { id: 'mojave-day',  name: 'Mojave Day',  css: 'radial-gradient(ellipse at 30% 80%, #e8a44a 0%, #d4762a 30%, #8b4513 60%, #3d1f0a 100%)' },
  { id: 'mojave-night', name: 'Mojave Night', css: 'radial-gradient(ellipse at 30% 90%, #1a0a00 0%, #3d1f0a 30%, #1a1a3e 60%, #0a0a1a 100%)' },
]

export const GRADIENT_PRESETS: GradientPreset[] = [
  { id: 'aurora', name: 'Aurora', value: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 'sunset', name: 'Sunset', value: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { id: 'ocean', name: 'Ocean', value: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' },
  { id: 'forest', name: 'Forest', value: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' },
  { id: 'midnight', name: 'Midnight', value: 'linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)' },
  { id: 'peach', name: 'Peach', value: 'linear-gradient(135deg, #ffecd2 0%, #fcb69f 100%)' },
  { id: 'lavender', name: 'Lavender', value: 'linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)' },
  { id: 'candy', name: 'Candy', value: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)' },
  { id: 'indigo', name: 'Indigo', value: 'linear-gradient(135deg, #4776e6 0%, #8e54e9 100%)' },
  { id: 'emerald', name: 'Emerald', value: 'linear-gradient(135deg, #0ba360 0%, #3cba92 100%)' },
  { id: 'rose', name: 'Rose', value: 'linear-gradient(135deg, #ee9ca7 0%, #ffdde1 100%)' },
  { id: 'cosmic', name: 'Cosmic', value: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' },
  // Extended presets
  { id: 'blossom', name: 'Blossom', value: 'linear-gradient(135deg, #ffc3d0 0%, #ffb3c1 30%, #ffe4e9 70%, #fff0f3 100%)' },
  { id: 'dusk', name: 'Dusk', value: 'linear-gradient(135deg, #f5a4a4 0%, #f0b8b2 50%, #f5d0c8 100%)' },
  { id: 'ice', name: 'Ice', value: 'linear-gradient(135deg, #cce7ff 0%, #ddf0ff 50%, #eef8ff 100%)' },
  { id: 'haze', name: 'Haze', value: 'linear-gradient(135deg, #e8d5f5 0%, #f2ddf9 50%, #f8eeff 100%)' },
  { id: 'rainforest', name: 'Rainforest', value: 'radial-gradient(ellipse at 70% 30%, #0f4c29 0%, #2d7a4f 40%, #52b788 70%, #b7e4c7 100%)' },
  { id: 'sapphire', name: 'Sapphire', value: 'linear-gradient(135deg, #1a3a8f 0%, #1e4fc4 50%, #2d6ae0 100%)' },
  { id: 'citrus', name: 'Citrus', value: 'radial-gradient(ellipse at 50% 110%, #e85d04 0%, #f48c06 35%, #faa307 65%, #ffba08 100%)' },
  { id: 'nebula', name: 'Nebula', value: 'radial-gradient(ellipse at 30% 60%, #6a0572 0%, #9b2699 40%, #c77dff 70%, #4361ee 100%)' },
  { id: 'void', name: 'Void', value: 'linear-gradient(135deg, #11023b 0%, #200060 50%, #100040 100%)' },
  { id: 'ember', name: 'Ember', value: 'linear-gradient(135deg, #230000 0%, #4a0a0a 50%, #200505 100%)' },
  { id: 'wisteria', name: 'Wisteria', value: 'linear-gradient(135deg, #b8b8e8 0%, #c8c8f5 50%, #e0e0ff 100%)' },
  { id: 'flame', name: 'Flame', value: 'radial-gradient(ellipse at 30% 40%, #d62828 0%, #f77f00 50%, #fcbf49 100%)' },
  { id: 'denim', name: 'Denim', value: 'linear-gradient(150deg, #1a237e 0%, #283593 33%, #1a237e 66%, #0d1242 100%)' },
  { id: 'tangerine', name: 'Tangerine', value: 'radial-gradient(ellipse at 20% 50%, #ff6d00 0%, #ff9100 35%, #ffab40 65%, #ffd180 100%)' },
  { id: 'sky', name: 'Sky', value: 'linear-gradient(135deg, #48cae4 0%, #90e0ef 50%, #caf0f8 100%)' },
  { id: 'mandarin', name: 'Mandarin', value: 'linear-gradient(135deg, #f77f00 0%, #fcbf49 50%, #ffd166 100%)' },
  { id: 'spearmint', name: 'Spearmint', value: 'linear-gradient(135deg, #52d68a 0%, #a8efcd 50%, #ccffe5 100%)' },
  { id: 'abyss', name: 'Abyss', value: 'linear-gradient(135deg, #000428 0%, #002060 50%, #001540 100%)' },
  { id: 'slate', name: 'Slate', value: 'linear-gradient(135deg, #2c2c2e 0%, #3a3a3c 50%, #4a4a4c 100%)' },
  { id: 'garnet', name: 'Garnet', value: 'linear-gradient(135deg, #b01a1a 0%, #d63031 50%, #ff6b6b 100%)' },
  { id: 'blush', name: 'Blush', value: 'linear-gradient(135deg, #f8bbd0 0%, #fce4ec 50%, #fff0f5 100%)' },
  { id: 'gold', name: 'Gold', value: 'linear-gradient(135deg, #f59e0b 0%, #fb923c 50%, #fbbf24 100%)' },
]

export const DEFAULT_CANVAS: CanvasSettings = {
  padding: 0,
  cornerRadius: 0,
  shadowEnabled: false,
  shadowIntensity: 60,
  backgroundType: 'none',
  backgroundGradient: GRADIENT_PRESETS[0].value,
  backgroundColor: '#1a1a2e',
  backgroundWallpaper: WALLPAPER_PRESETS[0].css,
  backgroundImageDataUrl: null,
  backgroundImagePath: null,
  aspectRatio: '16:9',
  showWallpaper: false
}

export const DEFAULT_CAMERA: CameraSettings = {
  enabled: false,
  deviceId: null,
  position: 'bottom-right',
  shape: 'circle',
  size: 20,
  x: 80,
  y: 75,
  borderEnabled: true,
  borderColor: '#ffffff',
  borderWidth: 3,
  mirrorEnabled: true
}

export const DEFAULT_AUDIO: AudioSettings = {
  micEnabled: false,
  micDeviceId: null,
  systemAudioEnabled: false,
  micVolume: 100
}

export const DEFAULT_RECORDING: RecordingSettings = {
  format: 'mp4',
  quality: 'high',
  fps: 30,
  saveLocation: 'dialog'
}

// ─── Editor types ────────────────────────────────────────────────────────────

export type CaptureRegion = {
  x: number   // 0–1 normalized left
  y: number   // 0–1 normalized top
  w: number   // 0–1 normalized width
  h: number   // 0–1 normalized height
}

export type ZoomRegion = {
  id: string
  startTime: number     // region start (seconds)
  endTime: number       // region end (seconds)
  x: number             // zoom center X (0–1)
  y: number             // zoom center Y (0–1)
  scale: number         // 1.5 = 150% zoom
  easing: 'linear' | 'ease-in-out'
  easingDuration: number  // ramp time in seconds for zoom-in / zoom-out (default 0.4)
}

export type TextAnnotation = {
  id: string
  text: string
  startTime: number
  endTime: number
  x: number       // 0–1 normalized
  y: number       // 0–1 normalized
  fontSize: number
  color: string
  bgColor: string
  bgEnabled: boolean
  bold: boolean
  align: 'left' | 'center' | 'right'
}

export type SpeedSegment = {
  id: string
  startTime: number
  endTime: number
  speed: number   // 0.5 to 2.0
}

/** One camera keyframe emitted by MouseTracker / FocusEngine at ~10 Hz. */
export type FocusLogRecord = {
  ts: number            // ms since recording start
  camera: { x: number; y: number; zoom: number }  // normalized 0–1
  mouse: { x: number; y: number }   // logical display pixels
  mouseNorm?: { x: number; y: number }  // cursor position normalized 0–1 within display
  scaleFactor: number
}

/** A mouse click captured during recording. */
export type ClickEvent = {
  ts: number   // ms since recording start
  x: number    // normalized 0–1 within display
  y: number    // normalized 0–1 within display
}

/** A key press captured during recording. */
export type KeyEvent = {
  ts: number   // ms since recording start
  key: string  // human-readable label, e.g. "⌘C", "Space", "Shift+A"
}


export type CutSegment = {
  id: string
  startTime: number
  endTime: number
}

export type EditState = {
  blob: Blob
  rawDuration: number   // seconds recorded
  trimStart: number     // seconds
  trimEnd: number       // seconds
  zoomRegions: ZoomRegion[]
  textAnnotations: TextAnnotation[]
  speedSegments: SpeedSegment[]
  cutSegments: CutSegment[]           // ranges to be removed from output
  captureRegion: CaptureRegion | null
  canvasSettings: CanvasSettings
  activeTool: 'select' | 'zoom' | 'text' | 'canvas' | 'speed'
  selectedId: string | null
  focusLog: FocusLogRecord[] | null    // camera log from MouseTracker; null = not available
  autoZoomEnabled: boolean             // when true, focusLog overrides zoomRegions
  clickEvents: ClickEvent[]            // mouse clicks captured during recording
  keyEvents: KeyEvent[]                // key presses captured during recording
}
