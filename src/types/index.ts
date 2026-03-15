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
export type BackgroundType = 'gradient' | 'solid' | 'image' | 'blur' | 'none'
export type AspectRatio = '16:9' | '4:3' | '1:1' | '9:16' | 'fill'
export type RecordingFormat = 'mp4' | 'webm' | 'gif'
export type RecordingQuality = 'high' | 'medium' | 'low'

export type GradientPreset = {
  id: string
  name: string
  value: string
}

export type CanvasSettings = {
  padding: number
  cornerRadius: number
  shadowEnabled: boolean
  shadowIntensity: number
  backgroundType: BackgroundType
  backgroundGradient: string
  backgroundColor: string
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
  activePanel: 'source' | 'canvas' | 'camera' | 'audio' | 'export'
}

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
  { id: 'cosmic', name: 'Cosmic', value: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)' }
]

export const DEFAULT_CANVAS: CanvasSettings = {
  padding: 48,
  cornerRadius: 12,
  shadowEnabled: true,
  shadowIntensity: 60,
  backgroundType: 'gradient',
  backgroundGradient: GRADIENT_PRESETS[0].value,
  backgroundColor: '#1a1a2e',
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
  micEnabled: true,
  micDeviceId: null,
  systemAudioEnabled: false,
  micVolume: 100
}

export const DEFAULT_RECORDING: RecordingSettings = {
  format: 'mp4',
  quality: 'high',
  fps: 30,
  saveLocation: 'downloads'
}

// ─── Editor types ────────────────────────────────────────────────────────────

export type ZoomKeyframe = {
  id: string
  time: number    // seconds from start
  x: number       // zoom center X (0–1)
  y: number       // zoom center Y (0–1)
  scale: number   // 1.0 = no zoom, 2.0 = 2× zoom
  easing: 'linear' | 'ease-in-out'
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

export type EditState = {
  blob: Blob
  rawDuration: number   // seconds recorded
  trimStart: number     // seconds
  trimEnd: number       // seconds
  zoomKeyframes: ZoomKeyframe[]
  textAnnotations: TextAnnotation[]
  activeTool: 'select' | 'zoom' | 'text'
  selectedId: string | null
}
