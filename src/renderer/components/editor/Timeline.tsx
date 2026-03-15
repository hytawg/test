import { useRef, useCallback, useState, useEffect } from 'react'
import type { EditState, ZoomKeyframe, TextAnnotation } from '../../types'
import clsx from 'clsx'

type Props = {
  state: EditState
  currentTime: number
  onSeek: (t: number) => void
  onTrimStart: (t: number) => void
  onTrimEnd: (t: number) => void
  onSelectId: (id: string | null) => void
  onSetTool: (tool: 'select' | 'zoom' | 'text') => void
  // Zoom lane
  onAddZoom: (time: number, x?: number, y?: number) => void
  onAddZoomRegion: (startTime: number, endTime: number) => void
  onRemoveZoom: (id: string) => void
  // Text lane
  onAddText: (time: number) => void
  onUpdateText: (id: string, patch: Partial<TextAnnotation>) => void
  onRemoveText: (id: string) => void
}

function fmt(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const ms = Math.floor((s % 1) * 10)
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${ms}`
}

export function Timeline({
  state, currentTime,
  onSeek, onTrimStart, onTrimEnd, onSelectId, onSetTool,
  onAddZoom, onAddZoomRegion, onRemoveZoom,
  onAddText, onUpdateText, onRemoveText
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const zoomLaneRef = useRef<HTMLDivElement>(null)
  const textLaneRef = useRef<HTMLDivElement>(null)
  const duration = state.rawDuration

  // Keep a ref to current state for use inside mousedown callbacks
  const stateRef = useRef(state)
  stateRef.current = state

  const toPercent = (t: number) => (t / duration) * 100

  const getTime = useCallback((clientX: number, ref: React.RefObject<HTMLDivElement>): number => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return 0
    return Math.max(0, Math.min(duration, ((clientX - rect.left) / rect.width) * duration))
  }, [duration])

  // ── Generic drag helper ───────────────────────────────────────────────────

  const startDrag = useCallback(
    (ref: React.RefObject<HTMLDivElement>, onMove: (t: number) => void, onEnd?: () => void) =>
      (e: React.MouseEvent) => {
        e.preventDefault(); e.stopPropagation()
        const move = (ev: MouseEvent) => onMove(getTime(ev.clientX, ref))
        const up = () => {
          window.removeEventListener('mousemove', move)
          window.removeEventListener('mouseup', up)
          onEnd?.()
        }
        window.addEventListener('mousemove', move)
        window.addEventListener('mouseup', up)
      },
    [getTime]
  )

  // ── Zoom Lane ─────────────────────────────────────────────────────────────

  const [zoomDragPreview, setZoomDragPreview] = useState<{ start: number; end: number } | null>(null)
  const [zoomHover, setZoomHover] = useState<number | null>(null)
  const [isOverZoomRegion, setIsOverZoomRegion] = useState(false)
  const [pendingZoomStart, setPendingZoomStart] = useState<number | null>(null)
  const pendingZoomStartRef = useRef<number | null>(null)

  // Cancel pending zoom start on Escape
  useEffect(() => {
    if (pendingZoomStart === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPendingZoomStart(null)
        pendingZoomStartRef.current = null
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingZoomStart])

  const handleZoomLaneMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    const startT = getTime(e.clientX, zoomLaneRef)
    let lastT = startT
    let isDragging = false

    const move = (ev: MouseEvent) => {
      const t = getTime(ev.clientX, zoomLaneRef)
      if (Math.abs(t - startT) > 0.15) {
        isDragging = true
        setZoomDragPreview({ start: Math.min(startT, t), end: Math.max(startT, t) })
      }
      lastT = t
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      setZoomDragPreview(null)

      if (isDragging && Math.abs(lastT - startT) > 0.15) {
        // Drag → create region immediately, cancel any pending start
        setPendingZoomStart(null)
        pendingZoomStartRef.current = null
        onAddZoomRegion(Math.min(startT, lastT), Math.max(startT, lastT))
      } else {
        // Single click — check if over an existing zoom region
        const s = stateRef.current
        const regions = buildZoomRegions(s.zoomKeyframes, s.trimEnd)
        const overRegion = regions.find((r) => startT >= r.start && startT <= r.end)
        if (overRegion) {
          // Click on existing region → switch to zoom tool, select nearest peak keyframe
          onSetTool('zoom')
          const nearestKf = s.zoomKeyframes
            .filter((kf) => kf.scale > 1.05 && kf.time >= overRegion.start && kf.time <= overRegion.end)
            .sort((a, b) => Math.abs(a.time - startT) - Math.abs(b.time - startT))[0]
          if (nearestKf) onSelectId(nearestKf.id)
          return
        }

        // Not over existing region → two-click pending logic
        const pending = pendingZoomStartRef.current
        if (pending !== null) {
          const t0 = Math.min(pending, startT)
          const t1 = Math.max(pending, startT)
          setPendingZoomStart(null)
          pendingZoomStartRef.current = null
          if (t1 - t0 > 0.1) {
            onAddZoomRegion(t0, t1)
          } else {
            onAddZoom(startT)
          }
        } else {
          // First click → set pending start point
          setPendingZoomStart(startT)
          pendingZoomStartRef.current = startT
        }
      }
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }, [getTime, onAddZoom, onAddZoomRegion, onSetTool, onSelectId])

  // ── Text Lane ─────────────────────────────────────────────────────────────

  const [textDragId, setTextDragId] = useState<string | null>(null)
  const [textDragEdge, setTextDragEdge] = useState<'start' | 'end' | 'move' | null>(null)
  const [textHover, setTextHover] = useState<number | null>(null)
  const [isOverTextAnn, setIsOverTextAnn] = useState(false)

  const handleTextLaneClick = useCallback((e: React.MouseEvent) => {
    if (textDragId) return // was a drag, not a click
    const t = getTime(e.clientX, textLaneRef)
    onAddText(t)
  }, [getTime, onAddText, textDragId])

  const startTextDrag = useCallback((ann: TextAnnotation, edge: 'start' | 'end' | 'move') =>
    (e: React.MouseEvent) => {
      e.preventDefault(); e.stopPropagation()
      setTextDragId(ann.id)
      setTextDragEdge(edge)
      const origStart = ann.startTime
      const origEnd = ann.endTime
      const origT = getTime(e.clientX, textLaneRef)

      const move = (ev: MouseEvent) => {
        const t = getTime(ev.clientX, textLaneRef)
        const delta = t - origT
        if (edge === 'start') {
          onUpdateText(ann.id, { startTime: Math.max(0, Math.min(origStart + delta, ann.endTime - 0.1)) })
        } else if (edge === 'end') {
          onUpdateText(ann.id, { endTime: Math.min(duration, Math.max(origEnd + delta, ann.startTime + 0.1)) })
        } else {
          const dur = origEnd - origStart
          const ns = Math.max(0, Math.min(origStart + delta, duration - dur))
          onUpdateText(ann.id, { startTime: ns, endTime: ns + dur })
        }
      }
      const up = () => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
        setTextDragId(null)
        setTextDragEdge(null)
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    }, [getTime, duration, onUpdateText])

  const trimmedStart = toPercent(state.trimStart)
  const trimmedEnd = toPercent(state.trimEnd)
  const playheadPct = toPercent(currentTime)

  const zoomRegions = buildZoomRegions(state.zoomKeyframes, state.trimEnd)

  return (
    <div className="flex flex-col gap-1.5 px-4 pt-2 pb-3 bg-surface-950 border-t border-white/5 select-none">
      {/* Time labels */}
      <div className="flex justify-between text-[10px] text-white/25 font-mono px-1">
        <span>{fmt(state.trimStart)}</span>
        <span className="text-white/40">{fmt(currentTime)}</span>
        <span>{fmt(state.trimEnd)}</span>
      </div>

      {/* ── Main track ───────────────────────────────────────────────────── */}
      <div ref={trackRef}
        className="relative h-9 rounded-lg overflow-visible cursor-pointer"
        onClick={(e) => { onSeek(getTime(e.clientX, trackRef)); onSelectId(null) }}
      >
        <div className="absolute inset-0 rounded-lg bg-surface-900" />
        <div className="absolute top-0 bottom-0 bg-black/60 rounded-l-lg" style={{ left: 0, width: `${trimmedStart}%` }} />
        <div className="absolute top-0 bottom-0 bg-black/60 rounded-r-lg" style={{ left: `${trimmedEnd}%`, right: 0 }} />
        <div className="absolute top-0 bottom-0 bg-white/5 border-t border-b border-white/10"
          style={{ left: `${trimmedStart}%`, width: `${trimmedEnd - trimmedStart}%` }} />

        {/* Playhead */}
        <div className="absolute top-0 bottom-0 w-0.5 bg-white z-20 pointer-events-none" style={{ left: `${playheadPct}%` }}>
          <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full" />
        </div>

        {/* Trim handles */}
        <TrimHandle side="left" percent={trimmedStart}
          onMouseDown={startDrag(trackRef, (t) => onTrimStart(Math.max(0, Math.min(t, state.trimEnd - 0.1))))} />
        <TrimHandle side="right" percent={trimmedEnd}
          onMouseDown={startDrag(trackRef, (t) => onTrimEnd(Math.min(duration, Math.max(t, state.trimStart + 0.1))))} />
      </div>

      {/* ── Zoom Lane ────────────────────────────────────────────────────── */}
      <LaneLabel color="text-amber-500/50">Zoom</LaneLabel>
      <div ref={zoomLaneRef}
        className={clsx(
          'relative h-7 rounded-lg group',
          isOverZoomRegion ? 'cursor-pointer' : 'cursor-crosshair'
        )}
        onMouseDown={handleZoomLaneMouseDown}
        onMouseMove={(e) => {
          const t = getTime(e.clientX, zoomLaneRef)
          setZoomHover(t)
          setIsOverZoomRegion(zoomRegions.some((r) => t >= r.start && t <= r.end))
        }}
        onMouseLeave={() => { setZoomHover(null); setIsOverZoomRegion(false) }}
      >
        <div className="absolute inset-0 rounded-lg bg-amber-950/30 border border-amber-500/10 group-hover:border-amber-500/25 transition-colors" />

        {state.zoomKeyframes.length === 0 && !zoomDragPreview && !pendingZoomStart && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[10px] text-amber-500/35">Click or drag to add zoom</span>
          </div>
        )}
        {pendingZoomStart !== null && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[10px] text-amber-400/60">Click to set end point — Esc to cancel</span>
          </div>
        )}

        {/* Zoom region bars (full span including ramps) */}
        {zoomRegions.map((r, i) => (
          <div key={i}
            className="absolute top-1 bottom-1 rounded bg-amber-500/25 border border-amber-500/35 pointer-events-none"
            style={{ left: `${toPercent(r.start)}%`, width: `${Math.max(0.3, toPercent(r.end) - toPercent(r.start))}%` }}>
            <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-[9px] text-amber-300/70 whitespace-nowrap">{r.scale.toFixed(1)}×</span>
          </div>
        ))}

        {/* Keyframe dots — only peak keyframes (scale > 1.05) */}
        {state.zoomKeyframes.filter((kf) => kf.scale > 1.05).map((kf) => (
          <div key={kf.id}
            className={clsx(
              'absolute top-1/2 -translate-y-1/2 -translate-x-1/2 z-10 w-3 h-3 rounded-full border-2 cursor-pointer transition-all',
              'bg-amber-400 border-amber-200 hover:scale-125',
              state.selectedId === kf.id && 'ring-2 ring-white scale-125'
            )}
            style={{ left: `${toPercent(kf.time)}%` }}
            onClick={(e) => { e.stopPropagation(); onSetTool('zoom'); onSelectId(kf.id) }}
            title="Click to open zoom panel"
          />
        ))}

        {/* Pending zoom start marker */}
        {pendingZoomStart !== null && (
          <div className="absolute top-0 bottom-0 w-0.5 bg-amber-400/80 pointer-events-none z-10"
            style={{ left: `${toPercent(pendingZoomStart)}%` }}>
            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-amber-400 rounded-full" />
          </div>
        )}

        {/* Pending zoom preview on hover */}
        {pendingZoomStart !== null && zoomHover !== null && !zoomDragPreview && (
          <div className="absolute top-1 bottom-1 rounded bg-amber-400/20 border border-dashed border-amber-400/40 pointer-events-none"
            style={{
              left: `${toPercent(Math.min(pendingZoomStart, zoomHover))}%`,
              width: `${Math.max(0.3, Math.abs(toPercent(zoomHover) - toPercent(pendingZoomStart)))}%`
            }} />
        )}

        {/* Drag preview */}
        {zoomDragPreview && (
          <div className="absolute top-1 bottom-1 rounded bg-amber-400/40 border border-amber-400/60 pointer-events-none"
            style={{ left: `${toPercent(zoomDragPreview.start)}%`, width: `${Math.max(0.3, toPercent(zoomDragPreview.end) - toPercent(zoomDragPreview.start))}%` }} />
        )}

        {/* Hover line (only when not over a region and no pending) */}
        {zoomHover !== null && !zoomDragPreview && !isOverZoomRegion && pendingZoomStart === null && (
          <div className="absolute top-0 bottom-0 w-px bg-amber-400/30 pointer-events-none" style={{ left: `${toPercent(zoomHover)}%` }} />
        )}

        {/* Playhead in lane */}
        <div className="absolute top-0 bottom-0 w-px bg-white/20 pointer-events-none z-20" style={{ left: `${playheadPct}%` }} />
      </div>

      {/* ── Text Lane ────────────────────────────────────────────────────── */}
      <LaneLabel color="text-violet-400/50">Text</LaneLabel>
      <div ref={textLaneRef}
        className={clsx(
          'relative h-7 rounded-lg group',
          isOverTextAnn ? 'cursor-pointer' : 'cursor-crosshair'
        )}
        onClick={handleTextLaneClick}
        onMouseMove={(e) => {
          const t = getTime(e.clientX, textLaneRef)
          setTextHover(t)
          setIsOverTextAnn(state.textAnnotations.some((a) => t >= a.startTime && t <= a.endTime))
        }}
        onMouseLeave={() => { setTextHover(null); setIsOverTextAnn(false) }}
      >
        <div className="absolute inset-0 rounded-lg bg-violet-950/30 border border-violet-500/10 group-hover:border-violet-500/25 transition-colors" />

        {state.textAnnotations.length === 0 && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[10px] text-violet-500/35">Click to add text / drag edges to resize</span>
          </div>
        )}

        {/* Text annotation bars */}
        {state.textAnnotations.map((ann) => (
          <div key={ann.id}
            className={clsx(
              'absolute top-1 bottom-1 rounded group/ann flex items-center',
              'bg-violet-500/30 border border-violet-500/50 hover:bg-violet-500/40 transition-colors',
              state.selectedId === ann.id && 'ring-1 ring-violet-300',
              textDragId === ann.id ? 'cursor-grabbing' : 'cursor-pointer'
            )}
            style={{ left: `${toPercent(ann.startTime)}%`, width: `${Math.max(1, toPercent(ann.endTime) - toPercent(ann.startTime))}%` }}
            onClick={(e) => { e.stopPropagation(); onSetTool('text'); onSelectId(ann.id) }}
            onMouseDown={startTextDrag(ann, 'move')}
            title="Click to open text panel · drag to move"
          >
            {/* Left resize handle */}
            <div
              className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-violet-400/40 rounded-l z-10"
              onMouseDown={(e) => { e.stopPropagation(); startTextDrag(ann, 'start')(e) }}
            />
            <span className="absolute inset-x-2 text-[9px] text-violet-200/80 truncate pointer-events-none px-0.5">
              {ann.text || '…'}
            </span>
            {/* Right resize handle */}
            <div
              className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-violet-400/40 rounded-r z-10"
              onMouseDown={(e) => { e.stopPropagation(); startTextDrag(ann, 'end')(e) }}
            />
          </div>
        ))}

        {/* Hover line (only when not over annotation) */}
        {textHover !== null && !isOverTextAnn && (
          <div className="absolute top-0 bottom-0 w-px bg-violet-400/30 pointer-events-none" style={{ left: `${toPercent(textHover)}%` }} />
        )}

        {/* Playhead in lane */}
        <div className="absolute top-0 bottom-0 w-px bg-white/20 pointer-events-none z-20" style={{ left: `${playheadPct}%` }} />
      </div>

      {/* Status row */}
      <div className="flex items-center gap-4 text-[10px] text-white/20 px-1 pt-0.5">
        <span>Duration: <span className="text-white/35">{fmt(state.trimEnd - state.trimStart)}</span></span>
        {zoomRegions.length > 0 && (
          <span className="text-amber-500/50">{zoomRegions.length} zoom</span>
        )}
        {state.textAnnotations.length > 0 && (
          <span className="text-violet-400/50">{state.textAnnotations.length} text</span>
        )}
        <span className="text-white/15 ml-auto">click item to open panel</span>
      </div>
    </div>
  )
}

function LaneLabel({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div className={clsx('text-[9px] font-semibold uppercase tracking-widest px-1', color)}>
      {children}
    </div>
  )
}

/** Build display regions: each zoom "block" as one region spanning entry→exit keyframes */
function buildZoomRegions(keyframes: ZoomKeyframe[], trimEnd: number) {
  if (keyframes.length === 0) return []
  const sorted = [...keyframes].sort((a, b) => a.time - b.time)
  const regions: { start: number; end: number; scale: number }[] = []

  for (let i = 0; i < sorted.length; i++) {
    const kf = sorted[i]
    if (kf.scale <= 1.05) continue // skip boundary keyframes

    // Find the display start: previous scale≈1.0 keyframe (ramp entry)
    const prev = i > 0 ? sorted[i - 1] : null
    const regionStart = prev && prev.scale <= 1.05 ? prev.time : kf.time

    // Advance through all consecutive peak keyframes
    let j = i
    let maxScale = kf.scale
    while (j + 1 < sorted.length && sorted[j + 1].scale > 1.05) {
      j++
      maxScale = Math.max(maxScale, sorted[j].scale)
    }

    // Find the display end: next scale≈1.0 keyframe (ramp exit)
    const next = j + 1 < sorted.length ? sorted[j + 1] : null
    const regionEnd = next && next.scale <= 1.05 ? next.time : trimEnd

    regions.push({ start: regionStart, end: regionEnd, scale: maxScale })
    i = j // skip past processed peak keyframes
  }

  return regions
}

function TrimHandle({ side, percent, onMouseDown }: {
  side: 'left' | 'right'; percent: number; onMouseDown: (e: React.MouseEvent) => void
}) {
  return (
    <div className="absolute top-0 bottom-0 w-3 cursor-ew-resize z-10 flex items-center justify-center -translate-x-1.5"
      style={{ left: `${percent}%` }}
      onMouseDown={onMouseDown}
      onClick={(e) => e.stopPropagation()}>
      <div className="w-1.5 h-6 bg-purple-500 rounded-full shadow-lg shadow-purple-500/30" />
    </div>
  )
}
