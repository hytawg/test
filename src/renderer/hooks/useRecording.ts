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
  onComplete: (cb: (blob: Blob, durationSec: number) => void) => void
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
  const durationRef = useRef(0)
  const onCompleteRef = useRef<((blob: Blob, durationSec: number) => void) | null>(null)
  const streamsRef = useRef<{ screen: MediaStream | null; cam: MediaStream | null }>({ screen: null, cam: null })

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const stopAllStreams = useCallback(() => {
    streamsRef.current.screen?.getTracks().forEach((t) => t.stop())
    streamsRef.current.cam?.getTracks().forEach((t) => t.stop())
    streamsRef.current = { screen: null, cam: null }
    setScreenStream(null)
    setCameraStream(null)
  }, [])

  const onComplete = useCallback((cb: (blob: Blob, durationSec: number) => void) => {
    onCompleteRef.current = cb
  }, [])

  const startRecording = useCallback(
    async (
      source: CaptureSource,
      camera: CameraSettings,
      audio: AudioSettings,
      settings: RecordingSettings
    ) => {
      chunksRef.current = []
      durationRef.current = 0

      // Countdown
      setCountdown(3)
      setRecordingState('countdown')
      await new Promise<void>((resolve) => {
        let count = 3
        const interval = setInterval(() => {
          count--
          setCountdown(count)
          if (count <= 0) { clearInterval(interval); resolve() }
        }, 1000)
      })

      // Screen stream
      // Window sources (id starts with 'window:') cannot share a getUserMedia call
      // with chromeMediaSource:'desktop' audio — that combination silently falls back
      // to full-display capture on some platforms. Request them separately.
      const isWindowSource = source.id.startsWith('window:')
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          // System audio requires chromeMediaSource:'desktop' which conflicts with
          // window-specific video capture, so disable it for window sources.
          audio: (audio.systemAudioEnabled && !isWindowSource)
            ? ({ mandatory: { chromeMediaSource: 'desktop' } } as unknown as MediaTrackConstraints)
            : false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: source.id,
              maxFrameRate: settings.fps
            }
          } as unknown as MediaTrackConstraints
        })
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: source.id,
              maxFrameRate: settings.fps
            }
          } as unknown as MediaTrackConstraints
        })
      }
      streamsRef.current.screen = stream
      setScreenStream(stream)

      // Mic
      let combinedStream = stream
      if (audio.micEnabled && audio.micDeviceId !== 'none') {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: audio.micDeviceId ?? undefined, echoCancellation: true, noiseSuppression: true },
            video: false
          })
          combinedStream = new MediaStream([...stream.getTracks(), ...micStream.getAudioTracks()])
        } catch { /* ignore */ }
      }

      // Camera
      if (camera.enabled && camera.deviceId && camera.deviceId !== 'none') {
        try {
          const camStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: camera.deviceId } },
            audio: false
          })
          streamsRef.current.cam = camStream
          setCameraStream(camStream)
        } catch { /* ignore */ }
      }

      // MediaRecorder — always record as webm for editing compatibility
      const mimeType = 'video/webm;codecs=vp8'
      const bitrate =
        settings.quality === 'high' ? 8_000_000 : settings.quality === 'medium' ? 4_000_000 : 2_000_000

      const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: bitrate })
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }

      recorder.onstop = () => {
        setRecordingState('processing')
        clearTimer()
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const finalDuration = durationRef.current
        stopAllStreams()
        setRecordingState('idle')
        setDuration(0)
        durationRef.current = 0
        // Hand off to editor instead of saving
        onCompleteRef.current?.(blob, finalDuration)
      }

      mediaRecorderRef.current = recorder
      recorder.start(1000)
      setRecordingState('recording')
      setDuration(0)

      timerRef.current = setInterval(() => {
        durationRef.current += 1
        setDuration((d) => d + 1)
      }, 1000)
    },
    [clearTimer, stopAllStreams]
  )

  const stopRecording = useCallback(() => { mediaRecorderRef.current?.stop() }, [])

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
      timerRef.current = setInterval(() => { durationRef.current += 1; setDuration((d) => d + 1) }, 1000)
      setRecordingState('recording')
    }
  }, [])

  const cancelRecording = useCallback(() => {
    onCompleteRef.current = null // discard
    mediaRecorderRef.current?.stop()
    clearTimer()
    stopAllStreams()
    chunksRef.current = []
    setRecordingState('idle')
    setDuration(0)
    durationRef.current = 0
  }, [clearTimer, stopAllStreams])

  useEffect(() => () => clearTimer(), [clearTimer])

  return {
    recordingState, duration, countdown,
    startRecording, stopRecording, pauseRecording, resumeRecording, cancelRecording,
    screenStream, cameraStream, onComplete
  }
}
