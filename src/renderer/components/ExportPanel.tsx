import type { RecordingSettings, RecordingFormat, RecordingQuality } from '../types'
import clsx from 'clsx'
import { FolderOpen, Download } from 'lucide-react'

type Props = {
  settings: RecordingSettings
  onChange: (s: RecordingSettings) => void
}

const FORMATS: { value: RecordingFormat; label: string; desc: string }[] = [
  { value: 'mp4', label: 'MP4', desc: 'H.264, best compatibility' },
  { value: 'webm', label: 'WebM', desc: 'VP9, smaller file size' },
  { value: 'gif', label: 'GIF', desc: 'Animated, no audio' }
]

const QUALITIES: { value: RecordingQuality; label: string; desc: string }[] = [
  { value: 'high', label: 'High', desc: '8 Mbps' },
  { value: 'medium', label: 'Medium', desc: '4 Mbps' },
  { value: 'low', label: 'Low', desc: '2 Mbps' }
]

const FPS_OPTIONS = [24, 30, 60]

export function ExportPanel({ settings, onChange }: Props) {
  const set = <K extends keyof RecordingSettings>(key: K, val: RecordingSettings[K]) =>
    onChange({ ...settings, [key]: val })

  return (
    <div className="flex flex-col gap-5">
      <h2 className="text-sm font-semibold text-white/80">Export</h2>

      {/* Format */}
      <Section title="Format">
        <div className="flex flex-col gap-1.5">
          {FORMATS.map(({ value, label, desc }) => (
            <button
              key={value}
              onClick={() => set('format', value)}
              className={clsx(
                'flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all text-left',
                settings.format === value
                  ? 'border-purple-500 bg-purple-500/10'
                  : 'border-white/5 bg-white/3 hover:border-white/15'
              )}
            >
              <span
                className={clsx(
                  'text-xs font-semibold',
                  settings.format === value ? 'text-purple-400' : 'text-white/60'
                )}
              >
                {label}
              </span>
              <span className="text-[10px] text-white/30">{desc}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* Quality */}
      {settings.format !== 'gif' && (
        <Section title="Quality">
          <div className="flex gap-1.5">
            {QUALITIES.map(({ value, label, desc }) => (
              <button
                key={value}
                onClick={() => set('quality', value)}
                className={clsx(
                  'flex-1 flex flex-col items-center py-2 rounded-lg border transition-all',
                  settings.quality === value
                    ? 'border-purple-500 bg-purple-500/10'
                    : 'border-white/5 bg-white/3 hover:border-white/15'
                )}
              >
                <span
                  className={clsx(
                    'text-xs font-semibold',
                    settings.quality === value ? 'text-purple-400' : 'text-white/60'
                  )}
                >
                  {label}
                </span>
                <span className="text-[10px] text-white/25">{desc}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* FPS */}
      {settings.format !== 'gif' && (
        <Section title="Frame Rate">
          <div className="flex gap-1.5">
            {FPS_OPTIONS.map((fps) => (
              <button
                key={fps}
                onClick={() => set('fps', fps)}
                className={clsx(
                  'flex-1 py-2 rounded-lg border text-xs font-medium transition-all',
                  settings.fps === fps
                    ? 'border-purple-500 bg-purple-500/10 text-purple-400'
                    : 'border-white/5 bg-white/3 text-white/50 hover:border-white/15'
                )}
              >
                {fps} fps
              </button>
            ))}
          </div>
        </Section>
      )}

      {/* Save location */}
      <Section title="Save Location">
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => set('saveLocation', 'downloads')}
            className={clsx(
              'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all text-left',
              settings.saveLocation === 'downloads'
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-white/5 bg-white/3 hover:border-white/15'
            )}
          >
            <Download
              size={14}
              className={settings.saveLocation === 'downloads' ? 'text-purple-400' : 'text-white/40'}
            />
            <div>
              <p
                className={clsx(
                  'text-xs font-medium',
                  settings.saveLocation === 'downloads' ? 'text-purple-400' : 'text-white/60'
                )}
              >
                Downloads folder
              </p>
              <p className="text-[10px] text-white/25">Save automatically</p>
            </div>
          </button>
          <button
            onClick={() => set('saveLocation', 'dialog')}
            className={clsx(
              'flex items-center gap-2.5 px-3 py-2.5 rounded-lg border transition-all text-left',
              settings.saveLocation === 'dialog'
                ? 'border-purple-500 bg-purple-500/10'
                : 'border-white/5 bg-white/3 hover:border-white/15'
            )}
          >
            <FolderOpen
              size={14}
              className={settings.saveLocation === 'dialog' ? 'text-purple-400' : 'text-white/40'}
            />
            <div>
              <p
                className={clsx(
                  'text-xs font-medium',
                  settings.saveLocation === 'dialog' ? 'text-purple-400' : 'text-white/60'
                )}
              >
                Choose location
              </p>
              <p className="text-[10px] text-white/25">Show save dialog</p>
            </div>
          </button>
        </div>
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
