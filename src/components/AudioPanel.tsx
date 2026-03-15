import type { AudioSettings } from '../types'
import { useDevices } from '../hooks/useDevices'
import { Toggle } from './ui/Toggle'
import { Slider } from './ui/Slider'
import { Volume2, Mic } from 'lucide-react'

type Props = {
  audio: AudioSettings
  onChange: (a: AudioSettings) => void
}

export function AudioPanel({ audio, onChange }: Props) {
  const { microphones } = useDevices()
  const set = <K extends keyof AudioSettings>(key: K, val: AudioSettings[K]) =>
    onChange({ ...audio, [key]: val })

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-sm font-semibold text-white/80">Audio</h2>

      {/* Microphone */}
      <div className="p-3 rounded-xl bg-white/3 border border-white/5">
        <div className="flex items-center gap-2 mb-3">
          <Mic size={14} className="text-white/50" />
          <span className="text-xs font-medium text-white/70">Microphone</span>
          <div className="ml-auto">
            <Toggle value={audio.micEnabled} onChange={(v) => set('micEnabled', v)} label="" />
          </div>
        </div>
        {audio.micEnabled && (
          <div className="flex flex-col gap-3">
            <select
              value={audio.micDeviceId ?? ''}
              onChange={(e) => set('micDeviceId', e.target.value || null)}
              className="w-full bg-surface-900 border border-white/10 rounded-lg px-3 py-2 text-xs text-white/70 focus:outline-none focus:border-purple-500"
            >
              <option value="">Default microphone</option>
              {microphones.map((mic) => (
                <option key={mic.deviceId} value={mic.deviceId}>
                  {mic.label}
                </option>
              ))}
            </select>
            <div>
              <p className="text-[10px] text-white/30 mb-1.5">Volume</p>
              <Slider
                min={0}
                max={100}
                value={audio.micVolume}
                onChange={(v) => set('micVolume', v)}
                label={`${audio.micVolume}%`}
              />
            </div>
          </div>
        )}
      </div>

      {/* System Audio */}
      <div className="p-3 rounded-xl bg-white/3 border border-white/5">
        <div className="flex items-center gap-2">
          <Volume2 size={14} className="text-white/50" />
          <span className="text-xs font-medium text-white/70">System Audio</span>
          <div className="ml-auto">
            <Toggle
              value={audio.systemAudioEnabled}
              onChange={(v) => set('systemAudioEnabled', v)}
              label=""
            />
          </div>
        </div>
        {audio.systemAudioEnabled && (
          <p className="text-[10px] text-white/30 mt-2">
            System audio capture requires screen recording permission.
          </p>
        )}
      </div>
    </div>
  )
}
