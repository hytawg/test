import { useEffect } from 'react'
import { Circle, Square, Pause, Play, X } from 'lucide-react'
import clsx from 'clsx'
import type { CaptureSource, CameraSettings, AudioSettings, RecordingSettings } from '../types'
import { useRecording } from '../hooks/useRecording'

type Props = {
  source: CaptureSource | null
  camera: CameraSettings
  audio: AudioSettings
  recordingSettings: RecordingSettings
  onStreamsChange: (screen: MediaStream | null, camera: MediaStream | null) => void
  onRecordingComplete: (blob: Blob, durationSec: number) => void
}

function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

export function RecordingBar({
  source, camera, audio, recordingSettings, onStreamsChange, onRecordingComplete
}: Props) {
  const {
    recordingState, duration, countdown,
    startRecording, stopRecording, pauseRecording, resumeRecording, cancelRecording,
    screenStream, cameraStream, onComplete
  } = useRecording()

  // Register completion callback → go to editor
  useEffect(() => {
    onComplete(onRecordingComplete)
  }, [onComplete, onRecordingComplete])

  // Propagate streams to parent
  useEffect(() => {
    onStreamsChange(screenStream, cameraStream)
  }, [screenStream, cameraStream, onStreamsChange])

  // Listen for remote start/stop from Chrome extension via main process
  useEffect(() => {
    window.electronAPI?.onRemoteStart(() => {
      if (source && recordingState === 'idle') {
        startRecording(source, camera, audio, recordingSettings)
      }
    })
    window.electronAPI?.onRemoteStop(() => {
      if (recordingState === 'recording' || recordingState === 'paused') {
        stopRecording()
      }
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Report recording status to main process (for HTTP /status endpoint)
  useEffect(() => {
    window.electronAPI?.sendStatus({ state: recordingState, duration })
  }, [recordingState, duration])

  const handleStart = () => {
    if (!source) return
    startRecording(source, camera, audio, recordingSettings)
  }

  const isIdle = recordingState === 'idle'
  const isRecording = recordingState === 'recording'
  const isPaused = recordingState === 'paused'
  const isCountdown = recordingState === 'countdown'
  const isProcessing = recordingState === 'processing'

  return (
    <div className="h-16 border-t border-white/5 bg-surface-950 flex items-center px-6 gap-4">
      {/* Status */}
      <div className="flex items-center gap-2 min-w-[120px]">
        {isRecording && (
          <>
            <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm font-mono text-white/70">{formatDuration(duration)}</span>
          </>
        )}
        {isPaused && (
          <>
            <div className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-sm font-mono text-white/50">Paused {formatDuration(duration)}</span>
          </>
        )}
        {isCountdown && (
          <span className="text-2xl font-bold text-white animate-bounce">{countdown}</span>
        )}
        {isProcessing && (
          <span className="text-xs text-white/40 animate-pulse">Opening editor…</span>
        )}
        {isIdle && source && (
          <span className="text-xs text-white/30 truncate max-w-[110px]">{source.name}</span>
        )}
        {isIdle && !source && (
          <span className="text-xs text-white/20">No source selected</span>
        )}
      </div>

      <div className="flex-1" />

      {/* Controls */}
      <div className="flex items-center gap-2">
        {(isRecording || isPaused) && (
          <button onClick={cancelRecording}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/40 hover:text-white/70 transition-all"
            title="Cancel">
            <X size={16} />
          </button>
        )}

        {isRecording && (
          <button onClick={pauseRecording}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all">
            <Pause size={16} />
          </button>
        )}
        {isPaused && (
          <button onClick={resumeRecording}
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 flex items-center justify-center text-white/60 hover:text-white transition-all">
            <Play size={16} />
          </button>
        )}

        {isIdle && (
          <button onClick={handleStart} disabled={!source}
            className={clsx(
              'flex items-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200',
              source
                ? 'bg-red-500 hover:bg-red-400 text-white shadow-lg shadow-red-500/30 hover:scale-105 active:scale-95'
                : 'bg-white/5 text-white/20 cursor-not-allowed'
            )}>
            <Circle size={12} className={source ? 'fill-white' : 'fill-white/20'} />
            Record
          </button>
        )}

        {(isRecording || isPaused) && (
          <button onClick={stopRecording}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 text-white font-semibold text-sm transition-all">
            <Square size={12} className="fill-white" />
            Stop &amp; Edit
          </button>
        )}

        {isCountdown && (
          <button onClick={cancelRecording}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/5 text-white/50 font-semibold text-sm">
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}
