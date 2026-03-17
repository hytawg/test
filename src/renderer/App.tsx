import { useState, useCallback, useRef, useEffect } from 'react'
import {
  DEFAULT_CANVAS,
  DEFAULT_CAMERA,
  DEFAULT_AUDIO,
  DEFAULT_RECORDING,
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
import { FilesPanel } from './components/FilesPanel'
import { detectBrowserType, calcBrowserContentRegion } from './utils/browserChrome'

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

      // Build a per-row variance profile for the top ~40% of the thumbnail.
      // Browser chrome (title bar + tab bar + address bar) ends with a thin
      // uniform separator line before real content begins. We find the LAST
      // low-variance separator row that is followed by sustained high-variance
      // content — this is more reliable than looking for the first high-variance
      // row, which fires prematurely on tab-bar favicons and toolbar icons.
      // Chrome with many toolbar rows or large UI scaling can exceed 35%, so
      // scan up to 40% and allow crop up to 38% of height.
      const maxRows = Math.min(H, Math.floor(H * 0.42))  // scan up to 42% of height
      const step = Math.max(1, Math.floor(W / 160))       // finer sampling for accuracy
      const rawVar: number[] = []

      for (let y = 0; y < maxRows; y++) {
        const d = ctx.getImageData(0, y, W, 1).data
        let diff = 0; let count = 0
        for (let x = step * 4; x < d.length - step * 4; x += step * 4) {
          diff += Math.abs(d[x]   - d[x - step * 4])
                + Math.abs(d[x+1] - d[x - step * 4 + 1])
                + Math.abs(d[x+2] - d[x - step * 4 + 2])
          count++
        }
        rawVar.push(count > 0 ? diff / count : 0)
      }

      // Smooth with a ±3-row window to suppress single-pixel spikes
      const smoothed = rawVar.map((_, i) => {
        const slice = rawVar.slice(Math.max(0, i - 3), Math.min(rawVar.length, i + 4))
        return slice.reduce((a, b) => a + b, 0) / slice.length
      })

      // Find the last separator: a low-variance row (≤10) immediately
      // followed by at least 5 high-variance rows (≥12) = start of content.
      // Lowered HIGH threshold: Chrome page content often starts less abruptly.
      const HIGH = 12, LOW = 10
      let cropY = 0
      for (let i = smoothed.length - 1; i >= 1; i--) {
        if (smoothed[i] <= LOW) {
          const after = smoothed.slice(i + 1, Math.min(smoothed.length, i + 10))
          const highCount = after.filter(v => v >= HIGH).length
          if (highCount >= 5) { cropY = i + 1; break }
        }
      }

      if (cropY < 1) { resolve(null); return }
      const normY = cropY / H
      // Sanity: chrome area must be 1%–38% of window height
      if (normY < 0.01 || normY > 0.38) { resolve(null); return }
      resolve({ x: 0, y: normY, w: 1, h: 1 - normY })
    }
    img.onerror = () => resolve(null)
    img.src = thumbnailDataURL
  })
}

// Top-level router — keeps conditional returns BEFORE any hook calls so the
// Rules of Hooks are never violated regardless of which branch is taken.
export default function App() {
  if (window.location.hash === '#control-bar') return <ControlBar />
  if (window.location.hash === '#region-picker') return <RegionPickerOverlay />
  return <MainApp />
}

