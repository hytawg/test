import type { SpeedSegment } from '../../types'
import { Trash2 } from 'lucide-react'
import { Slider } from '../ui/Slider'
import clsx from 'clsx'

type Props = {
  segments: SpeedSegment[]
  selectedId: string | null
  currentTime: number
  onUpdate: (id: string, patch: Partial<SpeedSegment>) => void
  onRemove: (id: string) => void
  onSelect: (id: string | null) => void
}

function fmt(s: number) {
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(1)
  return `${m}:${sec.padStart(4, '0')}`
}

function speedLabel(speed: number): string {
  if (speed < 1) return `${speed.toFixed(1)}× (スロー)`
  if (speed > 1) return `${speed.toFixed(1)}× (速送り)`
  return '1.0× (標準)'
}

function speedBarColor(speed: number): string {
  if (speed < 0.8) return 'bg-blue-500'
  if (speed > 1.2) return 'bg-orange-500'
  return 'bg-green-500'
}

export function SpeedPanel({ segments, selectedId, currentTime, onUpdate, onRemove, onSelect }: Props) {
  const selected = segments.find((s) => s.id === selectedId)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Speed Segments</p>
        <span className="text-[10px] text-cyan-400/60">タイムラインをドラッグして追加</span>
      </div>

      {/* Segment list */}
      <div className="flex flex-col gap-1">
        {segments.length === 0 && (
          <p className="text-xs text-white/20 text-center py-4">
            タイムラインの速度レーンをドラッグして再生速度の範囲を追加します。
          </p>
        )}
        {segments.map((seg) => (
          <button
            key={seg.id}
            onClick={() => onSelect(seg.id === selectedId ? null : seg.id)}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all',
              selectedId === seg.id
                ? 'border-cyan-500/50 bg-cyan-500/10'
                : 'border-white/5 bg-white/3 hover:border-white/15'
            )}
          >
            <div className={clsx('w-2 h-2 rounded-full shrink-0', speedBarColor(seg.speed))} />
            <span className="text-xs text-white/60 font-mono flex-1">
              {fmt(seg.startTime)} → {fmt(seg.endTime)}
            </span>
            <span className="text-[10px] text-white/40">{seg.speed.toFixed(1)}×</span>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(seg.id) }}
              className="ml-1 p-0.5 rounded hover:bg-white/10 text-white/20 hover:text-red-400 transition-all"
            >
              <Trash2 size={11} />
            </button>
          </button>
        ))}
      </div>

      {/* Selected segment editor */}
      {selected && (
        <div className="flex flex-col gap-3 p-3 rounded-xl bg-white/3 border border-white/5">
          <p className="text-[10px] font-semibold text-cyan-400/70 uppercase tracking-wider">
            Speed Segment
          </p>

          {/* Time range */}
          <div className="flex flex-col gap-1.5">
            <SpeedTimeRow
              label="Start"
              value={selected.startTime}
              onSetPlayhead={() => onUpdate(selected.id, { startTime: Math.min(currentTime, selected.endTime - 0.2) })}
            />
            <SpeedTimeRow
              label="End"
              value={selected.endTime}
              onSetPlayhead={() => onUpdate(selected.id, { endTime: Math.max(currentTime, selected.startTime + 0.2) })}
            />
          </div>

          {/* Speed slider */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] text-white/30">再生速度</p>
              <span className="text-[10px] font-medium text-cyan-300">{speedLabel(selected.speed)}</span>
            </div>
            <Slider
              min={5}
              max={20}
              step={1}
              value={Math.round(selected.speed * 10)}
              onChange={(v) => onUpdate(selected.id, { speed: v / 10 })}
              label={`${(selected.speed).toFixed(1)}×`}
            />
            {/* Speed presets */}
            <div className="flex gap-1 mt-2">
              {[0.5, 0.75, 1.0, 1.5, 2.0].map((s) => (
                <button
                  key={s}
                  onClick={() => onUpdate(selected.id, { speed: s })}
                  className={clsx(
                    'flex-1 py-1 rounded text-[9px] font-medium transition-all',
                    Math.abs(selected.speed - s) < 0.05
                      ? 'bg-cyan-500/25 text-cyan-300'
                      : 'bg-white/5 text-white/35 hover:bg-white/10'
                  )}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <p className="text-[10px] text-white/20 leading-relaxed">
        速度は0.5×〜2.0×の範囲で設定できます。エクスポート時に適用されます。
      </p>
    </div>
  )
}

function SpeedTimeRow({ label, value, onSetPlayhead }: {
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
        className="px-2 py-0.5 text-[9px] rounded bg-cyan-500/15 hover:bg-cyan-500/30 text-cyan-400/80 hover:text-cyan-300 transition-all"
      >
        ↑ Set
      </button>
    </div>
  )
}
