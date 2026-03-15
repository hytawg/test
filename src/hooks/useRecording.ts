import { useState, useRef, useCallback, useEffect } from 'react'
import type { CaptureSource, CameraSettings, AudioSettings, RecordingSettings } from '../types'

type RecordingState = 'idle' | 'countdown' | 'recording' | 'paused' | 'processing'

type UseRecordingReturn = {
  recordingState: RecordingState
  duration: number
  countdown: number
  startRecording: (
    source: CaptureSource,
    camera: CameraSettings,
    audio: AudioSettings,
    settings: RecordingSettings
  ) => Promise<void>
  stopRecording: () => void
  pauseRecording: () => void
  resumeRecording: () => void
  cancelRecording: () => void
  screenStream: MediaStream | null
  cameraStream: MediaStream | null
}

export function useRecording(): UseRecordingReturn {
  const [recordingState, setRecordingState] = useState<RecordingState>('idle')
  const [duration, setDuration] = useState(0)
  const [countdown, setCountdown] = useState(0)
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null)
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null)

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const settingsRef = useRef<RecordingSettings | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const stopAllStreams = useCallback(() => {
    screenStream?.getTracks().forEach((t) => t.stop())
    cameraStream?.getTracks().forEach((t) => t.stop())
    setScreenStream(null)
    setCameraStream(null)
  }, [screenStream, cameraStream])

  const startRecording = useCallback(
    async (
      source: CaptureSource,
      camera: CameraSettings,
      audio: AudioSettings,
      settings: RecordingSettings
    ) => {
      settingsRef.current = settings
      chunksRef.current = []

      // Start countdown
      setCountdown(3)
      setRecordingState('countdown')

      await new Promise<void>((resolve) => {
        let count = 3
        const interval = setInterval(() => {
          count--
          setCountdown(count)
          if (count <= 0) {
            clearInterval(interval)
            resolve()
          }
        }, 1000)
      })

      // Acquire screen stream
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: audio.systemAudioEnabled
            ? ({ mandatory: { chromeMediaSource: 'desktop' } } as unknown as MediaTrackConstraints)
            : false,
          video: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: source.id,
              maxFrameRate: settings.fps
            }
          } as unknown as MediaTrackConstraints
        })
      } catch {
        // Fallback: try without audio
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: source.id,
              maxFrameRate: settings.fps
            }
          } as unknown as MediaTrackConstraints
        })
      }

      setScreenStream(stream)

      // Acquire mic stream
      let combinedStream = stream
      if (audio.micEnabled && audio.micDeviceId !== 'none') {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: {
              deviceId: audio.micDeviceId ?? undefined,
              echoCancellation: true,
              noiseSuppression: true
            },
            video: false
          })
          // Merge tracks
          const tracks = [...stream.getTracks(), ...micStream.getAudioTracks()]
          combinedStream = new MediaStream(tracks)
        } catch {
          // mic unavailable, continue without
        }
      }

      // Acquire camera stream
      if (camera.enabled && camera.deviceId && camera.deviceId !== 'none') {
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: camera.deviceId } },
            audio: false
          })
          setCameraStream(camStream)
        } catch {
          // camera unavailable
        }
      }

      // Setup MediaRecorder
      const mimeType = settings.format === 'webm' ? 'video/webm;codecs=vp9' : 'video/webm;codecs=vp8'
      const bitrate =
        settings.quality === 'high' ? 8_000_000 : settings.quality === 'medium' ? 4_000_000 : 2_000_000

      const recorder = new MediaRecorder(combinedStream, {
        mimeType,
        videoBitsPerSecond: bitrate
      })

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      recorder.onstop = async () => {
        setRecordingState('processing')
        clearTimer()

        const blob = new Blob(chunksRef.current, { type: mimeType })
        const buffer = await blob.arrayBuffer()
        const fmt = settingsRef.current?.format ?? 'mp4'
        const saveLocation = settingsRef.current?.saveLocation ?? 'downloads'

        if (saveLocation === 'dialog') {
          await window.electronAPI?.saveRecording(buffer, fmt)
        } else {
          await window.electronAPI?.saveToDownloads(buffer, fmt)
        }

        stopAllStreams()
        setRecordingState('idle')
        setDuration(0)
      }

      mediaRecorderRef.current = recorder
      recorder.start(1000) // collect data every 1s
      setRecordingState('recording')
      setDuration(0)

      timerRef.current = setInterval(() => {
        setDuration((d) => d + 1)
      }, 1000)
    },
    [clearTimer, stopAllStreams]
  )

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
  }, [])

  const pauseRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause()
      clearTimer()
      setRecordingState('paused')
    }
  }, [clearTimer])

  const resumeRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume()
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
      setRecordingState('recording')
    }
  }, [])

  const cancelRecording = useCallback(() => {
    mediaRecorderRef.current?.stop()
    clearTimer()
    stopAllStreams()
    chunksRef.current = []
    setRecordingState('idle')
    setDuration(0)
  }, [clearTimer, stopAllStreams])

  useEffect(() => () => clearTimer(), [clearTimer])

  return {
    recordingState,
    duration,
    countdown,
    startRecording,
    stopRecording,
    pauseRecording,
    resumeRecording,
    cancelRecording,
    screenStream,
    cameraStream
  }
}
