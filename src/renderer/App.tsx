import { useState, useCallback, useRef, useEffect } from 'react'
import {
  DEFAULT_CANVAS,
  DEFAULT_CAMERA,
  DEFAULT_AUDIO,
  DEFAULT_RECORDING
} from './types'
import type {
  CanvasSettings, CameraSettings, AudioSettings, RecordingSettings,
  CaptureSource, EditState, AppState, CaptureRegion
} from './types'
import { Sidebar } from './components/Sidebar'
import { SourcePanel } from './components/SourcePanel'
import { CanvasPanel } from './components/CanvasPanel'
import { CameraPanel } from './components/CameraPanel'
import { AudioPanel } from './components/AudioPanel'
import { ExportPanel } from './components/ExportPanel'
import { CanvasPreview } from './components/CanvasPreview'
import { RecordingBar } from './components/RecordingBar'
import { VideoEditor } from './components/editor/VideoEditor'
import { ControlBar } from './components/ControlBar'
import { RegionPickerOverlay } from './components/RegionPickerOverlay'

type AppMode = 'capture' | 'editing'

/**
 * Analyze a window thumbnail to detect the title-bar height and return
 * a CaptureRegion that excludes it. Returns null if detection fails.
 */
async function detectWindowContentRegion(thumbnailDataURL: string): Promise<CaptureRegion | null> {
  if (!thumbnailDataURL || thumbnailDataURL.length < 100) return null
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const W = img.naturalWidth, H = img.naturalHeight
      if (!W || !H) { resolve(null); return }
      const c = document.createElement('canvas')
      c.width = W; c.height = H
      const ctx = c.getContext('2d')
      if (!ctx) { resolve(null); return }
      ctx.drawImage(img, 0, 0)

      // Walk rows from top; find first row with high horizontal pixel variance.
      // Uniform-color rows = title bar chrome. Varied rows = content.
      let cropY = 0
      const maxRows = Math.min(H, 120)
      for (let y = 4; y < maxRows; y++) {
        const d = ctx.getImageData(0, y, W, 1).data
        let diff = 0; let count = 0
        const step = Math.max(1, Math.floor(W / 60))
        for (let x = step * 4; x < d.length - step * 4; x += step * 4) {
          diff += Math.abs(d[x] - d[x - step * 4])
            + Math.abs(d[x + 1] - d[x - step * 4 + 1])
            + Math.abs(d[x + 2] - d[x - step * 4 + 2])
          count++
        }
        if (count > 0 && diff / count > 10) {
          cropY = y
          break
        }
      }

      if (cropY < 4) { resolve(null); return }
      const normY = cropY / H
      // Sanity check: crop must be between 2 % and 20 % of the window height
      if (normY < 0.02 || normY > 0.20) { resolve(null); return }
      resolve({ x: 0, y: normY, w: 1, h: 1 - normY })
    }
    img.onerror = () => resolve(null)
    img.src = thumbnailDataURL
  })
}

