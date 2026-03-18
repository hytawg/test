import type { OverlaySettings } from '../../types'
import { Toggle } from '../ui/Toggle'
import { Slider } from '../ui/Slider'
import clsx from 'clsx'

type Props = {
  settings: OverlaySettings
  hasClickData: boolean
  hasKeyData: boolean
  hasCursorData: boolean
  onChange: (patch: Partial<OverlaySettings>) => void
}

export function OverlayPanel({ settings, hasClickData, hasKeyData, hasCursorData, onChange }: Props) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-white/30">Overlay Effects</p>

      {/* Smooth Cursor */}
      <OverlayRow
        title="Smooth Cursor"
        description="Moving-average filter removes cursor jitter for a polished look."
        available={hasCursorData}
      >
        <Toggle value={settings.cursorSmoothEnabled} onChange={(v) => onChange({ cursorSmoothEnabled: v })} label="" />
      </OverlayRow>

      {/* Click Effect */}
      <OverlayRow
        title="Click Effect"
        description="Expanding ripple ring appears at each mouse click."
        available={hasClickData}
      >
        <Toggle value={settings.clickEffectEnabled} onChange={(v) => onChange({ clickEffectEnabled: v })} label="" />
      </OverlayRow>

      {/* Spotlight */}
      <OverlayRow
        title="Spotlight"
        description="Background dims while a bright circle follows the cursor."
        available={hasCursorData}
      >
        <Toggle value={settings.spotlightEnabled} onChange={(v) => onChange({ spotlightEnabled: v })} label="" />
      </OverlayRow>
      {settings.spotlightEnabled && hasCursorData && (
        <div className="ml-1 -mt-2">
          <p className="text-[10px] text-white/30 mb-1.5">Dimming opacity</p>
          <Slider
            min={10}
            max={85}
            step={5}
            value={Math.round(settings.spotlightOpacity * 100)}
            onChange={(v) => onChange({ spotlightOpacity: v / 100 })}
            label={`${Math.round(settings.spotlightOpacity * 100)}%`}
          />
        </div>
      )}

      {/* Keyboard Display */}
      <OverlayRow
        title="Keyboard Display"
        description="Pressed shortcuts appear as a badge at the bottom of the video."
        available={hasKeyData}
      >
        <Toggle value={settings.keyboardDisplayEnabled} onChange={(v) => onChange({ keyboardDisplayEnabled: v })} label="" />
      </OverlayRow>

      <p className="text-[10px] text-white/20 leading-relaxed mt-1">
        Click, keyboard, and cursor data are captured automatically during recording.
      </p>
    </div>
  )
}

function OverlayRow({
  title, description, available, children
}: {
  title: string
  description: string
  available: boolean
  children: React.ReactNode
}) {
  return (
    <div className={clsx('flex flex-col gap-1', !available && 'opacity-40 pointer-events-none')}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-xs font-medium text-white/80">{title}</p>
          {!available && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-white/5 text-white/30 font-medium">
              No data
            </span>
          )}
        </div>
        {children}
      </div>
      <p className="text-[10px] text-white/35 leading-relaxed pr-8">{description}</p>
    </div>
  )
}
