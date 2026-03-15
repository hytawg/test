import type { ZoomRegion } from '../../types'
import { Trash2 } from 'lucide-react'
import { Slider } from '../ui/Slider'
import clsx from 'clsx'

type Props = {
  regions: ZoomRegion[]
  selectedId: string | null
  currentTime: number
  onUpdate: (id: string, patch: Partial<ZoomRegion>) => void
  onRemove: (id: string) => void
  onSelect: (id: string | null) => void
}

function fmt(s: number) {
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(1)
  return `${m}:${sec.padStart(4, '0')}`
}

export function ZoomPanel({ regions, selectedId, currentTime, onUpdate, onRemove, onSelect }: Props) {
  const selected = regions.find((r) => r.id === selectedId)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Zoom Regions</p>
        <span className="text-[10px] text-amber-400/60">Click preview or timeline to add</span>
      </div>

      {/* Region list */}
      <div className="flex flex-col gap-1">
        {regions.length === 0 && (
          <p className="text-xs text-white/20 text-center py-4">
            プレビューをクリックするか、タイムラインをドラッグしてズーム領域を追加します。
          </p>
        )}
        {regions.map((r) => (
          <button
            key={r.id}
            onClick={() => onSelect(r.id === selectedId ? null : r.id)}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all',
              selectedId === r.id
                ? 'border-amber-500/50 bg-amber-500/10'
                : 'border-white/5 bg-white/3 hover:border-white/15'
            )}
          >
            <div className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
            <span className="text-xs text-white/60 font-mono flex-1">
              {fmt(r.startTime)} → {fmt(r.endTime)}
            </span>
            <span className="text-[10px] text-white/30">{r.scale.toFixed(1)}×</span>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(r.id) }}
              className="ml-1 p-0.5 rounded hover:bg-white/10 text-white/20 hover:text-red-400 transition-all"
            >
              <Trash2 size={11} />
            </button>
          </button>
        ))}
      </div>

      {/* Selected region editor */}
      {selected && (
        <div className="flex flex-col gap-3 p-3 rounded-xl bg-white/3 border border-white/5">
          <p className="text-[10px] font-semibold text-amber-400/70 uppercase tracking-wider">
            Zoom Region
          </p>

          {/* Time range with "set to playhead" buttons */}
          <div className="flex flex-col gap-1.5">
            <TimeRow
              label="Start"
              value={selected.startTime}
              onSetPlayhead={() => onUpdate(selected.id, { startTime: Math.min(currentTime, selected.endTime - 0.2) })}
            />
            <TimeRow
              label="End"
              value={selected.endTime}
              onSetPlayhead={() => onUpdate(selected.id, { endTime: Math.max(currentTime, selected.startTime + 0.2) })}
            />
          </div>

          {/* Zoom level */}
          <div>
            <p className="text-[10px] text-white/30 mb-1.5">Zoom level</p>
            <Slider
              min={11}
              max={40}
              step={1}
              value={Math.round(selected.scale * 10)}
              onChange={(v) => onUpdate(selected.id, { scale: v / 10 })}
              label={`${selected.scale.toFixed(1)}×`}
            />
          </div>

          {/* Focus point */}
          <div>
            <p className="text-[10px] text-white/30 mb-2">Focus point</p>
            <FocusPicker
              x={selected.x}
              y={selected.y}
              onChange={(x, y) => onUpdate(selected.id, { x, y })}
            />
          </div>

          {/* Easing */}
          <div>
            <p className="text-[10px] text-white/30 mb-1.5">Easing</p>
            <div className="flex gap-1.5">
              {(['linear', 'ease-in-out'] as const).map((e) => (
                <button
                  key={e}
                  onClick={() => onUpdate(selected.id, { easing: e })}
                  className={clsx(
                    'flex-1 py-1.5 rounded-lg text-[10px] font-medium transition-all',
                    selected.easing === e
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-white/5 text-white/40 hover:bg-white/8'
                  )}
                >
                  {e === 'linear' ? 'Linear' : 'Smooth'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="text-[10px] text-white/20 leading-relaxed">
        各ズーム領域はなめらかにズームイン・アウトします。開始・終了時間、倍率、フォーカス位置を一括で設定できます。
      </p>
    </div>
  )
}

function TimeRow({ label, value, onSetPlayhead }: {
  label: string
  value: number
  onSetPlayhead: () => void
}) {
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface-900/60 border border-white/5">
      <span className="text-[10px] text-white/30 w-8 shrink-0">{label}</span>
      <span className="text-xs font-mono text-white/70 flex-1">{fmt(value)}</span>
      <button
        onClick={onSetPlayhead}
        title="Set to current playhead position"
        className="px-2 py-0.5 text-[9px] rounded bg-amber-500/15 hover:bg-amber-500/30 text-amber-400/80 hover:text-amber-300 transition-all"
      >
        ↑ Set
      </button>
    </div>
  )
}

function FocusPicker({ x, y, onChange }: { x: number; y: number; onChange: (x: number, y: number) => void }) {
  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    onChange(nx, ny)
  }

  return (
    <div
      className="relative w-full aspect-video rounded-lg bg-surface-900 border border-white/10 cursor-crosshair overflow-hidden"
      onClick={handleClick}
    >
      {/* Grid lines */}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={`v${i}`} className="absolute top-0 bottom-0 border-l border-white/10" style={{ left: `${(i / 3) * 100}%` }} />
      ))}
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={`h${i}`} className="absolute left-0 right-0 border-t border-white/10" style={{ top: `${(i / 3) * 100}%` }} />
      ))}
      {/* Focus dot */}
      <div
        className="absolute w-4 h-4 rounded-full bg-amber-400 border-2 border-white shadow-lg -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{ left: `${x * 100}%`, top: `${y * 100}%` }}
      />
    </div>
  )
}
