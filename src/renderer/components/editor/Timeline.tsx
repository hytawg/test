import { useRef, useCallback, useState, useEffect } from 'react'
import type { EditState, ZoomRegion, TextAnnotation, SpeedSegment, CutSegment } from '../../types'
import clsx from 'clsx'
import { X } from 'lucide-react'

type Props = {
  state: EditState
  currentTime: number
  onSeek: (t: number) => void
  onTrimStart: (t: number) => void
  onTrimEnd: (t: number) => void
  onSelectId: (id: string | null) => void
  onSetTool: (tool: 'select' | 'zoom' | 'text' | 'speed') => void
  // Zoom lane
  onAddZoomAtTime: (time: number) => void
  onAddZoomRegion: (startTime: number, endTime: number) => void
  onUpdateZoomRegion: (id: string, patch: Partial<ZoomRegion>) => void
  onRemoveZoom: (id: string) => void
  // Text lane
  onAddText: (time: number) => void
  onUpdateText: (id: string, patch: Partial<TextAnnotation>) => void
  onRemoveText: (id: string) => void
  // Speed lane
  onAddSpeedSegment: (startTime: number, endTime: number) => void
  onUpdateSpeedSegment: (id: string, patch: Partial<SpeedSegment>) => void
  onRemoveSpeedSegment: (id: string) => void
  // Cut lane
  onAddCutSegment: (startTime: number, endTime: number) => void
  onUpdateCutSegment: (id: string, patch: Partial<CutSegment>) => void
  onRemoveCutSegment: (id: string) => void
}

