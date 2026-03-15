import { Monitor, Camera, Sliders, Mic, Download, type LucideIcon } from 'lucide-react'
import type { AppState } from '../types'
import clsx from 'clsx'

type Panel = AppState['activePanel']

type NavItem = {
  id: Panel
  label: string
  Icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { id: 'source', label: 'Source', Icon: Monitor },
  { id: 'canvas', label: 'Canvas', Icon: Sliders },
  { id: 'camera', label: 'Camera', Icon: Camera },
  { id: 'audio', label: 'Audio', Icon: Mic },
  { id: 'export', label: 'Export', Icon: Download }
]

type Props = {
  active: Panel
  onChange: (panel: Panel) => void
}

export function Sidebar({ active, onChange }: Props) {
  return (
    <nav className="w-[72px] flex flex-col items-center py-4 gap-1 bg-surface-950 border-r border-white/5">
      {/* Logo */}
      <div className="mb-4 w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
        <span className="text-white font-bold text-lg">S</span>
      </div>

      {NAV_ITEMS.map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          title={label}
          className={clsx(
            'w-12 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 transition-all duration-150',
            active === id
              ? 'bg-white/10 text-white shadow-sm'
              : 'text-white/40 hover:text-white/70 hover:bg-white/5'
          )}
        >
          <Icon size={18} />
          <span className="text-[9px] font-medium leading-none mt-0.5">{label}</span>
        </button>
      ))}
    </nav>
  )
}
