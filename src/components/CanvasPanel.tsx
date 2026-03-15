import { GRADIENT_PRESETS } from '../types'
import type { CanvasSettings, AspectRatio, BackgroundType } from '../types'
import clsx from 'clsx'
import { Slider } from './ui/Slider'
import { Toggle } from './ui/Toggle'

type Props = {
  canvas: CanvasSettings
  onChange: (c: CanvasSettings) => void
}

const ASPECT_RATIOS: { value: AspectRatio; label: string }[] = [
  { value: '16:9', label: '16:9' },
  { value: '4:3', label: '4:3' },
  { value: '1:1', label: '1:1' },
  { value: '9:16', label: '9:16' },
  { value: 'fill', label: 'Fill' }
]

const BG_TYPES: { value: BackgroundType; label: string }[] = [
  { value: 'gradient', label: 'Gradient' },
  { value: 'solid', label: 'Solid' },
  { value: 'blur', label: 'Blur' },
  { value: 'none', label: 'None' }
]

export function CanvasPanel({ canvas, onChange }: Props) {
  const set = <K extends keyof CanvasSettings>(key: K, val: CanvasSettings[K]) =>
    onChange({ ...canvas, [key]: val })

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-sm font-semibold text-white/80">Canvas</h2>

      {/* Aspect Ratio */}
      <Section title="Aspect Ratio">
        <div className="flex gap-1.5 flex-wrap">
          {ASPECT_RATIOS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => set('aspectRatio', value)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                canvas.aspectRatio === value
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </Section>

      {/* Padding */}
      <Section title="Padding">
        <Slider
          min={0}
          max={120}
          value={canvas.padding}
          onChange={(v) => set('padding', v)}
          label={`${canvas.padding}px`}
        />
      </Section>

      {/* Corner Radius */}
      <Section title="Corner Radius">
        <Slider
          min={0}
          max={32}
          value={canvas.cornerRadius}
          onChange={(v) => set('cornerRadius', v)}
          label={`${canvas.cornerRadius}px`}
        />
      </Section>

      {/* Shadow */}
      <Section title="Drop Shadow">
        <div className="flex flex-col gap-2">
          <Toggle
            value={canvas.shadowEnabled}
            onChange={(v) => set('shadowEnabled', v)}
            label="Enable shadow"
          />
          {canvas.shadowEnabled && (
            <Slider
              min={0}
              max={100}
              value={canvas.shadowIntensity}
              onChange={(v) => set('shadowIntensity', v)}
              label={`${canvas.shadowIntensity}%`}
            />
          )}
        </div>
      </Section>

      {/* Background */}
      <Section title="Background">
        <div className="flex gap-1.5 mb-3 flex-wrap">
          {BG_TYPES.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => set('backgroundType', value)}
              className={clsx(
                'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                canvas.backgroundType === value
                  ? 'bg-purple-600 text-white'
                  : 'bg-white/5 text-white/50 hover:bg-white/10 hover:text-white/70'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {canvas.backgroundType === 'gradient' && (
          <div className="grid grid-cols-4 gap-2">
            {GRADIENT_PRESETS.map((preset) => (
              <button
                key={preset.id}
                onClick={() => set('backgroundGradient', preset.value)}
                title={preset.name}
                className={clsx(
                  'aspect-square rounded-lg transition-all border-2',
                  canvas.backgroundGradient === preset.value
                    ? 'border-purple-500 scale-95 shadow-lg shadow-purple-500/30'
                    : 'border-transparent hover:border-white/20'
                )}
                style={{ background: preset.value }}
              />
            ))}
          </div>
        )}

        {canvas.backgroundType === 'solid' && (
          <div className="flex items-center gap-3">
            <input
              type="color"
              value={canvas.backgroundColor}
              onChange={(e) => set('backgroundColor', e.target.value)}
              className="w-10 h-10 rounded-lg border border-white/10 cursor-pointer bg-transparent"
            />
            <span className="text-xs text-white/50 font-mono">{canvas.backgroundColor}</span>
          </div>
        )}

        {canvas.backgroundType === 'blur' && (
          <p className="text-xs text-white/40">Blurs the wallpaper behind the recording.</p>
        )}

        {canvas.backgroundType === 'none' && (
          <p className="text-xs text-white/40">No background — recording fills the canvas edge-to-edge.</p>
        )}
      </Section>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30 mb-2">{title}</p>
      {children}
    </div>
  )
}