function MainApp() {
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

  // Declare streams before any effect that references them in deps arrays
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)
  const streamsRef = useRef({ screenStream, cameraStream })
  streamsRef.current = { screenStream, cameraStream }

  // ── Phase 2: stream-based browser crop ──────────────────────────────────────
  // When the capture stream becomes available we know the exact physical pixel
  // resolution of the window.  For recognised browsers we compute a precise
  // CaptureRegion using the constant toolbar-height table instead of relying on
  // the thumbnail-variance estimate from Phase 1.
  //
  // We only fire this logic when screenStream first appears (transitions from
  // null → MediaStream).  We do NOT override a region that the user has set
  // manually via the region picker (that region is intentional).
  useEffect(() => {
    if (!screenStream || !source || !source.id.startsWith('window:')) return

    const track = screenStream.getVideoTracks()[0]
    if (!track) return
    const { width, height } = track.getSettings()
    if (!width || !height) return

    // Not a recognised browser → keep whatever Phase 1 produced
    if (detectBrowserType(source.name) === 'unknown') return

    ;(async () => {
      // Resolve display scale factor for this source
      const displays = await window.electronAPI?.getDisplayInfo() ?? []
      const display =
        displays.find(d => d.id.toString() === source.display_id) ??
        displays.find(d => d.isPrimary) ??
        displays[0]
      const scaleFactor = display?.scaleFactor ?? 1

      // Calculate content region: (x, y, width, height) in normalised 0-1 coords
      const region = calcBrowserContentRegion(source.name, width, height, scaleFactor)
      if (region) setCaptureRegion(region)
    })()
  }, [screenStream, source])

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

    if (src.id.startsWith('window:') && src.thumbnailDataURL) {
      // Phase 1 – no stream yet, use thumbnail variance as initial estimate.
      // If the source is a recognised browser, skip the slower thumbnail scan:
      // Phase 2 (stream-based) will produce a pixel-accurate result shortly
      // after recording starts.  For unknown apps, thumbnail analysis is the
      // only option.
      if (detectBrowserType(src.name) !== 'unknown') {
        // Known browser: clear any stale region so Phase 2 sets it fresh
        setCaptureRegion(null)
      } else {
        const region = await detectWindowContentRegion(src.thumbnailDataURL)
        setCaptureRegion(region)
      }
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
        if (detectBrowserType(src.name) !== 'unknown') {
          setCaptureRegion(null)  // Phase 2 will refine once stream is live
        } else {
          const region = await detectWindowContentRegion(src.thumbnailDataURL)
          setCaptureRegion(region)
        }
      } else if (src.id.startsWith('screen:')) {
        setCaptureRegion(null)
      }
    })
  }, [])

  // Open region picker: overlay for screen sources, in-app picker for window sources.
  // For screen sources the picker is a full-screen transparent overlay window —
  // the main window does NOT need to be visible, so we skip showing it (avoids
  // disrupting the recording workflow when triggered from the ControlBar).
  // For window sources the in-app CanvasPreview picker is used, which requires
  // the main window to be visible.
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
      // In-app picker: make the main window visible so the user can draw the region
      window.electronAPI?.showMainWindow()
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

  // Called by FilesPanel when user imports / re-edits a file → go to editor
  const handleOpenFile = useCallback(async (blob: Blob, _fileName: string) => {
    const url = URL.createObjectURL(blob)
    const durationSec = await new Promise<number>((resolve) => {
      const v = document.createElement('video')
      v.preload = 'metadata'
      let settled = false
      const finish = (dur: number) => {
        if (settled) return
        settled = true
        URL.revokeObjectURL(url)
        resolve(dur)
      }
      v.onloadedmetadata = () => {
        if (isFinite(v.duration)) {
          finish(v.duration)
        } else {
          // MediaRecorder WebM files report Infinity until seeked to the end.
          // Seeking to a very large time forces the browser to determine the
          // real duration, which is then read in the onseeked handler.
          v.onseeked = () => finish(isFinite(v.duration) ? v.duration : 0)
          v.currentTime = 1e10
        }
      }
      v.onerror = () => finish(0)
      v.src = url
    })
    const state: EditState = {
      blob,
      rawDuration: durationSec,
      trimStart: 0,
      trimEnd: durationSec,
      zoomRegions: [],
      textAnnotations: [],
      speedSegments: [],
      cutSegments: [],
      captureRegion: null,
      // Use a clean "viewer" canvas for imported files: no decorative background
      // frame, no padding. This prevents the "doubled background" visual that
      // occurs when re-editing an already-exported video that has the same
      // gradient/image baked into its content. Users can add a frame via Canvas panel.
      canvasSettings: { ...DEFAULT_CANVAS, backgroundType: 'none', padding: 0, cornerRadius: 0, shadowEnabled: false },
      activeTool: 'select',
      selectedId: null,
      focusLog: null,
      autoZoomEnabled: false,
      clickEvents: [],
      keyEvents: [],
    }
    setEditState(state)
    setMode('editing')
  }, [canvas])

  // Called by RecordingBar when recording finishes → go to editor
  const handleRecordingComplete = useCallback(async (blob: Blob, durationSec: number, captureRegionBaked: boolean) => {
    // Fetch focus / click / key logs recorded by MouseTracker in main process
    const [focusLog, clickEvents, keyEvents] = await Promise.all([
      window.electronAPI?.getFocusLog() ?? Promise.resolve(null),
      window.electronAPI?.getClickLog() ?? Promise.resolve([]),
      window.electronAPI?.getKeyLog()   ?? Promise.resolve([]),
    ])
    const state: EditState = {
      blob,
      rawDuration: durationSec,
      trimStart: 0,
      trimEnd: durationSec,
      zoomRegions: [],
      textAnnotations: [],
      speedSegments: [],
      cutSegments: [],
      // If captureRegion was applied during canvas compositing (camera overlay baked),
      // don't apply it again in the editor.
      captureRegion: captureRegionBaked ? null : captureRegionRef.current,
      canvasSettings: canvas,
      activeTool: 'select',
      selectedId: null,
      focusLog: focusLog && focusLog.length > 0 ? focusLog : null,
      autoZoomEnabled: false,
      clickEvents: clickEvents ?? [],
      keyEvents:   keyEvents ?? [],
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
          {activePanel === 'files' && (
            <FilesPanel onOpenFile={handleOpenFile} />
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
          captureRegion={captureRegion}
          onStreamsChange={handleStreamsChange}
          onRecordingComplete={handleRecordingComplete}
        />
      </div>
    </div>
  )
}
