import { useEffect } from 'react'
import type { CameraSettings, CameraPosition, CameraShape } from '../types'
import { useDevices } from '../hooks/useDevices'
import { Slider } from './ui/Slider'
import { Toggle } from './ui/Toggle'
import clsx from 'clsx'

type Props = {
  camera: CameraSettings
  onChange: (c: CameraSettings) => void
}

const POSITIONS: { value: CameraPosition; label: string; icon: string }[] = [
  { value: 'top-left', label: 'Top Left', icon: '↖' },
  { value: 'top-right', label: 'Top Right', icon: '↗' },
  { value: 'bottom-left', label: 'Bottom Left', icon: '↙' },
  { value: 'bottom-right', label: 'Bottom Right', icon: '↘' }
]

const SHAPES: { value: CameraShape; label: string }[] = [
  { value: 'circle', label: 'Circle' },
  { value: 'rounded', label: 'Rounded' },
  { value: 'square', label: 'Square' }
]

export function CameraPanel({ camera, onChange }: Props) {
  const { cameras } = useDevices()
  const set = <K extends keyof CameraSettings>(key: K, val: CameraSettings[K]) =>
    onChange({ ...camera, [key]: val })

  // Auto-select first camera
  useEffect(() => {
    if (cameras.length > 0 && !camera.deviceId) {
      set('deviceId', cameras[0].deviceId)
    }
  }, [cameras])

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-sm font-semibold text-white/80">Camera Overlay</h2>

      <Toggle
        value={camera.enabled}
        onChange={(v) => set('enabled', v)}
        label="Enable camera overlay"
      />

      {camera.enabled && (
        <>
          {/* Device select */}
          <Section title="Camera">
            <select
              value={camera.deviceId ?? ''}
              onChange={(e) => set('deviceId', e.target.value || null)}
              className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/70 focus:outline-none focus:border-purple-500"
            >
              <option value="">Select camera...</option>
              {cameras.map((cam) => (
                <option key={cam.deviceId} value={cam.deviceId}>
                  {cam.label}
                </option>
              ))}
            </select>
          </Section>

          {/* Shape */}
          <Section title="Shape">
            <div className="flex gap-1.5">
              {SHAPES.map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => set('shape', value)}
                  className={clsx(
                    'flex-1 py-2 rounded-lg text-xs font-medium transition-all',
                    camera.shape === value
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/5 text-white/50 hover:bg-white/10'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </Section>

          {/* Position */}
          <Section title="Position">
            <div className="grid grid-cols-2 gap-1.5">
              {POSITIONS.map(({ value, label, icon }) => (
                <button
                  key={value}
                  onClick={() => set('position', value)}
                  className={clsx(
                    'flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all',
                    camera.position === value
                      ? 'bg-purple-600 text-white'
                      : 'bg-white/5 text-white/50 hover:bg-white/10'
                  )}
                >
                  <span className="text-base leading-none">{icon}</span>
                  {label}
                </button>
              ))}
            </div>
          </Section>

          {/* Size */}
          <Section title="Size">
            <Slider
              min={10}
              max={40}
              value={camera.size}
              onChange={(v) => set('size', v)}
              label={`${camera.size}%`}
            />
          </Section>

          {/* Mirror */}
          <Toggle
            value={camera.mirrorEnabled}
            onChange={(v) => set('mirrorEnabled', v)}
            label="Mirror camera"
          />

          {/* Border */}
          <Section title="Border">
            <div className="flex flex-col gap-2">
              <Toggle
                value={camera.borderEnabled}
                onChange={(v) => set('borderEnabled', v)}
                label="Show border"
              />
              {camera.borderEnabled && (
                <div className="flex items-center gap-3 pl-1">
                  <input
                    type="color"
                    value={camera.borderColor}
                    onChange={(e) => set('borderColor', e.target.value)}
                    className="w-8 h-8 rounded-md border border-white/10 cursor-pointer bg-transparent"
                  />
                  <div className="flex-1">
                    <Slider
                      min={1}
                      max={8}
                      value={camera.borderWidth}
                      onChange={(v) => set('borderWidth', v)}
                      label={`${camera.borderWidth}px`}
                    />
                  </div>
                </div>
              )}
            </div>
          </Section>
        </>
      )}
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
