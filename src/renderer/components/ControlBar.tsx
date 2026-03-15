import { useEffect, useState } from 'react'
import { X, Circle, Square, Pause, Play, Monitor, Maximize2 } from 'lucide-react'
import clsx from 'clsx'

type Status = {
  state: string
  duration: number
  countdown: number
  sourceName: string
}

function fmt(s: number) {
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`
}

export function ControlBar() {
  const [status, setStatus] = useState<Status>({
    state: 'idle', duration: 0, countdown: 0, sourceName: ''
  })

  useEffect(() => {
    window.electronAPI?.onControlStatus(setStatus)
  }, [])

  const cmd = (c: string) => window.electronAPI?.controlCommand(c)

  const isIdle       = status.state === 'idle'
  const isCountdown  = status.state === 'countdown'
  const isRecording  = status.state === 'recording'
  const isPaused     = status.state === 'paused'
  const isProcessing = status.state === 'processing'
  const isActive     = isRecording || isPaused

  return (
    <div
      className="flex items-center h-full px-3 gap-2 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Background blur pill */}
      <div className="absolute inset-0 rounded-2xl bg-[#1c1c1e]/90 backdrop-blur-xl border border-white/10 shadow-2xl shadow-black/50" />

      {/* ── Left: close + open main ── */}
      <div className="relative flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button
          onClick={() => cmd('hide-bar')}
          className="w-7 h-7 rounded-full bg-white/8 hover:bg-red-500/80 flex items-center justify-center text-white/40 hover:text-white transition-all group"
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

      <div className="relative w-px h-6 bg-white/10 mx-1" />

      {/* ── Source info ── */}
      <div className="relative flex items-center gap-2 flex-1 min-w-0">
        <Monitor size={13} className="text-white/30 shrink-0" />
        <span className="text-xs text-white/50 truncate">
          {status.sourceName || 'No source — open ScreenStudio to select'}
        </span>
      </div>

      {/* ── Countdown ── */}
      {isCountdown && (
        <div className="relative flex items-center gap-2 px-3">
          <span className="text-2xl font-bold tabular-nums text-white leading-none">
            {status.countdown}
          </span>
          <span className="text-xs text-white/40">Starting…</span>
        </div>
      )}

      {/* ── Timer (recording / paused) ── */}
      {isActive && (
        <div className="relative flex items-center gap-2">
          <div className={clsx(
            'w-2 h-2 rounded-full shrink-0',
            isRecording ? 'bg-red-500 animate-pulse' : 'bg-amber-400'
          )} />
          <span className="text-sm font-mono tabular-nums text-white/80 w-12">
            {fmt(status.duration)}
          </span>
        </div>
      )}

      {/* Processing */}
      {isProcessing && (
        <span className="relative text-xs text-white/30 animate-pulse px-2">Opening editor…</span>
      )}

      {/* ── Controls ── */}
      <div className="relative flex items-center gap-1.5" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {/* Idle → Record button */}
        {isIdle && (
          <button
            onClick={() => cmd(status.sourceName ? 'start' : 'show-main')}
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

        {/* Pause / Resume */}
        {isRecording && (
          <button
            onClick={() => cmd('pause')}
            className="w-8 h-8 rounded-xl bg-white/8 hover:bg-white/15 flex items-center justify-center text-white/60 hover:text-white transition-all"
            title="Pause"
          >
            <Pause size={13} />
          </button>
        )}
        {isPaused && (
          <button
            onClick={() => cmd('resume')}
            className="w-8 h-8 rounded-xl bg-white/8 hover:bg-white/15 flex items-center justify-center text-white/60 hover:text-white transition-all"
            title="Resume"
          >
            <Play size={13} className="translate-x-px" />
          </button>
        )}

        {/* Stop & Edit */}
        {isActive && (
          <button
            onClick={() => cmd('stop')}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-white/10 hover:bg-white/18 text-white text-xs font-semibold transition-all hover:scale-105 active:scale-95"
          >
            <Square size={9} className="fill-white" />
            Stop & Edit
          </button>
        )}
      </div>
    </div>
  )
}
