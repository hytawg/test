import { useEffect, useRef, useState } from 'react'
import { Upload, FolderOpen, Film, Clock, Trash2, RotateCcw, AlertCircle } from 'lucide-react'
import type { RecordingHistoryEntry } from '../types'
import clsx from 'clsx'

type Props = {
  onOpenFile: (blob: Blob, fileName: string) => void
}

export function FilesPanel({ onOpenFile }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [history, setHistory] = useState<RecordingHistoryEntry[]>([])
  const [dragging, setDragging] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)
  const dragCounterRef = useRef(0)

  useEffect(() => {
    window.electronAPI?.getRecordingHistory().then(setHistory)
  }, [])

  // ── File import via HTML input ─────────────────────────────────────────────

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''   // allow re-selecting the same file
    onOpenFile(file, file.name)
  }

  // ── Drag & drop ───────────────────────────────────────────────────────────

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current++
    if (dragCounterRef.current === 1) setDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current--
    if (dragCounterRef.current === 0) setDragging(false)
  }

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault() }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    dragCounterRef.current = 0
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (!file || !file.type.startsWith('video/')) return
    onOpenFile(file, file.name)
  }

  // ── Re-edit a saved recording ──────────────────────────────────────────────

  const handleReopen = async (entry: RecordingHistoryEntry) => {
    setLoadingId(entry.id)
    setErrorId(null)
    const result = await window.electronAPI?.openFileByPath(entry.filePath)
    setLoadingId(null)
    if (!result) { setErrorId(entry.id); return }
    const blob = new Blob([result.buffer], { type: mimeTypeFromFormat(entry.format) })
    onOpenFile(blob, entry.fileName)
  }

  const handleRemove = async (id: string) => {
    await window.electronAPI?.removeRecordingHistory(id)
    setHistory(prev => prev.filter(e => e.id !== id))
  }

  return (
    <div
      className="flex flex-col gap-4 h-full"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <h2 className="text-sm font-semibold text-white/80">Files</h2>

      {/* Import zone */}
      <div
        className={clsx(
          'flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed py-6 px-4 transition-all cursor-pointer',
          dragging
            ? 'border-purple-400 bg-purple-500/10'
            : 'border-white/10 hover:border-white/20 hover:bg-white/3'
        )}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className={clsx(
          'w-10 h-10 rounded-xl flex items-center justify-center transition-all',
          dragging ? 'bg-purple-500/20' : 'bg-white/5'
        )}>
          <Upload size={18} className={dragging ? 'text-purple-400' : 'text-white/30'} />
        </div>
        <div className="text-center">
          <p className="text-xs font-medium text-white/50">
            {dragging ? 'Drop video here' : 'Click or drag a video file'}
          </p>
          <p className="text-[10px] text-white/25 mt-0.5">MP4, WebM, MOV, MKV…</p>
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,.mp4,.webm,.mov,.avi,.mkv,.m4v"
        onChange={handleFileInput}
        className="hidden"
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 hover:bg-white/8 text-white/60 hover:text-white/80 text-xs font-medium transition-all border border-white/5"
      >
        <FolderOpen size={14} />
        Browse File…
      </button>

      {/* History */}
      {history.length > 0 && (
        <div className="flex flex-col gap-2 mt-1">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-white/25">Recent Recordings</p>
          <div className="flex flex-col gap-1.5">
            {history.map((entry) => (
              <HistoryItem
                key={entry.id}
                entry={entry}
                loading={loadingId === entry.id}
                error={errorId === entry.id}
                onReopen={handleReopen}
                onRemove={handleRemove}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ── History item ───────────────────────────────────────────────────────────────

function HistoryItem({
  entry, loading, error, onReopen, onRemove
}: {
  entry: RecordingHistoryEntry
  loading: boolean
  error: boolean
  onReopen: (e: RecordingHistoryEntry) => void
  onRemove: (id: string) => void
}) {
  return (
    <div className="flex items-center gap-2 p-2 rounded-lg bg-white/3 border border-white/5 group hover:border-white/10 transition-all">
      <div className="w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
        {error
          ? <AlertCircle size={13} className="text-red-400/70" />
          : <Film size={13} className="text-white/30" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-medium text-white/70 truncate leading-tight">{entry.fileName}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[9px] text-white/25 uppercase">{entry.format}</span>
          {entry.durationSec > 0 && (
            <span className="text-[9px] text-white/25 flex items-center gap-0.5">
              <Clock size={8} />
              {fmtDuration(entry.durationSec)}
            </span>
          )}
          <span className="text-[9px] text-white/20">{relativeDate(entry.savedAt)}</span>
        </div>
        {error && (
          <p className="text-[9px] text-red-400/60 mt-0.5">File not found</p>
        )}
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button
          onClick={() => onReopen(entry)}
          disabled={loading}
          title="Re-edit"
          className="w-6 h-6 rounded flex items-center justify-center text-white/30 hover:text-white/70 hover:bg-white/8 transition-all disabled:opacity-40"
        >
          <RotateCcw size={11} className={loading ? 'animate-spin' : ''} />
        </button>
        <button
          onClick={() => onRemove(entry.id)}
          title="Remove from history"
          className="w-6 h-6 rounded flex items-center justify-center text-white/20 hover:text-red-400/70 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  )
}

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60)
  const sec = Math.floor(s % 60)
  return `${m}:${String(sec).padStart(2, '0')}`
}

function relativeDate(ts: number): string {
  const diff = Date.now() - ts
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function mimeTypeFromFormat(format: string): string {
  if (format === 'webm') return 'video/webm'
  if (format === 'gif') return 'image/gif'
  return 'video/mp4'
}
