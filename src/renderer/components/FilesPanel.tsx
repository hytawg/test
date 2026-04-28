import { useEffect, useRef, useState } from 'react'
import { Upload, FolderOpen, Film, Clock, Trash2, RotateCcw, AlertCircle, Plus, Layers2, GripVertical, X } from 'lucide-react'
import type { RecordingHistoryEntry } from '../types'
import clsx from 'clsx'

type Props = {
  onOpenFile: (blob: Blob, fileName: string) => void
  onMergeFiles?: (blobs: Blob[]) => void
}

type QueueItem = {
  id: string
  file: File
  duration: number | null  // null = still probing
}

export function FilesPanel({ onOpenFile, onMergeFiles }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const mergeInputRef = useRef<HTMLInputElement>(null)
  const [history, setHistory] = useState<RecordingHistoryEntry[]>([])
  const [dragging, setDragging] = useState(false)
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [errorId, setErrorId] = useState<string | null>(null)
  const dragCounterRef = useRef(0)

  // Multi-clip queue
  const [queue, setQueue] = useState<QueueItem[]>([])
  const dragItemRef = useRef<number | null>(null)
  const dragOverRef = useRef<number | null>(null)

  useEffect(() => {
    window.electronAPI?.getRecordingHistory().then(setHistory)
  }, [])

  // Probe duration of a video file blob
  const probeDuration = (file: File): Promise<number> => {
    return new Promise<number>((resolve) => {
      const url = URL.createObjectURL(file)
      const v = document.createElement('video')
      v.preload = 'metadata'
      let settled = false
      const finish = (d: number) => {
        if (settled) return
        settled = true
        URL.revokeObjectURL(url)
        resolve(d)
      }
      v.onloadedmetadata = () => {
        if (isFinite(v.duration)) { finish(v.duration) }
        else { v.onseeked = () => finish(isFinite(v.duration) ? v.duration : 0); v.currentTime = 1e10 }
      }
      v.onerror = () => finish(0)
      v.src = url
    })
  }

  const addFilesToQueue = async (files: File[]) => {
    const videoFiles = files.filter(f => f.type.startsWith('video/') || /\.(mp4|webm|mov|avi|mkv|m4v)$/i.test(f.name))
    if (videoFiles.length === 0) return

    // Add with null durations first for instant feedback
    const newItems: QueueItem[] = videoFiles.map(f => ({ id: crypto.randomUUID(), file: f, duration: null }))
    setQueue(prev => [...prev, ...newItems])

    // Probe durations in background
    for (const item of newItems) {
      probeDuration(item.file).then(dur => {
        setQueue(prev => prev.map(q => q.id === item.id ? { ...q, duration: dur } : q))
      })
    }
  }

  // ── File import via HTML input ─────────────────────────────────────────────

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    onOpenFile(file, file.name)
  }

  const handleMergeInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    addFilesToQueue(files)
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
    const files = Array.from(e.dataTransfer.files)
    if (files.length === 0) return
    if (files.length === 1 && files[0].type.startsWith('video/')) {
      // Single file → open directly
      onOpenFile(files[0], files[0].name)
    } else {
      // Multiple files → add to merge queue
      addFilesToQueue(files)
    }
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

  // ── Queue drag-reorder ────────────────────────────────────────────────────

  const handleQueueDragStart = (idx: number) => { dragItemRef.current = idx }
  const handleQueueDragEnter = (idx: number) => { dragOverRef.current = idx }
  const handleQueueDragEnd = () => {
    const from = dragItemRef.current
    const to = dragOverRef.current
    if (from === null || to === null || from === to) return
    setQueue(prev => {
      const arr = [...prev]
      const [item] = arr.splice(from, 1)
      arr.splice(to, 0, item)
      return arr
    })
    dragItemRef.current = null
    dragOverRef.current = null
  }

  const handleMerge = () => {
    if (!onMergeFiles || queue.length < 1) return
    onMergeFiles(queue.map(q => q.file))
  }

  const totalDuration = queue.reduce((acc, q) => acc + (q.duration ?? 0), 0)

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
      <input
        ref={mergeInputRef}
        type="file"
        accept="video/*,.mp4,.webm,.mov,.avi,.mkv,.m4v"
        multiple
        onChange={handleMergeInput}
        className="hidden"
      />

      <button
        onClick={() => fileInputRef.current?.click()}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-white/5 hover:bg-white/8 text-white/60 hover:text-white/80 text-xs font-medium transition-all border border-white/5"
      >
        <FolderOpen size={14} />
        Browse File…
      </button>

      {/* Multi-clip merge section */}
      {onMergeFiles && (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-white/25">Merge Clips</p>
            <button
              onClick={() => mergeInputRef.current?.click()}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-white/40 hover:text-white/70 text-[10px] transition-all"
            >
              <Plus size={10} />
              Add
            </button>
          </div>

          {queue.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center gap-2 py-4 rounded-xl border border-dashed border-white/8 cursor-pointer hover:border-white/15 transition-all"
              onClick={() => mergeInputRef.current?.click()}
            >
              <Layers2 size={16} className="text-white/20" />
              <p className="text-[10px] text-white/25">Add multiple files to merge</p>
            </div>
          ) : (
            <div className="flex flex-col gap-1">
              {queue.map((item, idx) => (
                <div
                  key={item.id}
                  draggable
                  onDragStart={() => handleQueueDragStart(idx)}
                  onDragEnter={() => handleQueueDragEnter(idx)}
                  onDragEnd={handleQueueDragEnd}
                  onDragOver={e => e.preventDefault()}
                  className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/4 border border-white/6 group cursor-grab active:cursor-grabbing hover:border-white/12 transition-all"
                >
                  <GripVertical size={12} className="text-white/15 shrink-0" />
                  <Film size={11} className="text-white/30 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] text-white/60 truncate leading-tight">{item.file.name}</p>
                    {item.duration !== null && (
                      <p className="text-[9px] text-white/25 flex items-center gap-0.5">
                        <Clock size={8} />
                        {fmtDuration(item.duration)}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => setQueue(prev => prev.filter(q => q.id !== item.id))}
                    className="w-5 h-5 rounded flex items-center justify-center text-white/20 hover:text-red-400/70 hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all shrink-0"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}

              {/* Total + Edit Together */}
              <div className="flex items-center justify-between mt-1 px-1">
                <span className="text-[9px] text-white/25">
                  {queue.length} clip{queue.length > 1 ? 's' : ''}{totalDuration > 0 ? ` · ${fmtDuration(totalDuration)}` : ''}
                </span>
                <button
                  onClick={() => setQueue([])}
                  className="text-[9px] text-white/20 hover:text-white/40 transition-colors"
                >
                  Clear
                </button>
              </div>

              <button
                onClick={handleMerge}
                disabled={queue.length < 1}
                className={clsx(
                  'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-semibold text-xs transition-all',
                  queue.length >= 1
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white hover:from-indigo-500 hover:to-purple-500 shadow-lg shadow-indigo-500/20 hover:scale-[1.02] active:scale-95'
                    : 'bg-white/5 text-white/20 cursor-not-allowed'
                )}
              >
                <Layers2 size={13} />
                Edit Together
              </button>
            </div>
          )}
        </div>
      )}

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
