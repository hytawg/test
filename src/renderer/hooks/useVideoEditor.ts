import { useState, useRef, useCallback, useEffect } from 'react'
import type { EditState, ZoomRegion, TextAnnotation } from '../types'
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
  // Zoom regions
  addZoomAtTime: (time: number, x?: number, y?: number) => void
  addZoomRegion: (startTime: number, endTime: number) => void
  updateZoomRegion: (id: string, patch: Partial<ZoomRegion>) => void
  removeZoomRegion: (id: string) => void
  // Text annotations
  addTextAnnotation: (x: number, y: number, time: number) => void
  updateTextAnnotation: (id: string, patch: Partial<TextAnnotation>) => void
  removeTextAnnotation: (id: string) => void
  // Export
  exportVideo: (format: string, quality: string, fps: number, saveLocation: string) => Promise<void>
  exporting: boolean
  exportProgress: number
}

// ── Sound helpers ─────────────────────────────────────────────────────────────

function playDoneTone() {
  try {
    const ctx = new AudioContext()
    const play = (freq: number, start: number, dur: number, vol = 0.25) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
      gain.gain.setValueAtTime(vol, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      osc.start(ctx.currentTime + start)
      osc.stop(ctx.currentTime + start + dur)
    }
    play(784, 0,    0.12) // G5
    play(659, 0.13, 0.12) // E5
    play(523, 0.26, 0.22) // C5
  } catch { /* ignore */ }
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

    const { sx, sy, sw, sh } = computeZoomCrop(st.zoomRegions, time, video.videoWidth, video.videoHeight)

    ctx.clearRect(0, 0, W, H)
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, W, H)

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
    video.onseeked = () => renderFrame(clamped)
  }, [renderFrame])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onLoaded = () => {
      video.currentTime = stateRef.current.trimStart
      video.onseeked = () => renderFrame(stateRef.current.trimStart)
      setVideoLoaded(true)
      playDoneTone()
    }
    video.addEventListener('loadedmetadata', onLoaded)
    return () => video.removeEventListener('loadedmetadata', onLoaded)
  }, [renderFrame])

  useEffect(() => {
    if (!playing) renderFrame(currentTime)
  }, [state.zoomRegions, state.textAnnotations, playing, currentTime, renderFrame])

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

  // ── Zoom regions ──────────────────────────────────────────────────────────

  /** Create a zoom region. Overlapping regions are rejected or clipped. */
  const createRegion = (startTime: number, endTime: number, x: number, y: number) => {
    setState((s) => {
      // Reject if overlaps an existing region
      const overlaps = s.zoomRegions.some(
        (r) => startTime < r.endTime && endTime > r.startTime
      )
      if (overlaps) return s
      // Clamp end to trimEnd
      const clampedEnd = Math.min(endTime, s.trimEnd)
      if (clampedEnd <= startTime + 0.2) return s

      const region: ZoomRegion = {
        id: nanoid(),
        startTime,
        endTime: clampedEnd,
        x, y,
        scale: 1.5,
        easing: 'ease-in-out'
      }
      const sorted = [...s.zoomRegions, region].sort((a, b) => a.startTime - b.startTime)
      return { ...s, zoomRegions: sorted, selectedId: region.id }
    })
  }

  /** Canvas click: create a 2-second region starting at `time` */
  const addZoomAtTime = useCallback((time: number, x = 0.5, y = 0.5) => {
    const s = stateRef.current
    const rawEnd = Math.min(time + 2, s.trimEnd)
    createRegion(time, rawEnd, x, y)
  }, [])

  /** Timeline drag: create a region spanning the dragged range */
  const addZoomRegion = useCallback((startTime: number, endTime: number) => {
    createRegion(startTime, endTime, 0.5, 0.5)
  }, [])

  const updateZoomRegion = useCallback((id: string, patch: Partial<ZoomRegion>) => {
    setState((s) => ({
      ...s,
      zoomRegions: s.zoomRegions.map((r) => (r.id === id ? { ...r, ...patch } : r))
    }))
  }, [])

  const removeZoomRegion = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      zoomRegions: s.zoomRegions.filter((r) => r.id !== id),
      selectedId: s.selectedId === id ? null : s.selectedId
    }))
  }, [])

  // ── Text annotations ──────────────────────────────────────────────────────

  const addTextAnnotation = useCallback((x: number, y: number, time: number) => {
    const s = stateRef.current
    const overlapping = s.textAnnotations.find((a) => a.startTime <= time && a.endTime >= time)
    if (overlapping) {
      setState((prev) => ({ ...prev, selectedId: overlapping.id }))
      return
    }
    const nextAnn = s.textAnnotations
      .filter((a) => a.startTime > time)
      .sort((a, b) => a.startTime - b.startTime)[0]
    const maxEnd = nextAnn ? nextAnn.startTime - 0.05 : s.trimEnd
    const ann: TextAnnotation = {
      id: nanoid(),
      text: 'Text',
      startTime: time,
      endTime: Math.min(time + 3, maxEnd),
      x, y,
      fontSize: 32,
      color: '#ffffff',
      bgColor: '#000000',
      bgEnabled: true,
      bold: false,
      align: 'center'
    }
    setState((prev) => ({ ...prev, textAnnotations: [...prev.textAnnotations, ann], selectedId: ann.id }))
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

      video.currentTime = st.trimStart
      await waitForSeek(video)

      const canvasStream = canvas.captureStream(fps)
      const codecCandidates = [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=avc1.42E01E',
        'video/mp4;codecs=avc1',
        'video/mp4;codecs=h264',
        'video/mp4',
        'video/webm;codecs=vp9',
        'video/webm;codecs=vp8',
        'video/webm'
      ]
      const mimeType = codecCandidates.find((c) => MediaRecorder.isTypeSupported(c)) ?? 'video/webm'
      const ext = mimeType.startsWith('video/mp4') ? 'mp4' : 'webm'
      const recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: bitrate })
      const chunks: Blob[] = []
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunks.push(e.data) }

      recorder.start()

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
        if (frameCount % 10 === 0) await new Promise<void>((r) => setTimeout(r, 0))
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
    addZoomAtTime, addZoomRegion, updateZoomRegion, removeZoomRegion,
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

