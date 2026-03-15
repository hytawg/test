import { useEffect, useState, useCallback, useRef } from 'react'
import { X, Circle, Square, Pause, Play, Maximize2, ChevronDown, ChevronUp, Monitor, AppWindow } from 'lucide-react'
import type { CaptureSource } from '../types'
import clsx from 'clsx'

type Status = {
  state: string
  duration: number
  countdown: number
  sourceName: string
}

const BAR_H    = 64
const PICKER_H = 380
const TOTAL_H  = BAR_H + PICKER_H

function fmt(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function ControlBar() {
  const [status, setStatus] = useState<Status>({
    state: 'idle', duration: 0, countdown: 0, sourceName: ''
  })
  const [showPicker, setShowPicker] = useState(false)
  const [sources, setSources] = useState<CaptureSource[]>([])
  const [loadingSources, setLoadingSources] = useState(false)
  const pickerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.electronAPI?.onControlStatus(setStatus)
  }, [])

  const cmd = (c: string) => window.electronAPI?.controlCommand(c)

  const openPicker = useCallback(async () => {
    setLoadingSources(true)
    setShowPicker(true)
    window.electronAPI?.resizeControlBar(TOTAL_H)
    const srcs = await window.electronAPI?.getSources() ?? []
    setSources(srcs)
    setLoadingSources(false)
  }, [])

  const closePicker = useCallback(() => {
    setShowPicker(false)
    window.electronAPI?.resizeControlBar(BAR_H)
  }, [])

  const selectSource = useCallback((source: CaptureSource) => {
    window.electronAPI?.setSource(source)
    closePicker()
  }, [closePicker])

  const displays = sources.filter(s => s.id.startsWith('screen:'))
  const windows  = sources.filter(s => !s.id.startsWith('screen:'))

  const isIdle       = status.state === 'idle'
  const isCountdown  = status.state === 'countdown'
  const isRecording  = status.state === 'recording'
  const isPaused     = status.state === 'paused'
  const isProcessing = status.state === 'processing'
  const isActive     = isRecording || isPaused

  return (
    <div className="flex flex-col h-full select-none">
      {/* ── Bar row ── */}
      <div
        className="relative flex items-center h-16 px-3 gap-2 shrink-0"
        style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      >
        {/* Background */}
        <div className="absolute inset-0 rounded-2xl bg-[#1c1c1e]/90 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/60" />

        {/* Close + open-main */}
        <div className="relative flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={() => cmd('hide-bar')}
            className="w-7 h-7 rounded-full bg-white/8 hover:bg-red-500/80 flex items-center justify-center text-white/40 hover:text-white transition-all"
            title="Hide"
          >
            <X size={11} />
          </button>
          <button
            onClick={() => cmd('show-main')}
            className="w-7 h-7 rounded-full bg-white/8 hover:bg-white/15 flex items-center justify-center text-white/40 hover:text-white/80 transition-all"
            title="Open ScreenStudio"
          >
            <Maximize2 size={10} />
          </button>
        </div>

        <div className="relative w-px h-5 bg-white/10 mx-1" />

        {/* Source selector button */}
        <div className="relative" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          <button
            onClick={showPicker ? closePicker : openPicker}
            disabled={isActive || isCountdown}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-all',
              isActive || isCountdown
                ? 'text-white/30 cursor-default'
                : showPicker
                  ? 'bg-white/12 text-white/80 border border-white/15'
                  : 'bg-white/6 text-white/50 hover:bg-white/10 hover:text-white/80 border border-transparent'
            )}
          >
            <Monitor size={12} className="shrink-0" />
            <span className="max-w-[160px] truncate">
              {status.sourceName || 'Select Source'}
            </span>
            {!isActive && !isCountdown && (
              showPicker ? <ChevronUp size={10} /> : <ChevronDown size={10} />
            )}
          </button>
        </div>

        <div className="relative flex-1" />

        {/* Countdown */}
        {isCountdown && (
          <div className="relative flex items-center gap-2">
            <span className="text-2xl font-bold tabular-nums text-white leading-none">{status.countdown}</span>
            <span className="text-xs text-white/40">Starting…</span>
          </div>
        )}

        {/* Timer */}
        {isActive && (
          <div className="relative flex items-center gap-2">
            <div className={clsx('w-2 h-2 rounded-full shrink-0', isRecording ? 'bg-red-500 animate-pulse' : 'bg-amber-400')} />
            <span className="text-sm font-mono tabular-nums text-white/80 w-12">{fmt(status.duration)}</span>
          </div>
        )}

        {isProcessing && (
          <span className="relative text-xs text-white/30 animate-pulse">Opening editor…</span>
        )}

        {/* Action buttons */}
        <div className="relative flex items-center gap-1.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
          {isIdle && (
            <button
              onClick={() => status.sourceName ? cmd('start') : openPicker()}
              className={clsx(
                'flex items-center gap-1.5 px-4 py-1.5 rounded-xl text-xs font-semibold transition-all',
                status.sourceName
                  ? 'bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/30 hover:scale-105 active:scale-95'
                  : 'bg-white/8 text-white/40 hover:bg-white/12 hover:text-white/70'
              )}
            >
              <Circle size={9} className={status.sourceName ? 'fill-white' : 'fill-white/40'} />
              {status.sourceName ? 'Record' : 'Select Source'}
            </button>
          )}
          {isRecording && (
            <button onClick={() => cmd('pause')}
              className="w-8 h-8 rounded-xl bg-white/8 hover:bg-white/15 flex items-center justify-center text-white/60 hover:text-white transition-all">
              <Pause size={13} />
            </button>
          )}
          {isPaused && (
            <button onClick={() => cmd('resume')}
              className="w-8 h-8 rounded-xl bg-white/8 hover:bg-white/15 flex items-center justify-center text-white/60 hover:text-white transition-all">
              <Play size={13} className="translate-x-px" />
            </button>
          )}
          {isActive && (
            <button onClick={() => cmd('stop')}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/18 text-white text-xs font-semibold transition-all hover:scale-105 active:scale-95">
              <Square size={9} className="fill-white" />
              Stop & Edit
            </button>
          )}
        </div>
      </div>

      {/* ── Source picker panel ── */}
      {showPicker && (
        <div
          ref={pickerRef}
          className="mt-2 mx-1 rounded-2xl bg-[#1c1c1e]/95 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/60 overflow-hidden flex flex-col"
          style={{ height: PICKER_H - 8 }}
        >
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/6">
            <span className="text-[11px] font-semibold text-white/40 uppercase tracking-wider">Select Source</span>
            <button onClick={closePicker} className="text-white/30 hover:text-white/70 transition-all">
              <X size={13} />
            </button>
          </div>

          <div className="overflow-y-auto flex-1 px-3 py-2">
            {loadingSources ? (
              <p className="text-xs text-white/30 text-center py-8 animate-pulse">Loading sources…</p>
            ) : (
              <>
                {displays.length > 0 && (
                  <SourceSection
                    title="Displays"
                    icon={<Monitor size={11} />}
                    sources={displays}
                    onSelect={selectSource}
                    currentName={status.sourceName}
                  />
                )}
                {windows.length > 0 && (
                  <SourceSection
                    title="Windows"
                    icon={<AppWindow size={11} />}
                    sources={windows}
                    onSelect={selectSource}
                    currentName={status.sourceName}
                  />
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function SourceSection({ title, icon, sources, onSelect, currentName }: {
  title: string
  icon: React.ReactNode
  sources: CaptureSource[]
  onSelect: (s: CaptureSource) => void
  currentName: string
}) {
  return (
    <div className="mb-3">
      <div className="flex items-center gap-1.5 px-1 mb-2">
        <span className="text-white/25">{icon}</span>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-white/25">{title}</span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {sources.map(source => (
          <button
            key={source.id}
            onClick={() => onSelect(source)}
            className={clsx(
              'flex flex-col gap-1.5 p-1.5 rounded-xl border transition-all text-left hover:scale-[1.02] active:scale-95',
              source.name === currentName
                ? 'border-purple-500/60 bg-purple-500/10'
                : 'border-white/6 bg-white/3 hover:border-white/15 hover:bg-white/6'
            )}
          >
            <div className="w-full aspect-video rounded-lg overflow-hidden bg-black/40">
              {source.thumbnailDataURL ? (
                <img src={source.thumbnailDataURL} alt={source.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Monitor size={16} className="text-white/20" />
                </div>
              )}
            </div>
            <span className="text-[10px] text-white/60 leading-tight truncate px-0.5">{source.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
