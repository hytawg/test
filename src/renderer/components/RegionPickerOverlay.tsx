import { useState, useCallback, useEffect, useRef } from 'react'

type Point = { x: number; y: number }
type Region = { x: number; y: number; w: number; h: number }

export function RegionPickerOverlay() {
  const [dragStart, setDragStart] = useState<Point | null>(null)
  const [dragCurrent, setDragCurrent] = useState<Point | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const getNormalized = useCallback((clientX: number, clientY: number): Point => {
    return {
      x: Math.max(0, Math.min(1, clientX / window.innerWidth)),
      y: Math.max(0, Math.min(1, clientY / window.innerHeight))
    }
  }, [])

  const cancel = useCallback(() => {
    window.electronAPI?.sendRegionPickerResult(null)
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    const pos = getNormalized(e.clientX, e.clientY)
    setDragStart(pos)
    setDragCurrent(pos)

    const move = (ev: MouseEvent) => {
      setDragCurrent(getNormalized(ev.clientX, ev.clientY))
    }
    const up = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      const end = getNormalized(ev.clientX, ev.clientY)
      const x = Math.min(pos.x, end.x)
      const y = Math.min(pos.y, end.y)
      const w = Math.abs(end.x - pos.x)
      const h = Math.abs(end.y - pos.y)
      if (w > 0.01 && h > 0.01) {
        const region: Region = { x, y, w, h }
        window.electronAPI?.sendRegionPickerResult(region)
      } else {
        setDragStart(null)
        setDragCurrent(null)
      }
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }, [getNormalized])

  // ESC to cancel
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') cancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [cancel])

  const selRect = dragStart && dragCurrent ? {
    left: Math.min(dragStart.x, dragCurrent.x) * 100,
    top: Math.min(dragStart.y, dragCurrent.y) * 100,
    width: Math.abs(dragCurrent.x - dragStart.x) * 100,
    height: Math.abs(dragCurrent.y - dragStart.y) * 100,
  } : null

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 cursor-crosshair"
      style={{ background: 'transparent' }}
      onMouseDown={handleMouseDown}
    >
      {/* Dim overlay (only when dragging) */}
      {selRect ? (
        <svg
          className="absolute inset-0 pointer-events-none"
          width="100%" height="100%"
          style={{ position: 'fixed', top: 0, left: 0 }}
        >
          <defs>
            <mask id="hole">
              <rect width="100%" height="100%" fill="white" />
              <rect
                x={`${selRect.left}%`}
                y={`${selRect.top}%`}
                width={`${selRect.width}%`}
                height={`${selRect.height}%`}
                fill="black"
              />
            </mask>
          </defs>
          <rect width="100%" height="100%" fill="rgba(0,0,0,0.45)" mask="url(#hole)" />
          {/* Selection border */}
          <rect
            x={`${selRect.left}%`}
            y={`${selRect.top}%`}
            width={`${selRect.width}%`}
            height={`${selRect.height}%`}
            fill="none"
            stroke="rgba(168,85,247,0.9)"
            strokeWidth="2"
            strokeDasharray="6 3"
          />
        </svg>
      ) : (
        /* Subtle dim before drag starts */
        <div className="absolute inset-0 pointer-events-none" style={{ background: 'rgba(0,0,0,0.15)' }} />
      )}

      {/* Instruction */}
      {!dragStart && (
        <div
          className="absolute left-1/2 -translate-x-1/2 pointer-events-none"
          style={{ top: 24 }}
        >
          <div className="px-4 py-2 rounded-xl bg-black/70 backdrop-blur-md text-white text-xs font-medium flex items-center gap-3">
            <span>ドラッグして収録範囲を選択</span>
            <span className="text-white/40">ESC でキャンセル</span>
          </div>
        </div>
      )}
    </div>
  )
}