/** Compute source crop rect for a given time, using zoom regions */
function computeZoomCrop(
  regions: ZoomRegion[],
  time: number,
  videoW: number,
  videoH: number
): { sx: number; sy: number; sw: number; sh: number } {
  const full = { sx: 0, sy: 0, sw: videoW, sh: videoH }
  if (regions.length === 0 || videoW === 0) return full

  const active = regions.find((r) => time >= r.startTime && time <= r.endTime)
  if (!active) return full

  const dur = active.endTime - active.startTime
  const ramp = Math.min(0.4, dur / 4)
  const t = time - active.startTime

  let zoom: number
  if (active.easing === 'linear') {
    if (t < ramp) {
      zoom = 1 + (active.scale - 1) * (t / ramp)
    } else if (t > dur - ramp) {
      zoom = 1 + (active.scale - 1) * ((dur - t) / ramp)
    } else {
      zoom = active.scale
    }
  } else {
    if (t < ramp) {
      zoom = 1 + (active.scale - 1) * smootherstep(t / ramp)
    } else if (t > dur - ramp) {
      zoom = 1 + (active.scale - 1) * smootherstep((dur - t) / ramp)
    } else {
      zoom = active.scale
    }
  }

  if (zoom <= 1.0) return full

  const sw = videoW / zoom
  const sh = videoH / zoom
  const sx = Math.max(0, Math.min(active.x * videoW - sw / 2, videoW - sw))
  const sy = Math.max(0, Math.min(active.y * videoH - sh / 2, videoH - sh))
  return { sx, sy, sw, sh }
}

function smootherstep(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return c * c * c * (c * (c * 6 - 15) + 10)
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
