import { useState, useCallback, useRef, useEffect } from 'react'
import {
  DEFAULT_CANVAS,
  DEFAULT_CAMERA,
  DEFAULT_AUDIO,
  DEFAULT_RECORDING
} from './types'
import type {
  CanvasSettings, CameraSettings, AudioSettings, RecordingSettings,
  CaptureSource, EditState, AppState
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

type AppMode = 'capture' | 'editing'

export default function App() {
  // Control bar runs in a separate BrowserWindow loaded with #control-bar hash
  if (window.location.hash === '#control-bar') {
    return <ControlBar />
  }
  const [mode, setMode] = useState<AppMode>('capture')
  const [editState, setEditState] = useState<EditState | null>(null)

  const [activePanel, setActivePanel] = useState<AppState['activePanel']>('source')
  const [source, setSource] = useState<CaptureSource | null>(null)
  const [canvas, setCanvas] = useState<CanvasSettings>(DEFAULT_CANVAS)
  const [camera, setCamera] = useState<CameraSettings>(DEFAULT_CAMERA)
  const [audio, setAudio] = useState<AudioSettings>(DEFAULT_AUDIO)
  const [recordingSettings, setRecordingSettings] = useState<RecordingSettings>(DEFAULT_RECORDING)

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

  const handleSourceSelect = useCallback((src: CaptureSource) => {
    setSource(src)
    setActivePanel('canvas')
  }, [])

  // Accept source selection from the floating control bar
  useEffect(() => {
    window.electronAPI?.onRemoteSetSource((raw) => {
      const src = raw as CaptureSource
      setSource(src)
      setActivePanel('canvas')
    })
  }, [])

  // Called by RecordingBar when recording finishes → go to editor
  const handleRecordingComplete = useCallback((blob: Blob, durationSec: number) => {
    const state: EditState = {
      blob,
      rawDuration: durationSec,
      trimStart: 0,
      trimEnd: durationSec,
      zoomKeyframes: [],
      textAnnotations: [],
      activeTool: 'select',
      selectedId: null
    }
    setEditState(state)
    setMode('editing')
  }, [])

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