function fmt(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  const ms = Math.floor((s % 1) * 10)
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}.${ms}`
}

function speedColor(speed: number): string {
  if (speed < 0.8) return 'bg-blue-500/30 border-blue-500/50'
  if (speed > 1.2) return 'bg-orange-500/30 border-orange-500/50'
  return 'bg-green-500/30 border-green-500/50'
}

function speedColorSelected(speed: number): string {
  if (speed < 0.8) return 'bg-blue-500/50 border-blue-400/70 ring-1 ring-blue-300/40'
  if (speed > 1.2) return 'bg-orange-500/50 border-orange-400/70 ring-1 ring-orange-300/40'
  return 'bg-green-500/50 border-green-400/70 ring-1 ring-green-300/40'
}

export function Timeline({
  state, currentTime,
  onSeek, onTrimStart, onTrimEnd, onSelectId, onSetTool,
  onAddZoomAtTime, onAddZoomRegion, onUpdateZoomRegion, onRemoveZoom,
  onAddText, onUpdateText, onRemoveText,
  onAddSpeedSegment, onUpdateSpeedSegment, onRemoveSpeedSegment,
  onAddCutSegment, onUpdateCutSegment, onRemoveCutSegment
}: Props) {
  const trackRef = useRef<HTMLDivElement>(null)
  const zoomLaneRef = useRef<HTMLDivElement>(null)
  const textLaneRef = useRef<HTMLDivElement>(null)
  const speedLaneRef = useRef<HTMLDivElement>(null)
  const cutLaneRef = useRef<HTMLDivElement>(null)
  const duration = state.rawDuration

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
        setPendingZoomStart(null)
        pendingZoomStartRef.current = null
        onAddZoomRegion(Math.min(startT, lastT), Math.max(startT, lastT))
        return
      }

      // Single click — check if over an existing zoom region
      const s = stateRef.current
      const overRegion = s.zoomRegions.find((r) => startT >= r.startTime && startT <= r.endTime)
      if (overRegion) {
        onSetTool('zoom')
        onSelectId(overRegion.id)
        return
      }

      // Two-click logic on empty space
      const pending = pendingZoomStartRef.current
      if (pending !== null) {
        const t0 = Math.min(pending, startT)
        const t1 = Math.max(pending, startT)
        setPendingZoomStart(null)
        pendingZoomStartRef.current = null
        if (t1 - t0 > 0.1) {
          onAddZoomRegion(t0, t1)
        } else {
          onAddZoomAtTime(startT)
        }
      } else {
        setPendingZoomStart(startT)
        pendingZoomStartRef.current = startT
      }
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }, [getTime, onAddZoomAtTime, onAddZoomRegion, onSetTool, onSelectId])

  // ── Zoom segment resize/move ──────────────────────────────────────────────

  const [zoomDragId, setZoomDragId] = useState<string | null>(null)

  const startZoomDrag = useCallback((r: ZoomRegion, edge: 'start' | 'end' | 'move') =>
    (e: React.MouseEvent) => {
      e.preventDefault(); e.stopPropagation()
      setZoomDragId(r.id)
      onSetTool('zoom'); onSelectId(r.id)
      const origStart = r.startTime; const origEnd = r.endTime
      const origT = getTime(e.clientX, zoomLaneRef)

      const move = (ev: MouseEvent) => {
        const t = getTime(ev.clientX, zoomLaneRef)
        const delta = t - origT
        if (edge === 'start') {
          onUpdateZoomRegion(r.id, { startTime: Math.max(0, Math.min(origStart + delta, origEnd - 0.1)) })
        } else if (edge === 'end') {
          onUpdateZoomRegion(r.id, { endTime: Math.min(duration, Math.max(origEnd + delta, origStart + 0.1)) })
        } else {
          const dur = origEnd - origStart
          const ns = Math.max(0, Math.min(origStart + delta, duration - dur))
          onUpdateZoomRegion(r.id, { startTime: ns, endTime: ns + dur })
        }
      }
      const up = () => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
        setZoomDragId(null)
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    }, [getTime, duration, onUpdateZoomRegion, onSetTool, onSelectId])

  // ── Text Lane ─────────────────────────────────────────────────────────────

  const [textDragId, setTextDragId] = useState<string | null>(null)
  const [textHover, setTextHover] = useState<number | null>(null)
  const [isOverTextAnn, setIsOverTextAnn] = useState(false)

  const handleTextLaneClick = useCallback((e: React.MouseEvent) => {
    if (textDragId) return
    const t = getTime(e.clientX, textLaneRef)
    onAddText(t)
  }, [getTime, onAddText, textDragId])

  const startTextDrag = useCallback((ann: TextAnnotation, edge: 'start' | 'end' | 'move') =>
    (e: React.MouseEvent) => {
      e.preventDefault(); e.stopPropagation()
      setTextDragId(ann.id)
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
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    }, [getTime, duration, onUpdateText])

  // ── Speed Lane ────────────────────────────────────────────────────────────

  const [speedDragPreview, setSpeedDragPreview] = useState<{ start: number; end: number } | null>(null)
  const [speedHover, setSpeedHover] = useState<number | null>(null)
  const [isOverSpeedSeg, setIsOverSpeedSeg] = useState(false)
  const [pendingSpeedStart, setPendingSpeedStart] = useState<number | null>(null)
  const pendingSpeedStartRef = useRef<number | null>(null)

  useEffect(() => {
    if (pendingSpeedStart === null) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setPendingSpeedStart(null)
        pendingSpeedStartRef.current = null
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pendingSpeedStart])

  const handleSpeedLaneMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    const startT = getTime(e.clientX, speedLaneRef)
    let lastT = startT
    let isDragging = false

    const move = (ev: MouseEvent) => {
      const t = getTime(ev.clientX, speedLaneRef)
      if (Math.abs(t - startT) > 0.15) {
        isDragging = true
        setSpeedDragPreview({ start: Math.min(startT, t), end: Math.max(startT, t) })
      }
      lastT = t
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      setSpeedDragPreview(null)

      if (isDragging && Math.abs(lastT - startT) > 0.15) {
        setPendingSpeedStart(null)
        pendingSpeedStartRef.current = null
        onAddSpeedSegment(Math.min(startT, lastT), Math.max(startT, lastT))
        return
      }

      // Single click — check if over an existing speed segment
      const s = stateRef.current
      const overSeg = s.speedSegments.find((seg) => startT >= seg.startTime && startT <= seg.endTime)
      if (overSeg) {
        onSetTool('speed')
        onSelectId(overSeg.id)
        return
      }

      // Two-click logic
      const pending = pendingSpeedStartRef.current
      if (pending !== null) {
        const t0 = Math.min(pending, startT)
        const t1 = Math.max(pending, startT)
        setPendingSpeedStart(null)
        pendingSpeedStartRef.current = null
        if (t1 - t0 > 0.1) onAddSpeedSegment(t0, t1)
      } else {
        setPendingSpeedStart(startT)
        pendingSpeedStartRef.current = startT
      }
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }, [getTime, onAddSpeedSegment, onSetTool, onSelectId])

  // ── Speed segment resize/move ─────────────────────────────────────────────

  const [speedResizeDragId, setSpeedResizeDragId] = useState<string | null>(null)

  const startSpeedDrag = useCallback((seg: SpeedSegment, edge: 'start' | 'end' | 'move') =>
    (e: React.MouseEvent) => {
      e.preventDefault(); e.stopPropagation()
      setSpeedResizeDragId(seg.id)
      onSetTool('speed'); onSelectId(seg.id)
      const origStart = seg.startTime; const origEnd = seg.endTime
      const origT = getTime(e.clientX, speedLaneRef)

      const move = (ev: MouseEvent) => {
        const t = getTime(ev.clientX, speedLaneRef)
        const delta = t - origT
        if (edge === 'start') {
          onUpdateSpeedSegment(seg.id, { startTime: Math.max(0, Math.min(origStart + delta, origEnd - 0.1)) })
        } else if (edge === 'end') {
          onUpdateSpeedSegment(seg.id, { endTime: Math.min(duration, Math.max(origEnd + delta, origStart + 0.1)) })
        } else {
          const dur = origEnd - origStart
          const ns = Math.max(0, Math.min(origStart + delta, duration - dur))
          onUpdateSpeedSegment(seg.id, { startTime: ns, endTime: ns + dur })
        }
      }
      const up = () => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
        setSpeedResizeDragId(null)
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    }, [getTime, duration, onUpdateSpeedSegment, onSetTool, onSelectId])

  // ── Cut Lane ──────────────────────────────────────────────────────────────

  const [cutDragPreview, setCutDragPreview] = useState<{ start: number; end: number } | null>(null)
  const [cutHover, setCutHover] = useState<number | null>(null)
  const [isOverCutSeg, setIsOverCutSeg] = useState(false)
  const [cutResizeDragId, setCutResizeDragId] = useState<string | null>(null)

  const handleCutLaneMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault(); e.stopPropagation()
    const startT = getTime(e.clientX, cutLaneRef)
    let lastT = startT
    let isDragging = false

    const move = (ev: MouseEvent) => {
      const t = getTime(ev.clientX, cutLaneRef)
      if (Math.abs(t - startT) > 0.15) {
        isDragging = true
        setCutDragPreview({ start: Math.min(startT, t), end: Math.max(startT, t) })
      }
      lastT = t
    }
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      setCutDragPreview(null)
      if (isDragging && Math.abs(lastT - startT) > 0.15) {
        onAddCutSegment(Math.min(startT, lastT), Math.max(startT, lastT))
      } else {
        const overCut = stateRef.current.cutSegments.find(c => startT >= c.startTime && startT <= c.endTime)
        if (overCut) onSelectId(overCut.id)
      }
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }, [getTime, onAddCutSegment, onSelectId])

  const startCutDrag = useCallback((c: CutSegment, edge: 'start' | 'end' | 'move') =>
    (e: React.MouseEvent) => {
      e.preventDefault(); e.stopPropagation()
      setCutResizeDragId(c.id)
      onSelectId(c.id)
      const origStart = c.startTime; const origEnd = c.endTime
      const origT = getTime(e.clientX, cutLaneRef)

      const move = (ev: MouseEvent) => {
        const t = getTime(ev.clientX, cutLaneRef)
        const delta = t - origT
        if (edge === 'start') {
          onUpdateCutSegment(c.id, { startTime: Math.max(0, Math.min(origStart + delta, origEnd - 0.1)) })
        } else if (edge === 'end') {
          onUpdateCutSegment(c.id, { endTime: Math.min(duration, Math.max(origEnd + delta, origStart + 0.1)) })
        } else {
          const dur = origEnd - origStart
          const ns = Math.max(0, Math.min(origStart + delta, duration - dur))
          onUpdateCutSegment(c.id, { startTime: ns, endTime: ns + dur })
        }
      }
      const up = () => {
        window.removeEventListener('mousemove', move)
        window.removeEventListener('mouseup', up)
        setCutResizeDragId(null)
      }
      window.addEventListener('mousemove', move)
      window.addEventListener('mouseup', up)
    }, [getTime, duration, onUpdateCutSegment, onSelectId])

  const trimmedStart = toPercent(state.trimStart)
  const trimmedEnd = toPercent(state.trimEnd)
  const playheadPct = toPercent(currentTime)

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

        {/* Cut overlays on main track */}
        {state.cutSegments.map((c) => (
          <div key={c.id}
            className="absolute top-0 bottom-0 pointer-events-none z-5"
            style={{ left: `${toPercent(c.startTime)}%`, width: `${Math.max(0.3, toPercent(c.endTime) - toPercent(c.startTime))}%` }}>
            <div className="absolute inset-0 bg-red-500/20 border-x border-red-500/40"
              style={{ backgroundImage: 'repeating-linear-gradient(-45deg, transparent, transparent 4px, rgba(239,68,68,0.08) 4px, rgba(239,68,68,0.08) 8px)' }} />
          </div>
        ))}

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
          setIsOverZoomRegion(state.zoomRegions.some((r) => t >= r.startTime && t <= r.endTime))
        }}
        onMouseLeave={() => { setZoomHover(null); setIsOverZoomRegion(false) }}
      >
        <div className="absolute inset-0 rounded-lg bg-amber-950/30 border border-amber-500/10 group-hover:border-amber-500/25 transition-colors" />

        {state.zoomRegions.length === 0 && !zoomDragPreview && !pendingZoomStart && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[10px] text-amber-500/35">Click or drag to add zoom</span>
          </div>
        )}
        {pendingZoomStart !== null && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[10px] text-amber-400/60">Click to set end point — Esc to cancel</span>
          </div>
        )}

        {/* Zoom region bars */}
        {state.zoomRegions.map((r) => (
          <div key={r.id}
            className={clsx(
              'absolute top-1 bottom-1 rounded border group/item flex items-center',
              zoomDragId === r.id ? 'cursor-grabbing' : 'cursor-grab',
              state.selectedId === r.id
                ? 'bg-amber-500/40 border-amber-400/60 ring-1 ring-amber-300/40'
                : 'bg-amber-500/25 border-amber-500/35'
            )}
            style={{
              left: `${toPercent(r.startTime)}%`,
              width: `${Math.max(0.3, toPercent(r.endTime) - toPercent(r.startTime))}%`
            }}
            onMouseDown={startZoomDrag(r, 'move')}
          >
            {/* Left resize handle */}
            <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-amber-400/40 rounded-l z-10"
              onMouseDown={(e) => { e.stopPropagation(); startZoomDrag(r, 'start')(e) }} />
            <span className="absolute inset-x-2 text-[9px] text-amber-300/70 whitespace-nowrap pointer-events-none truncate px-0.5">
              {r.scale.toFixed(1)}×
            </span>
            {/* Delete button */}
            <button
              className="absolute right-0.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover/item:opacity-100 hover:bg-red-500/30 hover:text-red-300 text-white/40 transition-all pointer-events-auto z-20"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
              onClick={(e) => { e.stopPropagation(); onRemoveZoom(r.id) }}
            >
              <X size={9} />
            </button>
            {/* Right resize handle */}
            <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-amber-400/40 rounded-r z-10"
              onMouseDown={(e) => { e.stopPropagation(); startZoomDrag(r, 'end')(e) }} />
          </div>
        ))}

        {/* Pending start marker */}
        {pendingZoomStart !== null && (
          <div className="absolute top-0 bottom-0 w-0.5 bg-amber-400/80 pointer-events-none z-10"
            style={{ left: `${toPercent(pendingZoomStart)}%` }}>
            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-amber-400 rounded-full" />
          </div>
        )}

        {/* Preview of pending region on hover */}
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
            style={{
              left: `${toPercent(zoomDragPreview.start)}%`,
              width: `${Math.max(0.3, toPercent(zoomDragPreview.end) - toPercent(zoomDragPreview.start))}%`
            }} />
        )}

        {/* Hover line (only on empty space) */}
        {zoomHover !== null && !zoomDragPreview && !isOverZoomRegion && pendingZoomStart === null && (
          <div className="absolute top-0 bottom-0 w-px bg-amber-400/30 pointer-events-none"
            style={{ left: `${toPercent(zoomHover)}%` }} />
        )}

        <div className="absolute top-0 bottom-0 w-px bg-white/20 pointer-events-none z-20"
          style={{ left: `${playheadPct}%` }} />
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

        {state.textAnnotations.map((ann) => (
          <div key={ann.id}
            className={clsx(
              'absolute top-1 bottom-1 rounded flex items-center group/item',
              'bg-violet-500/30 border border-violet-500/50 hover:bg-violet-500/40 transition-colors',
              state.selectedId === ann.id && 'ring-1 ring-violet-300',
              textDragId === ann.id ? 'cursor-grabbing' : 'cursor-pointer'
            )}
            style={{
              left: `${toPercent(ann.startTime)}%`,
              width: `${Math.max(1, toPercent(ann.endTime) - toPercent(ann.startTime))}%`
            }}
            onClick={(e) => { e.stopPropagation(); onSetTool('text'); onSelectId(ann.id) }}
            onMouseDown={startTextDrag(ann, 'move')}
          >
            <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-violet-400/40 rounded-l z-10"
              onMouseDown={(e) => { e.stopPropagation(); startTextDrag(ann, 'start')(e) }} />
            <span className="absolute inset-x-2 text-[9px] text-violet-200/80 truncate pointer-events-none px-0.5">
              {ann.text || '…'}
            </span>
            {/* Delete button */}
            <button
              className="absolute right-0.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover/item:opacity-100 hover:bg-red-500/30 hover:text-red-300 text-white/40 transition-all z-20"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
              onClick={(e) => { e.stopPropagation(); onRemoveText(ann.id) }}
            >
              <X size={9} />
            </button>
            <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-violet-400/40 rounded-r z-10"
              onMouseDown={(e) => { e.stopPropagation(); startTextDrag(ann, 'end')(e) }} />
          </div>
        ))}

        {textHover !== null && !isOverTextAnn && (
          <div className="absolute top-0 bottom-0 w-px bg-violet-400/30 pointer-events-none"
            style={{ left: `${toPercent(textHover)}%` }} />
        )}

        <div className="absolute top-0 bottom-0 w-px bg-white/20 pointer-events-none z-20"
          style={{ left: `${playheadPct}%` }} />
      </div>

      {/* ── Speed Lane ───────────────────────────────────────────────────── */}
      <LaneLabel color="text-cyan-400/50">Speed</LaneLabel>
      <div ref={speedLaneRef}
        className={clsx(
          'relative h-7 rounded-lg group',
          isOverSpeedSeg ? 'cursor-pointer' : 'cursor-crosshair'
        )}
        onMouseDown={handleSpeedLaneMouseDown}
        onMouseMove={(e) => {
          const t = getTime(e.clientX, speedLaneRef)
          setSpeedHover(t)
          setIsOverSpeedSeg(state.speedSegments.some((seg) => t >= seg.startTime && t <= seg.endTime))
        }}
        onMouseLeave={() => { setSpeedHover(null); setIsOverSpeedSeg(false) }}
      >
        <div className="absolute inset-0 rounded-lg bg-cyan-950/20 border border-cyan-500/10 group-hover:border-cyan-500/25 transition-colors" />

        {state.speedSegments.length === 0 && !speedDragPreview && !pendingSpeedStart && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[10px] text-cyan-500/35">Click or drag to set speed range</span>
          </div>
        )}
        {pendingSpeedStart !== null && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[10px] text-cyan-400/60">Click to set end point — Esc to cancel</span>
          </div>
        )}

        {/* Speed segment bars */}
        {state.speedSegments.map((seg) => (
          <div key={seg.id}
            className={clsx(
              'absolute top-1 bottom-1 rounded border group/item flex items-center',
              speedResizeDragId === seg.id ? 'cursor-grabbing' : 'cursor-grab',
              state.selectedId === seg.id ? speedColorSelected(seg.speed) : speedColor(seg.speed)
            )}
            style={{
              left: `${toPercent(seg.startTime)}%`,
              width: `${Math.max(0.3, toPercent(seg.endTime) - toPercent(seg.startTime))}%`
            }}
            onMouseDown={startSpeedDrag(seg, 'move')}
          >
            {/* Left resize handle */}
            <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 rounded-l z-10"
              onMouseDown={(e) => { e.stopPropagation(); startSpeedDrag(seg, 'start')(e) }} />
            <span className="absolute inset-x-2 text-[9px] text-white/70 whitespace-nowrap pointer-events-none truncate px-0.5">
              {seg.speed.toFixed(1)}×
            </span>
            {/* Delete button */}
            <button
              className="absolute right-0.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover/item:opacity-100 hover:bg-red-500/30 hover:text-red-300 text-white/40 transition-all pointer-events-auto z-20"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
              onClick={(e) => { e.stopPropagation(); onRemoveSpeedSegment(seg.id) }}
            >
              <X size={9} />
            </button>
            {/* Right resize handle */}
            <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-white/20 rounded-r z-10"
              onMouseDown={(e) => { e.stopPropagation(); startSpeedDrag(seg, 'end')(e) }} />
          </div>
        ))}

        {/* Pending start marker */}
        {pendingSpeedStart !== null && (
          <div className="absolute top-0 bottom-0 w-0.5 bg-cyan-400/80 pointer-events-none z-10"
            style={{ left: `${toPercent(pendingSpeedStart)}%` }}>
            <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-2 h-2 bg-cyan-400 rounded-full" />
          </div>
        )}

        {/* Preview of pending region on hover */}
        {pendingSpeedStart !== null && speedHover !== null && !speedDragPreview && (
          <div className="absolute top-1 bottom-1 rounded bg-cyan-400/20 border border-dashed border-cyan-400/40 pointer-events-none"
            style={{
              left: `${toPercent(Math.min(pendingSpeedStart, speedHover))}%`,
              width: `${Math.max(0.3, Math.abs(toPercent(speedHover) - toPercent(pendingSpeedStart)))}%`
            }} />
        )}

        {/* Drag preview */}
        {speedDragPreview && (
          <div className="absolute top-1 bottom-1 rounded bg-cyan-400/40 border border-cyan-400/60 pointer-events-none"
            style={{
              left: `${toPercent(speedDragPreview.start)}%`,
              width: `${Math.max(0.3, toPercent(speedDragPreview.end) - toPercent(speedDragPreview.start))}%`
            }} />
        )}

        {/* Hover line */}
        {speedHover !== null && !speedDragPreview && !isOverSpeedSeg && pendingSpeedStart === null && (
          <div className="absolute top-0 bottom-0 w-px bg-cyan-400/30 pointer-events-none"
            style={{ left: `${toPercent(speedHover)}%` }} />
        )}

        <div className="absolute top-0 bottom-0 w-px bg-white/20 pointer-events-none z-20"
          style={{ left: `${playheadPct}%` }} />
      </div>

      {/* ── Cut Lane ─────────────────────────────────────────────────────── */}
      <LaneLabel color="text-red-400/50">Cut</LaneLabel>
      <div ref={cutLaneRef}
        className={clsx(
          'relative h-7 rounded-lg group',
          isOverCutSeg ? 'cursor-pointer' : 'cursor-crosshair'
        )}
        onMouseDown={handleCutLaneMouseDown}
        onMouseMove={(e) => {
          const t = getTime(e.clientX, cutLaneRef)
          setCutHover(t)
          setIsOverCutSeg(state.cutSegments.some((c) => t >= c.startTime && t <= c.endTime))
        }}
        onMouseLeave={() => { setCutHover(null); setIsOverCutSeg(false) }}
      >
        <div className="absolute inset-0 rounded-lg bg-red-950/20 border border-red-500/10 group-hover:border-red-500/25 transition-colors" />

        {state.cutSegments.length === 0 && !cutDragPreview && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <span className="text-[10px] text-red-500/35">Drag to cut out a section</span>
          </div>
        )}

        {/* Cut segment bars */}
        {state.cutSegments.map((c) => (
          <div key={c.id}
            className={clsx(
              'absolute top-1 bottom-1 rounded border group/item flex items-center',
              cutResizeDragId === c.id ? 'cursor-grabbing' : 'cursor-grab',
              state.selectedId === c.id
                ? 'bg-red-500/50 border-red-400/70 ring-1 ring-red-300/40'
                : 'bg-red-500/30 border-red-500/40'
            )}
            style={{
              left: `${toPercent(c.startTime)}%`,
              width: `${Math.max(0.3, toPercent(c.endTime) - toPercent(c.startTime))}%`
            }}
            onMouseDown={startCutDrag(c, 'move')}
          >
            <div className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-red-300/30 rounded-l z-10"
              onMouseDown={(e) => { e.stopPropagation(); startCutDrag(c, 'start')(e) }} />
            <span className="absolute inset-x-2 text-[9px] text-red-200/70 whitespace-nowrap pointer-events-none truncate px-0.5">
              {fmt(c.startTime)}–{fmt(c.endTime)}
            </span>
            <button
              className="absolute right-0.5 top-1/2 -translate-y-1/2 w-4 h-4 rounded flex items-center justify-center opacity-0 group-hover/item:opacity-100 hover:bg-red-500/40 hover:text-red-200 text-white/40 transition-all pointer-events-auto z-20"
              onMouseDown={(e) => { e.preventDefault(); e.stopPropagation() }}
              onClick={(e) => { e.stopPropagation(); onRemoveCutSegment(c.id) }}
            >
              <X size={9} />
            </button>
            <div className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize hover:bg-red-300/30 rounded-r z-10"
              onMouseDown={(e) => { e.stopPropagation(); startCutDrag(c, 'end')(e) }} />
          </div>
        ))}

        {/* Drag preview */}
        {cutDragPreview && (
          <div className="absolute top-1 bottom-1 rounded bg-red-400/40 border border-red-400/60 pointer-events-none"
            style={{
              left: `${toPercent(cutDragPreview.start)}%`,
              width: `${Math.max(0.3, toPercent(cutDragPreview.end) - toPercent(cutDragPreview.start))}%`
            }} />
        )}

        {/* Hover line */}
        {cutHover !== null && !cutDragPreview && !isOverCutSeg && (
          <div className="absolute top-0 bottom-0 w-px bg-red-400/30 pointer-events-none"
            style={{ left: `${toPercent(cutHover)}%` }} />
        )}

        <div className="absolute top-0 bottom-0 w-px bg-white/20 pointer-events-none z-20"
          style={{ left: `${playheadPct}%` }} />
      </div>

      {/* Status row */}
      <div className="flex items-center gap-4 text-[10px] text-white/20 px-1 pt-0.5">
        <span>Duration: <span className="text-white/35">{fmt(state.trimEnd - state.trimStart)}</span></span>
        {state.zoomRegions.length > 0 && (
          <span className="text-amber-500/50">{state.zoomRegions.length} zoom</span>
        )}
        {state.textAnnotations.length > 0 && (
          <span className="text-violet-400/50">{state.textAnnotations.length} text</span>
        )}
        {state.speedSegments.length > 0 && (
          <span className="text-cyan-400/50">{state.speedSegments.length} speed</span>
        )}
        {state.cutSegments.length > 0 && (
          <span className="text-red-400/50">{state.cutSegments.length} cut</span>
        )}
        <span className="text-white/15 ml-auto">hover item → ✕ to delete</span>
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
