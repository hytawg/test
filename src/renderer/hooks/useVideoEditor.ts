import { useState, useRef, useCallback, useEffect } from 'react'
import type { EditState, ZoomKeyframe, TextAnnotation } from '../types'
import { nanoid } from '../utils/nanoid'

type UseVideoEditorReturn = {
  state: EditState
  videoRef: React.RefObject<HTMLVideoElement>
  canvasRef: React.RefObject<HTMLCanvasElement>
  videoLoaded: boolean
  // Playback
  playing: boolean
  currentTime: number
  play: () => void
  pause: () => void
  seek: (t: number) => void
  // Edit actions
  setTrimStart: (t: number) => void
  setTrimEnd: (t: number) => void
  setActiveTool: (tool: EditState['activeTool']) => void
  setSelectedId: (id: string | null) => void
  // Zoom keyframes
  addZoomKeyframe: (time: number, x?: number, y?: number) => void
  addZoomRegion: (startTime: number, endTime: number) => void
  updateZoomKeyframe: (id: string, patch: Partial<ZoomKeyframe>) => void
  removeZoomKeyframe: (id: string) => void
  // Text annotations
  addTextAnnotation: (x: number, y: number, time: number) => void
  updateTextAnnotation: (id: string, patch: Partial<TextAnnotation>) => void
  removeTextAnnotation: (id: string) => void
  // Export
  exportVideo: (format: string, quality: string, fps: number, saveLocation: string) => Promise<void>
  exporting: boolean
  exportProgress: number
}

