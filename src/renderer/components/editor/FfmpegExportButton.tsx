import { useState, useEffect, useRef } from 'react'
import { Clapperboard, Copy, Check, Terminal, AlertCircle, Loader2 } from 'lucide-react'
import type { EditState } from '../../types'
import { optionsFromEditState, buildCommandPreview } from '../../utils/ffmpegFilter'

type Props = {
  state: EditState
  videoRef: React.RefObject<HTMLVideoElement>
}

/**
 * "Screen Studio Export" button that invokes the FFmpeg post-processing
 * pipeline:
 *   crop top (browser chrome)  →  scale 90 %  →  rounded corners  →  overlay
 *
 * If FFmpeg is not installed, the component falls back to a "Copy Command"
 * panel so the user can run the command manually.
 */
export function FfmpegExportButton({ state, videoRef }: Props) {
  const [ffmpegPath, setFfmpegPath] = useState<string | null | 'checking'>('checking')
  const [processing, setProcessing] = useState(false)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState<{ ok: boolean; msg: string } | null>(null)
  const [showCmd, setShowCmd] = useState(false)
  const [copied, setCopied] = useState(false)
  const cancelRef = useRef<(() => void) | null>(null)

  // Probe FFmpeg availability once on mount
  useEffect(() => {
    window.electronAPI?.ffmpegFind().then(p => setFfmpegPath(p ?? null))
  }, [])

  // Subscribe to progress events from main process
  useEffect(() => {
    window.electronAPI?.onFfmpegProgress((pct) => setProgress(pct))
  }, [])

  const videoHeight = videoRef.current?.videoHeight ?? 1080
  const opts = optionsFromEditState(state, videoHeight)

  const handleExport = async () => {
    if (!ffmpegPath || ffmpegPath === 'checking') return
    setProcessing(true)
    setProgress(0)
    setDone(null)

    // Blob → ArrayBuffer (IPC can't transfer Blob directly)
    const buf = await state.blob.arrayBuffer()
    const result = await window.electronAPI?.ffmpegProcess(buf, opts)

    setProcessing(false)
    if (!result || result.canceled) return
    if (result.success) {
      setDone({ ok: true, msg: result.filePath ?? 'Saved' })
    } else {
      setDone({ ok: false, msg: result.error ?? 'Unknown error' })
    }
  }

  const handleCopy = () => {
    const cmd = buildCommandPreview('<input.mp4>', '<output.mp4>', opts)
    navigator.clipboard.writeText(cmd)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const isAvailable = ffmpegPath && ffmpegPath !== 'checking'

  return (
    <div className="flex flex-col gap-2 mt-2">
      {/* Main action button */}
      <button
        onClick={isAvailable ? handleExport : () => setShowCmd(v => !v)}
        disabled={processing || ffmpegPath === 'checking'}
        className={[
          'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl',
          'font-semibold text-sm transition-all border',
          processing || ffmpegPath === 'checking'
            ? 'bg-white/5 text-white/30 cursor-not-allowed border-white/5'
            : isAvailable
              ? 'bg-orange-500/15 text-orange-300 hover:bg-orange-500/25 border-orange-500/30 hover:scale-[1.01] active:scale-95'
              : 'bg-white/5 text-white/50 hover:bg-white/8 border-white/10',
        ].join(' ')}
      >
        {processing
          ? <><Loader2 size={14} className="animate-spin" />{Math.round(progress)}%</>
          : ffmpegPath === 'checking'
            ? <><Loader2 size={14} className="animate-spin" />Checking FFmpeg…</>
            : isAvailable
              ? <><Clapperboard size={14} />Screen Studio Export</>
              : <><Terminal size={14} />FFmpeg not found — Copy command</>
        }
      </button>

      {/* Progress bar */}
      {processing && (
        <div className="h-1 bg-white/5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-orange-500 to-yellow-400 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      {/* Done / error feedback */}
      {done && (
        <div className={[
          'flex items-center gap-2 px-3 py-2 rounded-lg text-xs',
          done.ok ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400',
        ].join(' ')}>
          {done.ok ? <Check size={12} /> : <AlertCircle size={12} />}
          <span className="truncate">{done.ok ? `Saved: ${done.msg}` : done.msg}</span>
        </div>
      )}

      {/* Filter params summary (always visible as micro-doc) */}
      <div className="px-3 py-2 rounded-lg bg-white/3 border border-white/5 text-[10px] text-white/30 font-mono leading-relaxed">
        <span className="text-white/50">crop</span>
        {` iw:ih-${opts.cropTopPx}:0:${opts.cropTopPx}`}
        {'  '}
        <span className="text-white/50">scale</span>
        {` ${opts.scalePct}%`}
        {'  '}
        <span className="text-white/50">r</span>
        {` ${opts.cornerRadius}px`}
        {'  '}
        <span className="text-white/50">bg</span>
        {` #${opts.backgroundColor}`}
      </div>

      {/* Copyable command panel (shown when FFmpeg not found or toggled) */}
      {(showCmd || !isAvailable) && (
        <div className="relative rounded-xl bg-surface-900 border border-white/8 overflow-hidden">
          <pre className="p-3 text-[9px] text-white/40 font-mono leading-relaxed overflow-x-auto whitespace-pre">
            {buildCommandPreview('<input.mp4>', '<output.mp4>', opts)}
          </pre>
          <button
            onClick={handleCopy}
            className="absolute top-2 right-2 flex items-center gap-1 px-2 py-1 rounded-lg bg-white/8 hover:bg-white/15 text-white/50 hover:text-white text-[10px] transition-all"
          >
            {copied ? <><Check size={10} />Copied</> : <><Copy size={10} />Copy</>}
          </button>
          {!isAvailable && (
            <div className="px-3 pb-2 text-[9px] text-white/25">
              Install FFmpeg: <span className="text-white/45">brew install ffmpeg</span>
            </div>
          )}
        </div>
      )}

      {/* Toggle command visibility when FFmpeg IS found */}
      {isAvailable && !processing && (
        <button
          onClick={() => setShowCmd(v => !v)}
          className="text-[10px] text-white/25 hover:text-white/45 transition-colors text-center"
        >
          {showCmd ? 'Hide command' : 'Show FFmpeg command'}
        </button>
      )}
    </div>
  )
}
