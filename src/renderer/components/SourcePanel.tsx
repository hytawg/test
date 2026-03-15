import { useEffect, useState } from 'react'
import { Monitor, AppWindow, RefreshCw, AlertCircle } from 'lucide-react'
import type { CaptureSource } from '../types'
import clsx from 'clsx'

type Props = {
  selected: CaptureSource | null
  onSelect: (source: CaptureSource) => void
}

export function SourcePanel({ selected, onSelect }: Props) {
  const [sources, setSources] = useState<CaptureSource[]>([])
  const [loading, setLoading] = useState(false)
  const [permission, setPermission] = useState<string>('unknown')

  const loadSources = async () => {
    setLoading(true)
    try {
      const perm = await window.electronAPI?.checkScreenPermission()
      setPermission(perm ?? 'granted')

      const srcs = await window.electronAPI?.getSources()
      if (srcs) setSources(srcs)
    } catch {
      // ignore
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSources()
  }, [])

  const screens = sources.filter((s) => s.id.startsWith('screen:'))
  const windows = sources.filter((s) => s.id.startsWith('window:'))

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-white/80">Capture Source</h2>
        <button
          onClick={loadSources}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-white/5 text-white/40 hover:text-white/70 transition-all"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {permission === 'denied' && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
          <AlertCircle size={14} className="mt-0.5 shrink-0" />
          <span>Screen recording permission denied. Enable it in System Settings → Privacy & Security → Screen Recording.</span>
        </div>
      )}

      {/* Screens */}
      <Section title="Displays" icon={<Monitor size={12} />}>
        {screens.length === 0 && !loading && (
          <p className="text-xs text-white/30 py-2">No displays found</p>
        )}
        {screens.map((src) => (
          <SourceCard
            key={src.id}
            source={src}
            selected={selected?.id === src.id}
            onClick={() => onSelect(src)}
          />
        ))}
      </Section>

      {/* Windows */}
      <Section title="Windows" icon={<AppWindow size={12} />}>
        {windows.length === 0 && !loading && (
          <p className="text-xs text-white/30 py-2">No open windows</p>
        )}
        <div className="grid grid-cols-2 gap-2">
          {windows.map((src) => (
            <WindowCard
              key={src.id}
              source={src}
              selected={selected?.id === src.id}
              onClick={() => onSelect(src)}
            />
          ))}
        </div>
      </Section>
    </div>
  )
}

function Section({
  title,
  icon,
  children
}: {
  title: string
  icon: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2 text-white/40">
        {icon}
        <span className="text-[10px] font-semibold uppercase tracking-wider">{title}</span>
      </div>
      {children}
    </div>
  )
}

function SourceCard({
  source,
  selected,
  onClick
}: {
  source: CaptureSource
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'w-full rounded-xl overflow-hidden border-2 transition-all duration-150 group',
        selected
          ? 'border-purple-500 shadow-lg shadow-purple-500/20'
          : 'border-white/5 hover:border-white/20'
      )}
    >
      <div className="relative aspect-video bg-black">
        {source.thumbnailDataURL ? (
          <img
            src={source.thumbnailDataURL}
            alt={source.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-white/20">
            <Monitor size={32} />
          </div>
        )}
        {selected && (
          <div className="absolute inset-0 bg-purple-500/10 flex items-center justify-center">
            <div className="w-5 h-5 rounded-full bg-purple-500 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white" />
            </div>
          </div>
        )}
      </div>
      <div className="px-2.5 py-2 bg-surface-900 text-left">
        <p className="text-xs font-medium text-white/70 truncate">{source.name}</p>
      </div>
    </button>
  )
}

function WindowCard({
  source,
  selected,
  onClick
}: {
  source: CaptureSource
  selected: boolean
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-lg overflow-hidden border transition-all duration-150 text-left',
        selected
          ? 'border-purple-500 shadow-lg shadow-purple-500/20'
          : 'border-white/5 hover:border-white/20'
      )}
    >
      <div className="relative aspect-video bg-surface-900">
        {source.thumbnailDataURL ? (
          <img
            src={source.thumbnailDataURL}
            alt={source.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {source.appIconDataURL ? (
              <img src={source.appIconDataURL} alt="" className="w-8 h-8" />
            ) : (
              <AppWindow size={20} className="text-white/20" />
            )}
          </div>
        )}
      </div>
      <div className="px-2 py-1.5 flex items-center gap-1.5 bg-surface-900">
        {source.appIconDataURL && (
          <img src={source.appIconDataURL} alt="" className="w-3.5 h-3.5 rounded-sm" />
        )}
        <span className="text-[10px] text-white/60 truncate">{source.name}</span>
      </div>
    </button>
  )
}