export function useVideoEditor(initialState: EditState): UseVideoEditorReturn {
  const [state, setState] = useState<EditState>(initialState)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(initialState.trimStart)
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [videoLoaded, setVideoLoaded] = useState(false)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rafRef = useRef<number | null>(null)
  const stateRef = useRef(state)
  stateRef.current = state

  // ── Render a single frame to canvas ──────────────────────────────────────

  const renderFrame = useCallback((time: number) => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const st = stateRef.current

    // Compute zoom/pan at this time
    const { sx, sy, sw, sh } = computeZoomCrop(st.zoomKeyframes, time, video.videoWidth, video.videoHeight)

    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H)

    // Draw text annotations
    const activeTexts = st.textAnnotations.filter(
      (a) => a.startTime <= time && a.endTime >= time
    )
    for (const ann of activeTexts) {
      drawText(ctx, ann, W, H)
    }
  }, [])

  // ── Playback loop ─────────────────────────────────────────────────────────

  const tick = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    const t = video.currentTime
    setCurrentTime(t)
    renderFrame(t)
    // Stop at trim end
    if (t >= stateRef.current.trimEnd) {
      video.pause()
      setPlaying(false)
      return
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [renderFrame])

  const play = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    if (video.currentTime >= stateRef.current.trimEnd) {
      video.currentTime = stateRef.current.trimStart
    }
    video.play()
    setPlaying(true)
    rafRef.current = requestAnimationFrame(tick)
  }, [tick])

  const pause = useCallback(() => {
    const video = videoRef.current
    video?.pause()
    setPlaying(false)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  const seek = useCallback((t: number) => {
    const video = videoRef.current
    if (!video) return
    const clamped = Math.max(stateRef.current.trimStart, Math.min(stateRef.current.trimEnd, t))
    video.currentTime = clamped
    setCurrentTime(clamped)
    // Render that frame (after seeked event)
    video.onseeked = () => renderFrame(clamped)
  }, [renderFrame])

  // Render on mount & state changes
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onLoaded = () => {
      video.currentTime = stateRef.current.trimStart
      video.onseeked = () => renderFrame(stateRef.current.trimStart)
    }
    const onLoadedWithFlag = () => { onLoaded(); setVideoLoaded(true) }
    video.addEventListener('loadedmetadata', onLoadedWithFlag)
    return () => video.removeEventListener('loadedmetadata', onLoadedWithFlag)
  }, [renderFrame])

  // Re-render on state change when paused
  useEffect(() => {
    if (!playing) renderFrame(currentTime)
  }, [state.zoomKeyframes, state.textAnnotations, playing, currentTime, renderFrame])

  // ── Edit actions ──────────────────────────────────────────────────────────

  const setTrimStart = useCallback((t: number) => {
    setState((s) => ({ ...s, trimStart: Math.min(t, s.trimEnd - 0.1) }))
  }, [])

  const setTrimEnd = useCallback((t: number) => {
    setState((s) => ({ ...s, trimEnd: Math.max(t, s.trimStart + 0.1) }))
  }, [])

  const setActiveTool = useCallback((tool: EditState['activeTool']) => {
    setState((s) => ({ ...s, activeTool: tool }))
  }, [])

  const setSelectedId = useCallback((id: string | null) => {
    setState((s) => ({ ...s, selectedId: id }))
  }, [])

  const addZoomKeyframe = useCallback((time: number, x = 0.5, y = 0.5) => {
    const kf: ZoomKeyframe = { id: nanoid(), time, x, y, scale: 1.5, easing: 'ease-in-out' }
    setState((s) => ({
      ...s,
      zoomKeyframes: [...s.zoomKeyframes, kf].sort((a, b) => a.time - b.time),
      selectedId: kf.id
    }))
  }, [])

  const addZoomRegion = useCallback((startTime: number, endTime: number) => {
    const kfIn: ZoomKeyframe = { id: nanoid(), time: startTime, x: 0.5, y: 0.5, scale: 1.5, easing: 'ease-in-out' }
    const kfOut: ZoomKeyframe = { id: nanoid(), time: endTime, x: 0.5, y: 0.5, scale: 1.0, easing: 'ease-in-out' }
    setState((s) => ({
      ...s,
      zoomKeyframes: [...s.zoomKeyframes, kfIn, kfOut].sort((a, b) => a.time - b.time),
      selectedId: kfIn.id
    }))
  }, [])

  const updateZoomKeyframe = useCallback((id: string, patch: Partial<ZoomKeyframe>) => {
    setState((s) => ({
      ...s,
      zoomKeyframes: s.zoomKeyframes.map((kf) => (kf.id === id ? { ...kf, ...patch } : kf))
    }))
  }, [])

  const removeZoomKeyframe = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      zoomKeyframes: s.zoomKeyframes.filter((kf) => kf.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId
    }))
  }, [])

  const addTextAnnotation = useCallback((x: number, y: number, time: number) => {
    const ann: TextAnnotation = {
      id: nanoid(),
      text: 'Text',
      startTime: time,
      endTime: Math.min(time + 3, stateRef.current.trimEnd),
      x, y,
      fontSize: 32,
      color: '#ffffff',
      bgColor: '#000000',
      bgEnabled: true,
      bold: false,
      align: 'center'
    }
    setState((s) => ({ ...s, textAnnotations: [...s.textAnnotations, ann], selectedId: ann.id }))
  }, [])

  const updateTextAnnotation = useCallback((id: string, patch: Partial<TextAnnotation>) => {
    setState((s) => ({
      ...s,
      textAnnotations: s.textAnnotations.map((a) => (a.id === id ? { ...a, ...patch } : a))
    }))
  }, [])

  const removeTextAnnotation = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      textAnnotations: s.textAnnotations.filter((a) => a.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId
    }))
  }, [])

  // ── Export ────────────────────────────────────────────────────────────────

  const exportVideo = useCallback(
    async (format: string, quality: string, fps: number, saveLocation: string) => {
      const video = videoRef.current
      const canvas = canvasRef.current
      if (!video || !canvas) return

      setExporting(true)
      setExportProgress(0)

      const st = stateRef.current
      const duration = st.trimEnd - st.trimStart
      const bitrate =
        quality === 'high' ? 8_000_000 : quality === 'medium' ? 4_000_000 : 2_000_000

      // Seek to trim start
      video.currentTime = st.trimStart
      await waitForSeek(video)

      // Capture canvas stream
      const canvasStream = canvas.captureStream(fps)
      // Prefer H.264 MP4 for QuickTime compatibility; fall back to VP9/VP8 WebM
      const mimeType = MediaRecorder.isTypeSupported('video/mp4;codecs=avc1')
        ? 'video/mp4;codecs=avc1'
        : MediaRecorder.isTypeSupported('video/webm;codecs=vp9')
          ? 'video/webm;codecs=vp9'
          : 'video/webm;codecs=vp8'
      const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm'
      const recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: bitrate })
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

      recorder.start()

      // Render frames by advancing video frame by frame
      const frameInterval = 1 / fps
      let t = st.trimStart
      let frameCount = 0

      while (t <= st.trimEnd) {
        video.currentTime = t
        await waitForSeek(video)
        renderFrame(t)
        setExportProgress(((t - st.trimStart) / duration) * 100)
        t += frameInterval
        frameCount++
        // Yield to browser every 10 frames to keep UI responsive
        if (frameCount % 10 === 0) {
          await new Promise<void>((r) => setTimeout(r, 0))
        }
      }

      recorder.stop()
      await new Promise<void>((r) => { recorder.onstop = () => r() })

      const blob = new Blob(chunks, { type: mimeType })
      const buffer = await blob.arrayBuffer()

      if (saveLocation === 'dialog') {
        await window.electronAPI?.saveRecording(buffer, ext)
      } else {
        await window.electronAPI?.saveToDownloads(buffer, ext)
      }

      setExporting(false)
      setExportProgress(100)
    },
    [renderFrame]
  )

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  return {
    state, videoRef, canvasRef, videoLoaded,
    playing, currentTime,
    play, pause, seek,
    setTrimStart, setTrimEnd, setActiveTool, setSelectedId,
    addZoomKeyframe, addZoomRegion, updateZoomKeyframe, removeZoomKeyframe,
    addTextAnnotation, updateTextAnnotation, removeTextAnnotation,
    exportVideo, exporting, exportProgress
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function waitForSeek(video: HTMLVideoElement): Promise<void> {
  return new Promise((r) => {
    if (!video.seeking) { r(); return }
    video.onseeked = () => r()
  })
}

/** Interpolate zoom keyframes at time t → source crop rect */
function computeZoomCrop(
  keyframes: ZoomKeyframe[],
  time: number,
  videoW: number,
  videoH: number
): { sx: number; sy: number; sw: number; sh: number } {
  if (keyframes.length === 0 || videoW === 0) {
    return { sx: 0, sy: 0, sw: videoW, sh: videoH }
  }

  let kfA: ZoomKeyframe | null = null
  let kfB: ZoomKeyframe | null = null

  for (let i = 0; i < keyframes.length; i++) {
    if (keyframes[i].time <= time) kfA = keyframes[i]
    if (!kfB && keyframes[i].time >= time) kfB = keyframes[i]
  }

  const kf = kfA && kfB && kfA.id !== kfB.id
    ? interpolateKf(kfA, kfB, time)
    : kfA ?? kfB ?? { x: 0.5, y: 0.5, scale: 1 }

  const sw = videoW / kf.scale
  const sh = videoH / kf.scale
  const sx = Math.max(0, Math.min(kf.x * videoW - sw / 2, videoW - sw))
  const sy = Math.max(0, Math.min(kf.y * videoH - sh / 2, videoH - sh))
  return { sx, sy, sw, sh }
}

function interpolateKf(a: ZoomKeyframe, b: ZoomKeyframe, t: number) {
  const d = b.time - a.time
  let p = d === 0 ? 1 : (t - a.time) / d
  if (a.easing === 'ease-in-out') p = easeInOut(p)
  return {
    x: a.x + (b.x - a.x) * p,
    y: a.y + (b.y - a.y) * p,
    scale: a.scale + (b.scale - a.scale) * p
  }
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}

function drawText(ctx: CanvasRenderingContext2D, ann: TextAnnotation, W: number, H: number) {
  const x = ann.x * W
  const y = ann.y * H
  const fs = ann.fontSize
  ctx.font = `${ann.bold ? 'bold ' : ''}${fs}px -apple-system, sans-serif`
  ctx.textAlign = ann.align
  ctx.textBaseline = 'middle'

  const metrics = ctx.measureText(ann.text)
  const tw = metrics.width
  const th = fs * 1.4

  if (ann.bgEnabled) {
    const pad = fs * 0.3
    ctx.fillStyle = ann.bgColor + 'cc'
    ctx.beginPath()
    const rx = ann.align === 'center' ? x - tw / 2 - pad : ann.align === 'right' ? x - tw - pad : x - pad
    roundRect(ctx, rx, y - th / 2 - pad / 2, tw + pad * 2, th + pad, 6)
    ctx.fill()
  }

  ctx.fillStyle = ann.color
  ctx.fillText(ann.text, x, y)
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
}
