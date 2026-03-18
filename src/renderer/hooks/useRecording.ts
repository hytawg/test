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
    settings: RecordingSettings,
    captureRegion?: { x: number; y: number; w: number; h: number } | null
  ) => Promise<void>
  stopRecording: () => void
  pauseRecording: () => void
  resumeRecording: () => void
  cancelRecording: () => void
  screenStream: MediaStream | null
  cameraStream: MediaStream | null
  /** cb receives (blob, durationSec, captureRegionBaked).
   *  captureRegionBaked=true means the captureRegion was applied during
   *  compositing and the editor must NOT crop again. */
  onComplete: (cb: (blob: Blob, durationSec: number, captureRegionBaked: boolean) => void) => void
}

// Draw a rounded-rectangle clip path
function roundRectClip(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number, r: number
) {
  const cr = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + cr, y)
  ctx.lineTo(x + w - cr, y);  ctx.arcTo(x + w, y,     x + w, y + cr,     cr)
  ctx.lineTo(x + w, y + h - cr); ctx.arcTo(x + w, y + h, x + w - cr, y + h, cr)
  ctx.lineTo(x + cr, y + h);  ctx.arcTo(x,     y + h, x,     y + h - cr, cr)
  ctx.lineTo(x, y + cr);      ctx.arcTo(x,     y,     x + cr, y,          cr)
  ctx.closePath()
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
  const onCompleteRef = useRef<((blob: Blob, durationSec: number, captureRegionBaked: boolean) => void) | null>(null)
  const captureRegionBakedRef = useRef(false)
  const streamsRef = useRef<{ screen: MediaStream | null; cam: MediaStream | null }>({ screen: null, cam: null })

  // Canvas compositing for camera overlay
  const compRafRef = useRef<number | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const stopAllStreams = useCallback(() => {
    if (compRafRef.current) {
      cancelAnimationFrame(compRafRef.current)
      compRafRef.current = null
    }
    streamsRef.current.screen?.getTracks().forEach((t) => t.stop())
    streamsRef.current.cam?.getTracks().forEach((t) => t.stop())
    streamsRef.current = { screen: null, cam: null }
    setScreenStream(null)
    setCameraStream(null)
  }, [])

  const onComplete = useCallback((cb: (blob: Blob, durationSec: number, captureRegionBaked: boolean) => void) => {
    onCompleteRef.current = cb
  }, [])

  const startRecording = useCallback(
    async (
      source: CaptureSource,
      camera: CameraSettings,
      audio: AudioSettings,
      settings: RecordingSettings,
      captureRegion?: { x: number; y: number; w: number; h: number } | null
    ) => {
      chunksRef.current = []
      durationRef.current = 0
      captureRegionBakedRef.current = false

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
      const isWindowSource = source.id.startsWith('window:')
      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
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
      let audioTracks: MediaStreamTrack[] = stream.getAudioTracks()
      if (audio.micEnabled && audio.micDeviceId !== 'none') {
        try {
          const micStream = await navigator.mediaDevices.getUserMedia({
            audio: { deviceId: audio.micDeviceId ?? undefined, echoCancellation: true, noiseSuppression: true },
            video: false
          })
          audioTracks = [...audioTracks, ...micStream.getAudioTracks()]
        } catch { /* ignore */ }
      }

      // Camera
      let camStream: MediaStream | null = null
      if (camera.enabled && camera.deviceId && camera.deviceId !== 'none') {
        try {
          camStream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: camera.deviceId } },
            audio: false
          })
          streamsRef.current.cam = camStream
          setCameraStream(camStream)
        } catch { /* ignore */ }
      }

      // Build the stream to record:
      // If camera is available, composite screen + camera onto a canvas and record from it.
      // Otherwise record the raw screen stream.
      let recordStream: MediaStream

      if (camStream) {
        const screenTrack = stream.getVideoTracks()[0]
        const { width: trackW, height: trackH } = screenTrack.getSettings()
        const W = trackW || 1280
        const H = trackH || 720

        // Apply captureRegion (browser toolbar crop) during compositing so the
        // browser toolbar is removed from the recording itself.
        // The editor then receives captureRegion=null (already baked in).
        const cr = captureRegion
        const srcX = cr ? Math.round(cr.x * W) : 0
        const srcY = cr ? Math.round(cr.y * H) : 0
        const srcW = cr ? Math.round(cr.w * W) : W
        const srcH = cr ? Math.round(cr.h * H) : H

        // Offscreen composite canvas (same dimensions as source — crop is done via drawImage)
        const compCanvas = document.createElement('canvas')
        compCanvas.width = W
        compCanvas.height = H
        const ctx = compCanvas.getContext('2d')!

        if (cr) captureRegionBakedRef.current = true

        // Hidden video elements for drawing
        const screenVid = document.createElement('video')
        screenVid.srcObject = stream
        screenVid.muted = true
        screenVid.play().catch(() => {})

        const camVid = document.createElement('video')
        camVid.srcObject = camStream
        camVid.muted = true
        camVid.play().catch(() => {})

        // Camera layout in video-space pixels (relative to the composited canvas)
        const camSizePx = Math.round(W * (camera.size / 100))
        const gap = Math.round(W * 0.01)  // ~1% of width

        const drawComposite = () => {
          // Screen — drawn with captureRegion crop scaled to fill the full canvas
          if (screenVid.readyState >= 2) {
            ctx.drawImage(screenVid, srcX, srcY, srcW, srcH, 0, 0, W, H)
          } else {
            ctx.fillStyle = '#000'
            ctx.fillRect(0, 0, W, H)
          }

          // Camera overlay
          if (camVid.readyState >= 2) {
            let camX: number, camY: number
            switch (camera.position) {
              case 'top-left':    camX = gap;                    camY = gap; break
              case 'top-right':   camX = W - camSizePx - gap;   camY = gap; break
              case 'bottom-left': camX = gap;                    camY = H - camSizePx - gap; break
              default:            camX = W - camSizePx - gap;   camY = H - camSizePx - gap
            }

            ctx.save()
            // Clip to camera shape
            if (camera.shape === 'circle') {
              ctx.beginPath()
              ctx.arc(camX + camSizePx / 2, camY + camSizePx / 2, camSizePx / 2, 0, Math.PI * 2)
              ctx.clip()
            } else if (camera.shape === 'rounded') {
              roundRectClip(ctx, camX, camY, camSizePx, camSizePx, camSizePx * 0.16)
              ctx.clip()
            } else {
              ctx.beginPath()
              ctx.rect(camX, camY, camSizePx, camSizePx)
              ctx.clip()
            }

            if (camera.mirrorEnabled) {
              ctx.translate(camX * 2 + camSizePx, 0)
              ctx.scale(-1, 1)
            }
            ctx.drawImage(camVid, camX, camY, camSizePx, camSizePx)
            ctx.restore()

            // Border (drawn outside the clip so it sits on the edge)
            if (camera.borderEnabled && camera.borderWidth > 0) {
              ctx.save()
              ctx.strokeStyle = camera.borderColor
              ctx.lineWidth = camera.borderWidth
              if (camera.shape === 'circle') {
                ctx.beginPath()
                ctx.arc(camX + camSizePx / 2, camY + camSizePx / 2, camSizePx / 2 - camera.borderWidth / 2, 0, Math.PI * 2)
                ctx.stroke()
              } else if (camera.shape === 'rounded') {
                roundRectClip(ctx, camX + camera.borderWidth / 2, camY + camera.borderWidth / 2,
                  camSizePx - camera.borderWidth, camSizePx - camera.borderWidth,
                  camSizePx * 0.16)
                ctx.stroke()
              } else {
                ctx.strokeRect(camX + camera.borderWidth / 2, camY + camera.borderWidth / 2,
                  camSizePx - camera.borderWidth, camSizePx - camera.borderWidth)
              }
              ctx.restore()
            }
          }

          compRafRef.current = requestAnimationFrame(drawComposite)
        }
        drawComposite()

        // Capture canvas stream and add audio tracks
        const canvasStream = compCanvas.captureStream(settings.fps)
        audioTracks.forEach(t => canvasStream.addTrack(t))
        recordStream = canvasStream
      } else {
        // No camera — record the raw screen stream + audio
        recordStream = audioTracks.length > 0
          ? new MediaStream([...stream.getTracks(), ...audioTracks.filter(t => !stream.getTracks().includes(t))])
          : stream
      }

      // MediaRecorder
      const mimeType = 'video/webm;codecs=vp8'
      const bitrate =
        settings.quality === 'high' ? 8_000_000 : settings.quality === 'medium' ? 4_000_000 : 2_000_000

      const recorder = new MediaRecorder(recordStream, { mimeType, videoBitsPerSecond: bitrate })
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }

      recorder.onstop = () => {
        window.electronAPI?.sendRecordingStatus({
          state: 'processing', duration: durationRef.current, countdown: 0, sourceName: ''
        })
        setRecordingState('processing')
        clearTimer()
        const blob = new Blob(chunksRef.current, { type: mimeType })
        const finalDuration = durationRef.current
        stopAllStreams()
        setRecordingState('idle')
        setDuration(0)
        durationRef.current = 0
        onCompleteRef.current?.(blob, finalDuration, captureRegionBakedRef.current)
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
