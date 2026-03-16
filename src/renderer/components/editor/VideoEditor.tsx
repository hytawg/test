import { useEffect, useState } from 'react'
import { Play, Pause, SkipBack, Scissors, ZoomIn, Type, Download, ArrowLeft, Loader2, Film, Layers, Gauge, Zap, X, Sparkles } from 'lucide-react'
import type { CutSegment, AspectRatio } from '../../types'
import type { EditState } from '../../types'
import { useVideoEditor } from '../../hooks/useVideoEditor'
import { Timeline } from './Timeline'
import { ZoomPanel } from './ZoomPanel'
import { TextPanel } from './TextPanel'
import { SpeedPanel } from './SpeedPanel'
import { OverlayPanel } from './OverlayPanel'
import { CanvasPanel } from '../CanvasPanel'
import { FfmpegExportButton } from './FfmpegExportButton'
import clsx from 'clsx'

type Props = {
  initialState: EditState
  exportFormat: string
  exportQuality: string
  exportFps: number
  exportSaveLocation: string
  onBack: () => void
  onExportDone: () => void
}

export function VideoEditor({
  initialState, exportFormat, exportQuality, exportFps, exportSaveLocation, onBack, onExportDone
}: Props) {
  const {
    state, videoRef, canvasRef, videoLoaded,
    playing, currentTime,
    play, pause, seek,
    setTrimStart, setTrimEnd, setActiveTool, setSelectedId,
    addZoomAtTime, addZoomRegion, updateZoomRegion, removeZoomRegion,
    addTextAnnotation, updateTextAnnotation, removeTextAnnotation,
    addSpeedSegment, updateSpeedSegment, removeSpeedSegment,
    addCutSegment, updateCutSegment, removeCutSegment,
    updateCanvasSettings,
    exportVideo, exporting, exportProgress,
    setAutoZoomEnabled, updateOverlaySettings
  } = useVideoEditor(initialState)

  const [blobUrl, setBlobUrl] = useState<string | null>(null)
  useEffect(() => {
    const url = URL.createObjectURL(state.blob)
    setBlobUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [state.blob])

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    if (state.activeTool === 'zoom') addZoomAtTime(currentTime, x, y)
    else if (state.activeTool === 'text') addTextAnnotation(x, y, currentTime)
  }

  const handleExport = async () => {
    const filePath = await exportVideo(exportFormat, exportQuality, exportFps, exportSaveLocation)
    if (filePath) {
      const cutDuration = state.cutSegments.reduce((acc, c) => acc + (c.endTime - c.startTime), 0)
      const durationSec = Math.max(0, Math.round(state.trimEnd - state.trimStart - cutDuration))
      const fileName = filePath.split('/').pop() ?? filePath.split('\\').pop() ?? 'recording'
      await window.electronAPI?.addRecordingHistory({
        id: Math.random().toString(36).slice(2),
        filePath, fileName,
        savedAt: Date.now(),
        durationSec,
        format: exportFormat,
      })
    }
    onExportDone()
  }

  // Add text at center when clicking timeline text lane
  const handleAddTextFromTimeline = (time: number) => {
    addTextAnnotation(0.5, 0.8, time)
  }

  const TOOLS = [
    { id: 'select'  as const, Icon: Scissors,  label: 'Trim'    },
    { id: 'zoom'    as const, Icon: ZoomIn,     label: 'Zoom'    },
    { id: 'text'    as const, Icon: Type,       label: 'Text'    },
    { id: 'canvas'  as const, Icon: Layers,     label: 'Canvas'  },
    { id: 'speed'   as const, Icon: Gauge,      label: 'Speed'   },
    { id: 'overlay' as const, Icon: Sparkles,   label: 'Overlay' },
  ]

  // Always render video element so loadedmetadata can fire even during loading screen
  if (!videoLoaded) {
    return (
      <div className="flex h-screen bg-surface-950 text-white items-center justify-center flex-col gap-4">
        {/* video must be in DOM for loadedmetadata to fire */}
        <video ref={videoRef} src={blobUrl ?? undefined} className="hidden" preload="auto" />
        <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center">
          <Film size={28} className="text-white/30" />
        </div>
        <div className="flex items-center gap-2 text-white/40 text-sm">
          <Loader2 size={14} className="animate-spin" />
          Preparing editor…
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-surface-950 text-white overflow-hidden select-none">
      {/* Left toolbar */}
      <div className="w-[72px] flex flex-col items-center pt-10 pb-4 gap-2 bg-surface-950 border-r border-white/5">
        <button onClick={onBack}
          className="w-10 h-10 rounded-xl flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/5 transition-all mb-2">
          <ArrowLeft size={18} />
        </button>
        {TOOLS.map(({ id, Icon, label }) => (
          <button key={id} onClick={() => setActiveTool(id)} title={label}
            className={clsx(
              'w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all',
              state.activeTool === id ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70 hover:bg-white/5'
            )}>
            <Icon size={18} />
            <span className="text-[9px] font-medium leading-none">{label}</span>
          </button>
        ))}
      </div>

      {/* Right panel */}
      <div className="w-[260px] flex flex-col bg-surface-950 border-r border-white/5 overflow-hidden">
        <div className="h-10 shrink-0 [-webkit-app-region:drag]" />
        <div className="flex-1 overflow-y-auto p-4">
          {state.activeTool === 'select' && (
            <TrimPanel trimStart={state.trimStart} trimEnd={state.trimEnd}
              duration={state.rawDuration} currentTime={currentTime}
              cutSegments={state.cutSegments}
              onSetIn={() => setTrimStart(currentTime)} onSetOut={() => setTrimEnd(currentTime)}
              onRemoveCut={removeCutSegment} />
          )}
          {state.activeTool === 'zoom' && (
            <ZoomPanel regions={state.zoomRegions} selectedId={state.selectedId}
              currentTime={currentTime} onUpdate={updateZoomRegion}
              onRemove={removeZoomRegion} onSelect={setSelectedId} />
          )}
          {state.activeTool === 'text' && (
            <TextPanel annotations={state.textAnnotations} selectedId={state.selectedId}
              trimEnd={state.trimEnd} onUpdate={updateTextAnnotation}
              onRemove={removeTextAnnotation}
              onSelect={(id) => {
                setSelectedId(id)
                // Seek to the annotation so the user immediately sees it on canvas
                if (id) {
                  const ann = state.textAnnotations.find(a => a.id === id)
                  if (ann) seek(ann.startTime)
                }
              }} />
          )}
          {state.activeTool === 'canvas' && (
            <CanvasPanel canvas={state.canvasSettings} onChange={(c) => updateCanvasSettings(c)} />
          )}
          {state.activeTool === 'speed' && (
            <SpeedPanel segments={state.speedSegments} selectedId={state.selectedId}
              currentTime={currentTime} onUpdate={updateSpeedSegment}
              onRemove={removeSpeedSegment} onSelect={setSelectedId} />
          )}
          {state.activeTool === 'overlay' && (
            <OverlayPanel
              settings={state.overlaySettings}
              hasClickData={state.clickEvents.length > 0}
              hasKeyData={state.keyEvents.length > 0}
              hasCursorData={state.focusLog !== null && state.focusLog.length > 0}
              onChange={updateOverlaySettings}
            />
          )}
        </div>

        {/* Export */}
        <div className="p-4 border-t border-white/5 flex flex-col gap-1">
          {/* WebCodecs export (existing) */}
          <button onClick={handleExport} disabled={exporting}
            className={clsx(
              'w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-all',
              exporting ? 'bg-white/5 text-white/30 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-pink-600 text-white hover:from-purple-500 hover:to-pink-500 shadow-lg shadow-purple-500/20 hover:scale-[1.02] active:scale-95'
            )}>
            {exporting ? <><Loader2 size={15} className="animate-spin" />{Math.round(exportProgress)}%</>
              : <><Download size={15} />Export</>}
          </button>
          {exporting && (
            <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all"
                style={{ width: `${exportProgress}%` }} />
            </div>
          )}

          {/* FFmpeg Screen Studio export */}
          <FfmpegExportButton state={state} videoRef={videoRef} />
        </div>
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="h-10 shrink-0 flex items-center px-4 gap-3 [-webkit-app-region:drag]">
          <span className="flex-1 text-center text-[11px] text-white/20 font-medium pointer-events-none">
            Editor — {fmtDuration(state.trimEnd - state.trimStart)}
          </span>
          {state.focusLog && (
            <button
              onClick={() => setAutoZoomEnabled(!state.autoZoomEnabled)}
              title="Auto Zoom — apply focus-tracked camera motion"
              className={clsx(
                'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all [-webkit-app-region:no-drag]',
                state.autoZoomEnabled
                  ? 'bg-purple-500/30 text-purple-300 border border-purple-500/40'
                  : 'bg-white/5 text-white/30 hover:text-white/60 border border-transparent'
              )}>
              <Zap size={12} className={state.autoZoomEnabled ? 'fill-purple-400' : ''} />
              Auto Zoom
            </button>
          )}
        </div>

        {/* Preview */}
        <div className="flex-1 flex items-center justify-center bg-[#0d0d0d] min-h-0 p-6 relative overflow-hidden">
          <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '32px 32px' }} />

          <video ref={videoRef} src={blobUrl ?? undefined} className="hidden" preload="auto" />

          <div className={clsx(
            'relative max-w-full max-h-full',
            (state.activeTool === 'text' || state.activeTool === 'zoom') ? 'cursor-crosshair' : 'cursor-default'
          )}>
            <canvas ref={canvasRef}
              width={canvasDimensions(state.canvasSettings.aspectRatio).W}
              height={canvasDimensions(state.canvasSettings.aspectRatio).H}
              onClick={handleCanvasClick}
              className="max-w-full max-h-full rounded-lg shadow-2xl shadow-black/60"
              style={{ maxHeight: 'calc(100vh - 260px)' }} />
          </div>
        </div>

        {/* Playback controls */}
        <div className="flex items-center justify-center gap-3 py-2 border-t border-white/5 bg-surface-950">
          <button onClick={() => seek(state.trimStart)}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-white/70 hover:bg-white/5 transition-all">
            <SkipBack size={15} />
          </button>
          <button onClick={playing ? pause : play}
            className="w-10 h-10 rounded-xl bg-white/10 hover:bg-white/15 flex items-center justify-center text-white transition-all">
            {playing ? <Pause size={16} /> : <Play size={16} className="translate-x-px" />}
          </button>
          <span className="text-xs text-white/30 font-mono w-20 text-center">
            {fmtDuration(currentTime)} / {fmtDuration(state.trimEnd)}
          </span>
        </div>

        {/* Timeline */}
        <Timeline
          state={state}
          currentTime={currentTime}
          onSeek={seek}
          onTrimStart={setTrimStart}
          onTrimEnd={setTrimEnd}
          onSelectId={setSelectedId}
          onSetTool={setActiveTool}
          onAddZoomAtTime={addZoomAtTime}
          onAddZoomRegion={addZoomRegion}
          onUpdateZoomRegion={updateZoomRegion}
          onRemoveZoom={removeZoomRegion}
          onAddText={handleAddTextFromTimeline}
          onUpdateText={updateTextAnnotation}
          onRemoveText={removeTextAnnotation}
          onAddSpeedSegment={addSpeedSegment}
          onUpdateSpeedSegment={updateSpeedSegment}
          onRemoveSpeedSegment={removeSpeedSegment}
          onAddCutSegment={addCutSegment}
          onUpdateCutSegment={updateCutSegment}
          onRemoveCutSegment={removeCutSegment}
        />
      </div>
    </div>
  )
}

