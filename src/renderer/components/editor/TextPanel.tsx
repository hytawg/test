import type { TextAnnotation } from '../../types'
import { Trash2, AlignLeft, AlignCenter, AlignRight, Bold } from 'lucide-react'
import { Slider } from '../ui/Slider'
import { Toggle } from '../ui/Toggle'
import clsx from 'clsx'

type Props = {
  annotations: TextAnnotation[]
  selectedId: string | null
  trimEnd: number
  onUpdate: (id: string, patch: Partial<TextAnnotation>) => void
  onRemove: (id: string) => void
  onSelect: (id: string | null) => void
}

function fmt(s: number) {
  const m = Math.floor(s / 60)
  const sec = (s % 60).toFixed(1)
  return `${m}:${sec.padStart(4, '0')}`
}

export function TextPanel({ annotations, selectedId, trimEnd, onUpdate, onRemove, onSelect }: Props) {
  const selected = annotations.find((a) => a.id === selectedId)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Text Annotations</p>
        <span className="text-[10px] text-white/20">Click canvas to add</span>
      </div>

      {/* List */}
      <div className="flex flex-col gap-1">
        {annotations.length === 0 && (
          <p className="text-xs text-white/20 text-center py-4">
            No text yet. Switch to Text tool and click on the video preview.
          </p>
        )}
        {annotations.map((ann) => (
          <button
            key={ann.id}
            onClick={() => onSelect(ann.id === selectedId ? null : ann.id)}
            className={clsx(
              'flex items-center gap-2 px-3 py-2 rounded-lg border text-left transition-all',
              selectedId === ann.id
                ? 'border-violet-500/50 bg-violet-500/10'
                : 'border-white/5 bg-white/3 hover:border-white/15'
            )}
          >
            <span className="text-xs flex-1 text-white/70 truncate">{ann.text || '(empty)'}</span>
            <span className="text-[10px] text-white/25 font-mono shrink-0">{fmt(ann.startTime)}</span>
            <button
              onClick={(e) => { e.stopPropagation(); onRemove(ann.id) }}
              className="ml-1 p-0.5 rounded hover:bg-white/10 text-white/20 hover:text-red-400 transition-all"
            >
              <Trash2 size={11} />
            </button>
          </button>
        ))}
      </div>

      {/* Editor for selected */}
      {selected && (
        <div className="flex flex-col gap-3 p-3 rounded-xl bg-white/3 border border-white/5">
          <p className="text-[10px] font-semibold text-violet-400/70 uppercase tracking-wider">Edit Text</p>

          {/* Text content */}
          <textarea
            value={selected.text}
            onChange={(e) => onUpdate(selected.id, { text: e.target.value })}
            rows={2}
            className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/80 resize-none focus:outline-none focus:border-violet-500"
            placeholder="Enter text..."
          />

          {/* Style row */}
          <div className="flex items-center gap-2">
            {/* Bold */}
            <button
              onClick={() => onUpdate(selected.id, { bold: !selected.bold })}
              className={clsx(
                'p-1.5 rounded-lg transition-all',
                selected.bold ? 'bg-violet-500/20 text-violet-400' : 'bg-white/5 text-white/40 hover:bg-white/10'
              )}
            >
              <Bold size={13} />
            </button>
            {/* Align */}
            {([
              { value: 'left', Icon: AlignLeft },
              { value: 'center', Icon: AlignCenter },
              { value: 'right', Icon: AlignRight }
            ] as const).map(({ value, Icon }) => (
              <button
                key={value}
                onClick={() => onUpdate(selected.id, { align: value })}
                className={clsx(
                  'p-1.5 rounded-lg transition-all',
                  selected.align === value ? 'bg-violet-500/20 text-violet-400' : 'bg-white/5 text-white/40 hover:bg-white/10'
                )}
              >
                <Icon size={13} />
              </button>
            ))}
            <div className="flex-1" />
            {/* Text color */}
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] text-white/30">Color</span>
              <input
                type="color"
                value={selected.color}
                onChange={(e) => onUpdate(selected.id, { color: e.target.value })}
                className="w-7 h-7 rounded-md border border-white/10 cursor-pointer bg-transparent"
              />
            </div>
          </div>

          {/* Font size */}
          <div>
            <p className="text-[10px] text-white/30 mb-1.5">Font size</p>
            <Slider min={16} max={96} step={2} value={selected.fontSize}
              onChange={(v) => onUpdate(selected.id, { fontSize: v })}
              label={`${selected.fontSize}px`} />
          </div>

          {/* Background */}
          <div className="flex flex-col gap-2">
            <Toggle
              value={selected.bgEnabled}
              onChange={(v) => onUpdate(selected.id, { bgEnabled: v })}
              label="Background"
            />
            {selected.bgEnabled && (
              <div className="flex items-center gap-2 pl-1">
                <span className="text-[10px] text-white/30">Color</span>
                <input
                  type="color"
                  value={selected.bgColor}
                  onChange={(e) => onUpdate(selected.id, { bgColor: e.target.value })}
                  className="w-7 h-7 rounded-md border border-white/10 cursor-pointer bg-transparent"
                />
              </div>
            )}
          </div>

          {/* Timing */}
          <div>
            <p className="text-[10px] text-white/30 mb-2">Timing</p>
            <div className="flex flex-col gap-2">
              <div>
                <p className="text-[10px] text-white/20 mb-1">Start — {fmt(selected.startTime)}</p>
                <Slider min={0} max={trimEnd} step={0.1} value={selected.startTime}
                  onChange={(v) => onUpdate(selected.id, { startTime: Math.min(v, selected.endTime - 0.1) })}
                  label="" />
              </div>
              <div>
                <p className="text-[10px] text-white/20 mb-1">End — {fmt(selected.endTime)}</p>
                <Slider min={0} max={trimEnd} step={0.1} value={selected.endTime}
                  onChange={(v) => onUpdate(selected.id, { endTime: Math.max(v, selected.startTime + 0.1) })}
                  label="" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