export default function App() {
  // Control bar runs in a separate BrowserWindow loaded with #control-bar hash
  if (window.location.hash === '#control-bar') {
    return <ControlBar />
  }
  // Region picker overlay runs in a separate BrowserWindow
  if (window.location.hash === '#region-picker') {
    return <RegionPickerOverlay />
  }
  const [mode, setMode] = useState<AppMode>('capture')
  const [editState, setEditState] = useState<EditState | null>(null)

  const [activePanel, setActivePanel] = useState<AppState['activePanel']>('source')
  const [source, setSource] = useState<CaptureSource | null>(null)
  const [canvas, setCanvas] = useState<CanvasSettings>(DEFAULT_CANVAS)
  const [camera, setCamera] = useState<CameraSettings>(DEFAULT_CAMERA)
  const [audio, setAudio] = useState<AudioSettings>(DEFAULT_AUDIO)
  const [recordingSettings, setRecordingSettings] = useState<RecordingSettings>(DEFAULT_RECORDING)

  const [captureRegion, setCaptureRegion] = useState<CaptureRegion | null>(null)
  const captureRegionRef = useRef<CaptureRegion | null>(null)
  const [regionPickerTrigger, setRegionPickerTrigger] = useState(false)

  // Keep refs in sync so callbacks always read latest values
  useEffect(() => { captureRegionRef.current = captureRegion }, [captureRegion])

  const sourceRef = useRef<CaptureSource | null>(null)
  useEffect(() => { sourceRef.current = source }, [source])

  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const streamsRef = useRef({ screenStream, cameraStream })
  streamsRef.current = { screenStream, cameraStream }

  const handleStreamsChange = useCallback(
    (screen: MediaStream | null, cam: MediaStream | null) => {
      if (screen !== streamsRef.current.screenStream) setScreenStream(screen)
      if (cam !== streamsRef.current.cameraStream) setCameraStream(cam)
    },
    []
  )

  const handleSourceSelect = useCallback(async (src: CaptureSource) => {
    setSource(src)
    setActivePanel('canvas')

    // For window sources, auto-detect and crop out the title bar
    if (src.id.startsWith('window:') && src.thumbnailDataURL) {
      const region = await detectWindowContentRegion(src.thumbnailDataURL)
      setCaptureRegion(region)
    } else {
      // For full-screen sources, clear any previous window crop
      setCaptureRegion(prev => (prev && src.id.startsWith('screen:') ? null : prev))
    }
  }, [])

  // Accept source selection from the floating control bar
  useEffect(() => {
    window.electronAPI?.onRemoteSetSource(async (raw) => {
      const src = raw as CaptureSource
      setSource(src)
      setActivePanel('canvas')
      if (src.id.startsWith('window:') && src.thumbnailDataURL) {
        const region = await detectWindowContentRegion(src.thumbnailDataURL)
        setCaptureRegion(region)
      } else if (src.id.startsWith('screen:')) {
        setCaptureRegion(null)
      }
    })
  }, [])

  // Open region picker: overlay for screen sources, in-app picker for window sources
  const handleStartRegionPicker = useCallback(async () => {
    const src = sourceRef.current
    if (!src) return
    if (src.id.startsWith('screen:')) {
      const displays = await window.electronAPI?.getDisplayInfo() ?? []
      const display = displays.find(d => d.id.toString() === src.display_id)
        ?? displays.find(d => d.isPrimary)
        ?? displays[0]
      if (!display) return
      await window.electronAPI?.openRegionPicker(display.bounds)
    } else {
      setRegionPickerTrigger(true)
    }
  }, [])

  // Receive region picker result from overlay window
  useEffect(() => {
    window.electronAPI?.onRegionPickerResult((result) => {
      setCaptureRegion(result)
    })
  }, [])

  // Activate region picker from control bar overlay
  useEffect(() => {
    window.electronAPI?.onRemoteRegionMode(() => {
      handleStartRegionPicker()
    })
  }, [handleStartRegionPicker])

  // Called by RecordingBar when recording finishes → go to editor
  const handleRecordingComplete = useCallback(async (blob: Blob, durationSec: number) => {
    // Fetch focus log recorded by MouseTracker in main process
    const focusLog = await window.electronAPI?.getFocusLog() ?? null
    const state: EditState = {
      blob,
      rawDuration: durationSec,
      trimStart: 0,
      trimEnd: durationSec,
      zoomRegions: [],
      textAnnotations: [],
      speedSegments: [],
      captureRegion: captureRegionRef.current,
      canvasSettings: canvas,
      activeTool: 'select',
      selectedId: null,
      focusLog: focusLog && focusLog.length > 0 ? focusLog : null,
      autoZoomEnabled: false,
    }
    setEditState(state)
    setMode('editing')
  }, [canvas])

  if (mode === 'editing' && editState) {
    return (
      <VideoEditor
        initialState={editState}
        exportFormat={recordingSettings.format}
        exportQuality={recordingSettings.quality}
        exportFps={recordingSettings.fps}
        exportSaveLocation={recordingSettings.saveLocation}
        onBack={() => setMode('capture')}
        onExportDone={() => setMode('capture')}
      />
    )
  }

  return (
    <div className="flex h-screen bg-surface-950 text-white overflow-hidden select-none">
      {/* macOS traffic lights spacer */}
      <div className="fixed top-0 left-0 w-[72px] h-10 z-50 pointer-events-none" />

      {/* Sidebar */}
      <div className="flex flex-col pt-10">
        <Sidebar active={activePanel} onChange={setActivePanel} />
      </div>

      {/* Settings panel */}
      <div className="w-[260px] flex flex-col bg-surface-950 border-r border-white/5 overflow-hidden">
        <div className="h-10 shrink-0 [-webkit-app-region:drag]" />
        <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-white/10">
          {activePanel === 'source' && (
            <SourcePanel selected={source} onSelect={handleSourceSelect} />
          )}
          {activePanel === 'canvas' && (
            <CanvasPanel canvas={canvas} onChange={setCanvas} />
          )}
          {activePanel === 'camera' && (
            <CameraPanel camera={camera} onChange={setCamera} />
          )}
          {activePanel === 'audio' && (
            <AudioPanel audio={audio} onChange={setAudio} />
          )}
          {activePanel === 'export' && (
            <ExportPanel settings={recordingSettings} onChange={setRecordingSettings} />
          )}
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-10 shrink-0 flex items-center justify-center [-webkit-app-region:drag]">
          <span className="text-[11px] text-white/20 font-medium">
            {source ? source.name : 'ScreenStudio'}
          </span>
        </div>

        <CanvasPreview
          canvas={canvas}
          camera={camera}
          source={source}
          screenStream={screenStream}
          cameraStream={cameraStream}
          captureRegion={captureRegion}
          onRegionChange={setCaptureRegion}
          externalPickerActive={regionPickerTrigger}
          onExternalPickerDone={() => setRegionPickerTrigger(false)}
          onStartRegionPicker={handleStartRegionPicker}
        />

        <RecordingBar
          source={source}
          camera={camera}
          audio={audio}
          recordingSettings={recordingSettings}
          onStreamsChange={handleStreamsChange}
          onRecordingComplete={handleRecordingComplete}
        />
      </div>
    </div>
  )
}
