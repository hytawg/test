import { useRef, useCallback } from 'react'
import type { EditState, ZoomKeyframe, TextAnnotation } from '../../types'
import clsx from 'clsx'

type Props = {
  state: EditState
  currentTime: number
  onSeek: (t: number) => void
  onTrimStart: (t: number) => void
  onTrimEnd: (t: number) => void
  onSelectId: (id: string | null) => void
}

function fmt(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const ms = Math.floor((s % 1) * 10)
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${ms}`
}

export function Timeline({ state, currentTime, onSeek, onTrimStart, onTrimEnd, onSelectId }: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const duration = state.rawDuration

  const toPercent = (t: number) => (t / duration) * 100
  const fromPercent = (pct: number) => (pct / 100) * duration

  const getTrackX = useCallback((clientX: number): number => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect) return 0
    const pct = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
    return pct * duration
  }, [duration])

  // ── Drag helpers ──────────────────────────────────────────────────────────

  const startDrag = useCallback(
    (onMove: (t: number) => void, onEnd?: () => void) =>
      (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        const move = (ev: MouseEvent) => onMove(getTrackX(ev.clientX))
        const up = () => {
          window.removeEventListener('mousemove', move)
          window.removeEventListener('mouseup', up)
          onEnd?.()
        }
        window.addEventListener('mousemove', move)
        window.addEventListener('mouseup', up)
      },
    [getTrackX]
  )

  const trimmedStart = toPercent(state.trimStart)
  const trimmedEnd = toPercent(state.trimEnd)
  const playheadPct = toPercent(currentTime)

  return (
    <div className="flex flex-col gap-2 px-4 py-3 bg-surface-950 border-t border-white/5 select-none">
      {/* Time labels */}
      <div className="flex justify-between text-[10px] text-white/25 font-mono px-1">
        <span>{fmt(state.trimStart)}</span>
        <span>{fmt(currentTime)}</span>
        <span>{fmt(state.trimEnd)}</span>
      </div>

      {/* Track area */}
      <div
        ref={trackRef}
        className="relative h-12 rounded-lg overflow-visible"
        onClick={(e) => {
          onSeek(getTrackX(e.clientX))
          onSelectId(null)
        }}
      >
        {/* Full track background */}
        <div className="absolute inset-0 rounded-lg bg-surface-900" />

        {/* Trimmed-out regions (dark overlay) */}
        <div
          className="absolute top-0 bottom-0 bg-black/60 rounded-l-lg"
          style={{ left: 0, width: `${trimmedStart}%` }}
        />
        <div
          className="absolute top-0 bottom-0 bg-black/60 rounded-r-lg"
          style={{ left: `${trimmedEnd}%`, right: 0 }}
        />

        {/* Active region highlight */}
        <div
          className="absolute top-0 bottom-0 bg-white/5 border-t border-b border-white/10"
          style={{ left: `${trimmedStart}%`, width: `${trimmedEnd - trimmedStart}%` }}
        />

        {/* Zoom keyframe markers */}
        {state.zoomKeyframes.map((kf) => (
          <KeyframeMarker
            key={kf.id}
            left={toPercent(kf.time)}
            selected={state.selectedId === kf.id}
            color="bg-amber-400"
            onClick={(e) => { e.stopPropagation(); onSelectId(kf.id) }}
            onMouseDown={startDrag(
              (t) => {/* parent handles via onSeek-style callback — we emit time */},
              undefined
            )}
          />
        ))}

        {/* Text annotation bars */}
        {state.textAnnotations.map((ann) => (
          <div
            key={ann.id}
            className={clsx(
              'absolute h-3 rounded-full top-1 cursor-pointer opacity-70 hover:opacity-100 transition-opacity',
              state.selectedId === ann.id ? 'ring-2 ring-white' : '',
              'bg-violet-500'
            )}
            style={{
              left: `${toPercent(ann.startTime)}%`,
              width: `${Math.max(0.5, toPercent(ann.endTime) - toPercent(ann.startTime))}%`
            }}
            onClick={(e) => { e.stopPropagation(); onSelectId(ann.id) }}
          />
        ))}

        {/* Playhead */}
        <div
          className="absolute top-0 bottom-0 w-0.5 bg-white z-20 pointer-events-none"
          style={{ left: `${playheadPct}%` }}
        >
          {/* Playhead head */}
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full" />
        </div>

        {/* Trim start handle */}
        <TrimHandle
          side="left"
          percent={trimmedStart}
          onMouseDown={startDrag((t) => onTrimStart(Math.max(0, Math.min(t, state.trimEnd - 0.1))))}
        />
        {/* Trim end handle */}
        <TrimHandle
          side="right"
          percent={trimmedEnd}
          onMouseDown={startDrag((t) => onTrimEnd(Math.min(duration, Math.max(t, state.trimStart + 0.1))))}
        />
      </div>

      {/* Duration info */}
      <div className="flex items-center gap-4 text-[10px] text-white/25 px-1">
        <span>Trim: <span className="text-white/40">{fmt(state.trimEnd - state.trimStart)}</span></span>
        <span>Total: <span className="text-white/40">{fmt(duration)}</span></span>
        {state.zoomKeyframes.length > 0 && (
          <span>Zoom keyframes: <span className="text-amber-400/70">{state.zoomKeyframes.length}</span></span>
        )}
        {state.textAnnotations.length > 0 && (
          <span>Texts: <span className="text-violet-400/70">{state.textAnnotations.length}</span></span>
        )}
      </div>
    </div>
  )
}

function TrimHandle({ side, percent, onMouseDown }: {
  side: 'left' | 'right'
  percent: number
  onMouseDown: (e: React.MouseEvent) => void
}) {
  return (
    <div
      className={clsx(
        'absolute top-0 bottom-0 w-3 cursor-ew-resize z-10 flex items-center justify-center',
        side === 'left' ? '-translate-x-1.5' : '-translate-x-1.5'
      )}
      style={{ left: `${percent}%` }}
      onMouseDown={onMouseDown}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="w-1.5 h-8 bg-purple-500 rounded-full shadow-lg shadow-purple-500/30" />
    </div>
  )
}

function KeyframeMarker({ left, selected, color, onClick, onMouseDown }: {
  left: number
  selected: boolean
  color: string
  onClick: (e: React.MouseEvent) => void
  onMouseDown: (e: React.MouseEvent) => void
}) {
  return (
    <div
      className={clsx(
        'absolute bottom-2 w-2.5 h-2.5 rounded-full cursor-pointer z-10 -translate-x-1/2',
        color,
        selected ? 'ring-2 ring-white scale-125' : 'hover:scale-110'
      )}
      style={{ left: `${left}%` }}
      onClick={onClick}
      onMouseDown={onMouseDown}
    />
  )
}
