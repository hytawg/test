import clsx from 'clsx'

type Props = {
  value: boolean
  onChange: (v: boolean) => void
  label: string
}

export function Toggle({ value, onChange, label }: Props) {
  return (
    <button
      onClick={() => onChange(!value)}
      className="flex items-center gap-2.5 group"
      type="button"
    >
      <div
        className={clsx(
          'relative w-8 h-4.5 rounded-full transition-all duration-200 shrink-0',
          value ? 'bg-purple-500' : 'bg-white/15'
        )}
        style={{ height: '18px' }}
      >
        <div
          className={clsx(
            'absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm transition-all duration-200',
            value ? 'left-[calc(100%-14px-2px)]' : 'left-0.5'
          )}
        />
      </div>
      {label && <span className="text-xs text-white/60 group-hover:text-white/80 transition-colors">{label}</span>}
    </button>
  )
}
