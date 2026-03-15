type Props = {
  min: number
  max: number
  value: number
  onChange: (v: number) => void
  label?: string
  step?: number
}

export function Slider({ min, max, value, onChange, label, step = 1 }: Props) {
  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-1 h-1.5 bg-white/10 rounded-full">
        <div
          className="absolute inset-y-0 left-0 bg-purple-500 rounded-full"
          style={{ width: `${pct}%` }}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-full"
        />
        {/* Thumb */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 bg-white rounded-full shadow-md pointer-events-none"
          style={{ left: `calc(${pct}% - 6px)` }}
        />
      </div>
      {label && <span className="text-[10px] text-white/40 w-10 text-right tabular-nums">{label}</span>}
    </div>
  )
}