function canvasDimensions(ar: AspectRatio): { W: number; H: number } {
  switch (ar) {
    case '4:3':  return { W: 1440, H: 1080 }
    case '1:1':  return { W: 1080, H: 1080 }
    case '9:16': return { W: 1080, H: 1920 }
    default:     return { W: 1920, H: 1080 }  // 16:9 and fill
  }
}

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(1)
  return `${m}:${sec.padStart(4, '0')}`
}

function TrimPanel({ trimStart, trimEnd, duration, currentTime, cutSegments, onSetIn, onSetOut, onRemoveCut }: {
  trimStart: number; trimEnd: number; duration: number; currentTime: number
  cutSegments: CutSegment[]
  onSetIn: () => void; onSetOut: () => void
  onRemoveCut: (id: string) => void
}) {
  const totalCutDuration = cutSegments.reduce((acc, c) => acc + (c.endTime - c.startTime), 0)
  const outputDuration = trimEnd - trimStart - totalCutDuration

  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-sm font-semibold text-white/80">Trim</h2>
      <p className="text-xs text-white/40 leading-relaxed">
        Drag the purple handles on the timeline to set start/end, or use Set In/Out below.
      </p>
      <div className="flex flex-col gap-2">
        <TrimPoint label="In point" value={trimStart} hint="" onClick={onSetIn} btnLabel="Set In" />
        <TrimPoint label="Out point" value={trimEnd} hint="" onClick={onSetOut} btnLabel="Set Out" />
      </div>
      <div className="p-3 rounded-xl bg-white/3 border border-white/5">
        <p className="text-[10px] text-white/30 mb-1">Output duration</p>
        <p className="text-lg font-mono text-white/80">{fmtDuration(Math.max(0, outputDuration))}</p>
        <p className="text-[10px] text-white/20 mt-0.5">of {fmtDuration(duration)} total</p>
      </div>
      {cutSegments.length > 0 && (
        <div className="flex flex-col gap-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-red-400/60">Cut segments</p>
          {cutSegments.map((c) => (
            <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg bg-red-500/8 border border-red-500/15">
              <div className="flex-1">
                <p className="text-[10px] font-mono text-red-300/70">{fmtDuration(c.startTime)} → {fmtDuration(c.endTime)}</p>
                <p className="text-[9px] text-red-400/40">{fmtDuration(c.endTime - c.startTime)} removed</p>
              </div>
              <button onClick={() => onRemoveCut(c.id)}
                className="w-5 h-5 rounded flex items-center justify-center text-red-400/50 hover:text-red-300 hover:bg-red-500/20 transition-all">
                <X size={10} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TrimPoint({ label, value, onClick, btnLabel }: {
  label: string; value: number; hint: string; onClick: () => void; btnLabel: string
}) {
  return (
    <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/3 border border-white/5">
      <div className="flex-1">
        <p className="text-[10px] text-white/30">{label}</p>
        <p className="text-xs font-mono text-white/70">{fmtDuration(value)}</p>
      </div>
      <button onClick={onClick}
        className="px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 text-purple-400 text-[10px] font-medium transition-all">
        {btnLabel}
      </button>
    </div>
  )
}
