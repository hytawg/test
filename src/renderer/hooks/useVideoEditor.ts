import { useState, useRef, useCallback, useEffect } from 'react'
import { Muxer, ArrayBufferTarget } from 'mp4-muxer'
import type { EditState, ZoomRegion, TextAnnotation, CanvasSettings, SpeedSegment, FocusLogRecord, CutSegment } from '../types'
import { nanoid } from '../utils/nanoid'

type UseVideoEditorReturn = {
  state: EditState
  videoRef: React.RefObject<HTMLVideoElement>
  canvasRef: React.RefObject<HTMLCanvasElement>
  videoLoaded: boolean
  playing: boolean
  currentTime: number
  play: () => void
  pause: () => void
  seek: (t: number) => void
  setTrimStart: (t: number) => void
  setTrimEnd: (t: number) => void
  setActiveTool: (tool: EditState['activeTool']) => void
  setSelectedId: (id: string | null) => void
  updateCanvasSettings: (patch: Partial<CanvasSettings>) => void
  addZoomAtTime: (time: number, x?: number, y?: number) => void
  addZoomRegion: (startTime: number, endTime: number) => void
  updateZoomRegion: (id: string, patch: Partial<ZoomRegion>) => void
  removeZoomRegion: (id: string) => void
  addTextAnnotation: (x: number, y: number, time: number) => void
  updateTextAnnotation: (id: string, patch: Partial<TextAnnotation>) => void
  removeTextAnnotation: (id: string) => void
  addSpeedSegment: (startTime: number, endTime: number) => void
  updateSpeedSegment: (id: string, patch: Partial<SpeedSegment>) => void
  removeSpeedSegment: (id: string) => void
  addCutSegment: (startTime: number, endTime: number) => void
  updateCutSegment: (id: string, patch: Partial<CutSegment>) => void
  removeCutSegment: (id: string) => void
  exportVideo: (format: string, quality: string, fps: number, saveLocation: string) => Promise<void>
  exporting: boolean
  exportProgress: number
  setAutoZoomEnabled: (enabled: boolean) => void
}

// ── Done tone ─────────────────────────────────────────────────────────────────

function playDoneTone() {
  try {
    const ctx = new AudioContext()
    const play = (freq: number, start: number, dur: number, vol = 0.25) => {
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.type = 'sine'
      osc.frequency.setValueAtTime(freq, ctx.currentTime + start)
      gain.gain.setValueAtTime(vol, ctx.currentTime + start)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + start + dur)
      osc.start(ctx.currentTime + start); osc.stop(ctx.currentTime + start + dur)
    }
    play(784, 0, 0.12); play(659, 0.13, 0.12); play(523, 0.26, 0.22)
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

  // Cache for background image (when backgroundType === 'image')
  const bgImageRef = useRef<HTMLImageElement | null>(null)
  const bgImageSrcRef = useRef<string | null>(null)

  // ── Render ────────────────────────────────────────────────────────────────

  const renderFrame = useCallback((time: number) => {
    const canvas = canvasRef.current
    const video = videoRef.current
    if (!canvas || !video || video.videoWidth === 0) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const W = canvas.width
    const H = canvas.height
    const st = stateRef.current
    const cs = st.canvasSettings

    // Preload background image if needed
    const bgUrl = cs.backgroundImageDataUrl
    if (bgUrl && bgUrl !== bgImageSrcRef.current) {
      bgImageSrcRef.current = bgUrl
      const img = new Image(); img.src = bgUrl
      img.onload = () => { bgImageRef.current = img }
    } else if (!bgUrl) {
      bgImageRef.current = null; bgImageSrcRef.current = null
    }

    // Apply capture region first (defines the "full source" viewport)
    let vx0 = 0, vy0 = 0, vW = video.videoWidth, vH = video.videoHeight
    if (st.captureRegion) {
      vx0 = st.captureRegion.x * video.videoWidth
      vy0 = st.captureRegion.y * video.videoHeight
      vW = st.captureRegion.w * video.videoWidth
      vH = st.captureRegion.h * video.videoHeight
    }

    // Auto-zoom: focusLog overrides both captureRegion and zoomRegions
    let sx: number, sy: number, sw: number, sh: number
    if (st.autoZoomEnabled && st.focusLog && st.focusLog.length > 0) {
      const cam = interpolateFocusLog(st.focusLog, time)
      const fullW = video.videoWidth
      const fullH = video.videoHeight
      const cropW = fullW / cam.zoom
      const cropH = fullH / cam.zoom
      const rawX = cam.x * fullW - cropW / 2
      const rawY = cam.y * fullH - cropH / 2
      sx = Math.max(0, Math.min(fullW - cropW, rawX))
      sy = Math.max(0, Math.min(fullH - cropH, rawY))
      sw = cropW
      sh = cropH
    } else {
      // Apply zoom within the capture region
      const { sx: zsx, sy: zsy, sw: zsw, sh: zsh } = computeZoomCrop(st.zoomRegions, time, vW, vH)
      sx = vx0 + zsx
      sy = vy0 + zsy
      sw = zsw
      sh = zsh
    }

    ctx.clearRect(0, 0, W, H)

    // 1 — Background
    drawBackground(ctx, W, H, cs, video, sx, sy, sw, sh, bgImageRef.current)

    // 2 — Compute video destination (padded, aspect-ratio-correct)
    const pad = cs.padding
    const r = Math.min(cs.cornerRadius, pad)
    const areaW = W - pad * 2
    const areaH = H - pad * 2
    const videoAR = sw / sh
    const areaAR = areaW / areaH
    let vdx: number, vdy: number, vdw: number, vdh: number
    if (videoAR > areaAR) {
      vdw = areaW; vdh = areaW / videoAR
      vdx = pad;   vdy = pad + (areaH - vdh) / 2
    } else {
      vdh = areaH; vdw = areaH * videoAR
      vdy = pad;   vdx = pad + (areaW - vdw) / 2
    }

    // 3 — Drop shadow
    if (cs.shadowEnabled && r > 0) {
      const alpha = (cs.shadowIntensity / 100) * 0.7
      ctx.save()
      ctx.shadowColor = `rgba(0,0,0,${alpha})`
      ctx.shadowBlur = 30 + cs.shadowIntensity / 5
      ctx.shadowOffsetY = 6
      ctx.fillStyle = 'rgba(0,0,0,0.001)'
      roundedRectPath(ctx, vdx, vdy, vdw, vdh, r)
      ctx.fill()
      ctx.restore()
    }

    // 4 — Video (clipped to rounded rect)
    ctx.save()
    roundedRectPath(ctx, vdx, vdy, vdw, vdh, r)
    ctx.clip()
    ctx.drawImage(video, sx, sy, sw, sh, vdx, vdy, vdw, vdh)
    ctx.restore()

    // 5 — Text annotations (positioned over full canvas)
    const activeTexts = st.textAnnotations.filter(a => a.startTime <= time && a.endTime >= time)
    for (const ann of activeTexts) drawText(ctx, ann, W, H)

    // 6 — Cursor overlay (from focus log)
    if (st.focusLog && st.focusLog.length > 0) {
      const rec = interpolateFocusLog(st.focusLog, time)
      if (rec.mouseNormX !== null && rec.mouseNormY !== null) {
        const cursorVX = rec.mouseNormX * video.videoWidth
        const cursorVY = rec.mouseNormY * video.videoHeight
        drawCursorOverlay(ctx, cursorVX, cursorVY, sx, sy, sw, sh, vdx, vdy, vdw, vdh)
      }
    }
  }, [])

  // ── Playback ──────────────────────────────────────────────────────────────

  const tick = useCallback(() => {
    const video = videoRef.current; if (!video) return
    const t = video.currentTime

    // Skip cut segments during playback
    const cut = stateRef.current.cutSegments.find(c => t >= c.startTime && t < c.endTime)
    if (cut) {
      video.currentTime = cut.endTime
      const onSeeked = () => { video.removeEventListener('seeked', onSeeked); rafRef.current = requestAnimationFrame(tick) }
      video.addEventListener('seeked', onSeeked)
      return
    }

    // Adjust playback speed based on speed segments
    const speedSeg = stateRef.current.speedSegments.find(s => t >= s.startTime && t <= s.endTime)
    const targetRate = speedSeg ? speedSeg.speed : 1.0
    if (Math.abs(video.playbackRate - targetRate) > 0.01) {
      video.playbackRate = targetRate
    }

    setCurrentTime(t); renderFrame(t)
    if (t >= stateRef.current.trimEnd) {
      video.pause()
      video.playbackRate = 1.0
      setPlaying(false)
      return
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [renderFrame])

  const play = useCallback(() => {
    const video = videoRef.current; if (!video) return
    if (video.currentTime >= stateRef.current.trimEnd) video.currentTime = stateRef.current.trimStart
    video.play(); setPlaying(true)
    rafRef.current = requestAnimationFrame(tick)
  }, [tick])

  const pause = useCallback(() => {
    const video = videoRef.current
    if (video) { video.pause(); video.playbackRate = 1.0 }
    setPlaying(false)
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
  }, [])

  const seek = useCallback((t: number) => {
    const video = videoRef.current; if (!video) return
    const clamped = Math.max(stateRef.current.trimStart, Math.min(stateRef.current.trimEnd, t))
    video.currentTime = clamped; setCurrentTime(clamped)
    video.onseeked = () => renderFrame(clamped)
  }, [renderFrame])

  useEffect(() => {
    const video = videoRef.current; if (!video) return
    const onLoaded = () => {
      video.currentTime = stateRef.current.trimStart
      video.onseeked = () => renderFrame(stateRef.current.trimStart)
      setVideoLoaded(true); playDoneTone()
    }
    video.addEventListener('loadedmetadata', onLoaded)
    return () => video.removeEventListener('loadedmetadata', onLoaded)
  }, [renderFrame])

  useEffect(() => {
    if (!playing) renderFrame(currentTime)
  }, [state.zoomRegions, state.textAnnotations, state.canvasSettings, state.captureRegion, state.autoZoomEnabled, state.focusLog, playing, currentTime, renderFrame])

  // ── Edit actions ──────────────────────────────────────────────────────────

  const setTrimStart = useCallback((t: number) => setState(s => ({ ...s, trimStart: Math.min(t, s.trimEnd - 0.1) })), [])
  const setTrimEnd   = useCallback((t: number) => setState(s => ({ ...s, trimEnd:   Math.max(t, s.trimStart + 0.1) })), [])
  const setAutoZoomEnabled = useCallback((enabled: boolean) => setState(s => ({ ...s, autoZoomEnabled: enabled })), [])
  const setActiveTool = useCallback((tool: EditState['activeTool']) => setState(s => ({ ...s, activeTool: tool })), [])
  const setSelectedId = useCallback((id: string | null) => setState(s => ({ ...s, selectedId: id })), [])

  const updateCanvasSettings = useCallback((patch: Partial<CanvasSettings>) => {
    setState(s => ({ ...s, canvasSettings: { ...s.canvasSettings, ...patch } }))
  }, [])

  // ── Zoom regions ──────────────────────────────────────────────────────────

  const createRegion = (startTime: number, endTime: number, x: number, y: number) => {
    setState(s => {
      if (s.zoomRegions.some(r => startTime < r.endTime && endTime > r.startTime)) return s
      const clampedEnd = Math.min(endTime, s.trimEnd)
      if (clampedEnd <= startTime + 0.2) return s
      const region: ZoomRegion = { id: nanoid(), startTime, endTime: clampedEnd, x, y, scale: 1.5, easing: 'ease-in-out' }
      return { ...s, zoomRegions: [...s.zoomRegions, region].sort((a, b) => a.startTime - b.startTime), selectedId: region.id }
    })
  }

  const addZoomAtTime = useCallback((time: number, x = 0.5, y = 0.5) => {
    createRegion(time, Math.min(time + 2, stateRef.current.trimEnd), x, y)
  }, [])

  const addZoomRegion = useCallback((startTime: number, endTime: number) => {
    createRegion(startTime, endTime, 0.5, 0.5)
  }, [])

  const updateZoomRegion = useCallback((id: string, patch: Partial<ZoomRegion>) => {
    setState(s => ({ ...s, zoomRegions: s.zoomRegions.map(r => r.id === id ? { ...r, ...patch } : r) }))
  }, [])

  const removeZoomRegion = useCallback((id: string) => {
    setState(s => ({ ...s, zoomRegions: s.zoomRegions.filter(r => r.id !== id), selectedId: s.selectedId === id ? null : s.selectedId }))
  }, [])

  // ── Text annotations ──────────────────────────────────────────────────────

  const addTextAnnotation = useCallback((x: number, y: number, time: number) => {
    const s = stateRef.current
    const overlapping = s.textAnnotations.find(a => a.startTime <= time && a.endTime >= time)
    if (overlapping) { setState(prev => ({ ...prev, selectedId: overlapping.id })); return }
    const nextAnn = s.textAnnotations.filter(a => a.startTime > time).sort((a, b) => a.startTime - b.startTime)[0]
    const maxEnd = nextAnn ? nextAnn.startTime - 0.05 : s.trimEnd
    const ann: TextAnnotation = {
      id: nanoid(), text: 'Text', startTime: time, endTime: Math.min(time + 3, maxEnd),
      x, y, fontSize: 32, color: '#ffffff', bgColor: '#000000', bgEnabled: true, bold: false, align: 'center'
    }
    setState(prev => ({ ...prev, textAnnotations: [...prev.textAnnotations, ann], selectedId: ann.id }))
  }, [])

  const updateTextAnnotation = useCallback((id: string, patch: Partial<TextAnnotation>) => {
    setState(s => ({ ...s, textAnnotations: s.textAnnotations.map(a => a.id === id ? { ...a, ...patch } : a) }))
  }, [])

  const removeTextAnnotation = useCallback((id: string) => {
    setState(s => ({ ...s, textAnnotations: s.textAnnotations.filter(a => a.id !== id), selectedId: s.selectedId === id ? null : s.selectedId }))
  }, [])

  // ── Speed segments ────────────────────────────────────────────────────────

  const addSpeedSegment = useCallback((startTime: number, endTime: number) => {
    setState(s => {
      if (s.speedSegments.some(seg => startTime < seg.endTime && endTime > seg.startTime)) return s
      const clampedEnd = Math.min(endTime, s.trimEnd)
      if (clampedEnd <= startTime + 0.2) return s
      const seg: SpeedSegment = { id: nanoid(), startTime, endTime: clampedEnd, speed: 1.5 }
      return { ...s, speedSegments: [...s.speedSegments, seg].sort((a, b) => a.startTime - b.startTime), selectedId: seg.id, activeTool: 'speed' }
    })
  }, [])

  const updateSpeedSegment = useCallback((id: string, patch: Partial<SpeedSegment>) => {
    setState(s => ({ ...s, speedSegments: s.speedSegments.map(seg => seg.id === id ? { ...seg, ...patch } : seg) }))
  }, [])

  const removeSpeedSegment = useCallback((id: string) => {
    setState(s => ({ ...s, speedSegments: s.speedSegments.filter(seg => seg.id !== id), selectedId: s.selectedId === id ? null : s.selectedId }))
  }, [])

  // ── Cut segments ──────────────────────────────────────────────────────────

  const addCutSegment = useCallback((startTime: number, endTime: number) => {
    setState(s => {
      if (s.cutSegments.some(c => startTime < c.endTime && endTime > c.startTime)) return s
      const clampedEnd = Math.min(endTime, s.trimEnd)
      if (clampedEnd <= startTime + 0.1) return s
      const cut: CutSegment = { id: nanoid(), startTime: Math.max(startTime, s.trimStart), endTime: clampedEnd }
      return { ...s, cutSegments: [...s.cutSegments, cut].sort((a, b) => a.startTime - b.startTime), selectedId: cut.id }
    })
  }, [])

  const updateCutSegment = useCallback((id: string, patch: Partial<CutSegment>) => {
    setState(s => ({ ...s, cutSegments: s.cutSegments.map(c => c.id === id ? { ...c, ...patch } : c) }))
  }, [])

  const removeCutSegment = useCallback((id: string) => {
    setState(s => ({ ...s, cutSegments: s.cutSegments.filter(c => c.id !== id), selectedId: s.selectedId === id ? null : s.selectedId }))
  }, [])

  // ── Export (Web Codecs → H.264 MP4) ──────────────────────────────────────

  const exportVideo = useCallback(async (format: string, quality: string, fps: number, saveLocation: string) => {
    const video = videoRef.current; const canvas = canvasRef.current
    if (!video || !canvas) return
    // Stop playback and RAF loop before export to prevent tick() interference
    video.pause(); video.playbackRate = 1.0
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null }
    setPlaying(false)
    setExporting(true); setExportProgress(0)
    const st = stateRef.current
    const bitrate = quality === 'high' ? 8_000_000 : quality === 'medium' ? 4_000_000 : 2_000_000

    try {
      const buffer = await exportWithWebCodecs(canvas, video, st, fps, bitrate, renderFrame, setExportProgress)
      const ext = 'mp4'
      if (saveLocation === 'dialog') await window.electronAPI?.saveRecording(buffer, ext)
      else await window.electronAPI?.saveToDownloads(buffer, ext)
    } catch (err) {
      console.error('Web Codecs export failed, falling back to WebM:', err)
      await exportWithMediaRecorder(canvas, video, st, fps, bitrate, renderFrame, setExportProgress, saveLocation)
    }

    setExporting(false); setExportProgress(100)
  }, [renderFrame])

  useEffect(() => () => { if (rafRef.current) cancelAnimationFrame(rafRef.current) }, [])

  return {
    state, videoRef, canvasRef, videoLoaded,
    playing, currentTime, play, pause, seek,
    setTrimStart, setTrimEnd, setActiveTool, setSelectedId,
    updateCanvasSettings,
    addZoomAtTime, addZoomRegion, updateZoomRegion, removeZoomRegion,
    addTextAnnotation, updateTextAnnotation, removeTextAnnotation,
    addSpeedSegment, updateSpeedSegment, removeSpeedSegment,
    addCutSegment, updateCutSegment, removeCutSegment,
    exportVideo, exporting, exportProgress,
    setAutoZoomEnabled
  }
}

// ── Focus log interpolation ────────────────────────────────────────────────────

function interpolateFocusLog(log: FocusLogRecord[], videoTimeSec: number): { x: number; y: number; zoom: number; mouseNormX: number | null; mouseNormY: number | null } {
  const tMs = videoTimeSec * 1000
  const toResult = (rec: FocusLogRecord) => ({
    ...rec.camera,
    mouseNormX: rec.mouseNorm?.x ?? null,
    mouseNormY: rec.mouseNorm?.y ?? null,
  })
  if (tMs <= log[0].ts) return toResult(log[0])
  if (tMs >= log[log.length - 1].ts) return toResult(log[log.length - 1])

  // Binary search for bracketing records
  let lo = 0, hi = log.length - 1
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1
    if (log[mid].ts <= tMs) lo = mid
    else hi = mid
  }

  const a = log[lo], b = log[hi]
  const t = (tMs - a.ts) / (b.ts - a.ts)
  const hasMouse = a.mouseNorm && b.mouseNorm
  return {
    x:    a.camera.x    + (b.camera.x    - a.camera.x)    * t,
    y:    a.camera.y    + (b.camera.y    - a.camera.y)    * t,
    zoom: a.camera.zoom + (b.camera.zoom - a.camera.zoom) * t,
    mouseNormX: hasMouse ? (a.mouseNorm!.x + (b.mouseNorm!.x - a.mouseNorm!.x) * t) : null,
    mouseNormY: hasMouse ? (a.mouseNorm!.y + (b.mouseNorm!.y - a.mouseNorm!.y) * t) : null,
  }
}

// ── Speed helpers ──────────────────────────────────────────────────────────────

function getSpeedAt(t: number, segments: SpeedSegment[]): number {
  const seg = segments.find(s => t >= s.startTime && t <= s.endTime)
  return seg ? seg.speed : 1.0
}

// ─── Export: Web Codecs + mp4-muxer ──────────────────────────────────────────

async function exportWithWebCodecs(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  st: EditState,
  fps: number,
  bitrate: number,
  renderFrame: (t: number) => void,
  onProgress: (p: number) => void
): Promise<ArrayBuffer> {
  const W = canvas.width; const H = canvas.height
  const sourceDuration = st.trimEnd - st.trimStart

  const target = new ArrayBufferTarget()
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: W, height: H, frameRate: fps },
    fastStart: 'in-memory'
  })

  // Try H.264 High, fall back to Main, then Baseline
  const codecCandidates = ['avc1.640028', 'avc1.4D0028', 'avc1.42001E']
  let chosenCodec: string | null = null
  for (const c of codecCandidates) {
    const support = await VideoEncoder.isConfigSupported({ codec: c, width: W, height: H, bitrate, framerate: fps })
    if (support.supported) { chosenCodec = c; break }
  }
  if (!chosenCodec) throw new Error('H.264 VideoEncoder not supported')

  // Capture encoder errors so they propagate correctly out of the async callbacks
  let encoderError: Error | null = null
  const encoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => { encoderError = e }
  })
  encoder.configure({ codec: chosenCodec, width: W, height: H, bitrate, framerate: fps })

  const frameInterval = 1 / fps
  // Walk through source time; each output frame advances source by frameInterval * speed
  let srcT = st.trimStart
  let outT = 0  // output time in seconds
  let frameCount = 0

  while (srcT <= st.trimEnd + frameInterval / 2) {
    // Skip cut segments
    const cut = st.cutSegments.find(c => srcT >= c.startTime && srcT < c.endTime)
    if (cut) { srcT = cut.endTime; continue }

    const clampedT = Math.min(srcT, st.trimEnd)
    video.currentTime = clampedT
    await waitForSeek(video)
    renderFrame(clampedT)

    const timestampUs = Math.round(outT * 1_000_000)
    const frame = new VideoFrame(canvas, { timestamp: timestampUs, duration: Math.round(frameInterval * 1_000_000) })
    encoder.encode(frame, { keyFrame: frameCount % (fps * 2) === 0 })
    frame.close()

    onProgress(Math.min(99, ((srcT - st.trimStart) / sourceDuration) * 100))

    const speed = getSpeedAt(srcT, st.speedSegments)
    srcT += frameInterval * speed
    outT += frameInterval
    frameCount++
    if (frameCount % 10 === 0) await new Promise<void>(r => setTimeout(r, 0))
  }

  await encoder.flush()
  if (encoderError) throw encoderError
  muxer.finalize()
  return target.buffer
}

// ─── Export fallback: WebM via MediaRecorder ──────────────────────────────────

async function exportWithMediaRecorder(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  st: EditState,
  fps: number,
  bitrate: number,
  renderFrame: (t: number) => void,
  onProgress: (p: number) => void,
  saveLocation: string
) {
  const sourceDuration = st.trimEnd - st.trimStart
  video.currentTime = st.trimStart; await waitForSeek(video)

  const canvasStream = canvas.captureStream(fps)
  const mimeType = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
    .find(c => MediaRecorder.isTypeSupported(c)) ?? 'video/webm'
  const recorder = new MediaRecorder(canvasStream, { mimeType, videoBitsPerSecond: bitrate })
  const chunks: Blob[] = []
  recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) }
  recorder.start()

  const frameInterval = 1 / fps
  let srcT = st.trimStart; let fc = 0
  while (srcT <= st.trimEnd) {
    const cut = st.cutSegments.find(c => srcT >= c.startTime && srcT < c.endTime)
    if (cut) { srcT = cut.endTime; continue }
    video.currentTime = srcT; await waitForSeek(video); renderFrame(srcT)
    onProgress(Math.min(99, ((srcT - st.trimStart) / sourceDuration) * 100))
    const speed = getSpeedAt(srcT, st.speedSegments)
    srcT += frameInterval * speed; fc++
    if (fc % 10 === 0) await new Promise<void>(r => setTimeout(r, 0))
  }

  recorder.stop()
  await new Promise<void>(r => { recorder.onstop = () => r() })

  const blob = new Blob(chunks, { type: mimeType })
  const buffer = await blob.arrayBuffer()
  if (saveLocation === 'dialog') await window.electronAPI?.saveRecording(buffer, 'webm')
  else await window.electronAPI?.saveToDownloads(buffer, 'webm')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function waitForSeek(video: HTMLVideoElement): Promise<void> {
  return new Promise<void>(resolve => {
    if (!video.seeking) { resolve(); return }
    const onSeeked = () => { video.removeEventListener('seeked', onSeeked); resolve() }
    video.addEventListener('seeked', onSeeked)
  })
}

/** Compute zoom crop rect in video space (relative to captureRegion or full video) */
function computeZoomCrop(regions: ZoomRegion[], time: number, videoW: number, videoH: number) {
  const full = { sx: 0, sy: 0, sw: videoW, sh: videoH }
  if (!regions.length || !videoW) return full
  const active = regions.find(r => time >= r.startTime && time <= r.endTime)
  if (!active) return full

  const dur = active.endTime - active.startTime
  const ramp = Math.min(0.4, dur / 4)
  const t = time - active.startTime
  let zoom: number

  const ease = active.easing === 'ease-in-out' ? smootherstep : (x: number) => x
  if (t < ramp)          zoom = 1 + (active.scale - 1) * ease(t / ramp)
  else if (t > dur - ramp) zoom = 1 + (active.scale - 1) * ease((dur - t) / ramp)
  else                   zoom = active.scale

  if (zoom <= 1) return full
  const sw = videoW / zoom; const sh = videoH / zoom
  const sx = Math.max(0, Math.min(active.x * videoW - sw / 2, videoW - sw))
  const sy = Math.max(0, Math.min(active.y * videoH - sh / 2, videoH - sh))
  return { sx, sy, sw, sh }
}

function smootherstep(t: number): number {
  const c = Math.max(0, Math.min(1, t))
  return c * c * c * (c * (c * 6 - 15) + 10)
}

/** Draw canvas background according to CanvasSettings */
function drawBackground(
  ctx: CanvasRenderingContext2D, W: number, H: number, cs: CanvasSettings,
  video: HTMLVideoElement, sx: number, sy: number, sw: number, sh: number,
  bgImage: HTMLImageElement | null
) {
  if (cs.backgroundType === 'none') {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); return
  }
  if (cs.backgroundType === 'solid') {
    ctx.fillStyle = cs.backgroundColor; ctx.fillRect(0, 0, W, H); return
  }
  if (cs.backgroundType === 'gradient') {
    fillGradient(ctx, W, H, cs.backgroundGradient); return
  }
  if (cs.backgroundType === 'wallpaper') {
    fillGradient(ctx, W, H, cs.backgroundWallpaper); return
  }
  if (cs.backgroundType === 'blur') {
    ctx.save()
    ctx.filter = 'blur(28px) brightness(0.55) saturate(1.3)'
    ctx.drawImage(video, sx, sy, sw, sh, -32, -32, W + 64, H + 64)
    ctx.restore()
    return
  }
  if (cs.backgroundType === 'image' && bgImage) {
    const imgAR = bgImage.width / bgImage.height; const canvasAR = W / H
    let ix = 0, iy = 0, iw = W, ih = H
    if (imgAR > canvasAR) { ih = H; iw = H * imgAR; ix = (W - iw) / 2 }
    else { iw = W; ih = W / imgAR; iy = (H - ih) / 2 }
    ctx.drawImage(bgImage, ix, iy, iw, ih); return
  }
  ctx.fillStyle = '#0d0d0d'; ctx.fillRect(0, 0, W, H)
}

/** Parse and apply a CSS linear/radial gradient string to canvas */
function fillGradient(ctx: CanvasRenderingContext2D, W: number, H: number, cssGrad: string) {
  const linMatch = cssGrad.match(/linear-gradient\(\s*(\d+(?:\.\d+)?)deg\s*,\s*(.+)\)/)
  if (linMatch) {
    const angleRad = parseFloat(linMatch[1]) * Math.PI / 180
    const len = Math.sqrt(W * W + H * H)
    const cx = W / 2; const cy = H / 2
    const x1 = cx - Math.sin(angleRad) * len / 2; const y1 = cy + Math.cos(angleRad) * len / 2
    const x2 = cx + Math.sin(angleRad) * len / 2; const y2 = cy - Math.cos(angleRad) * len / 2
    const grad = ctx.createLinearGradient(x1, y1, x2, y2)
    for (const stop of parseStops(linMatch[2])) grad.addColorStop(stop.pos, stop.color)
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H); return
  }
  const radMatch = cssGrad.match(/radial-gradient\(\s*ellipse at\s+(.+?)\s*,\s*(.+)\)/)
  if (radMatch) {
    const parts = radMatch[1].trim().split(/\s+/)
    const cx = parseFloat(parts[0]) / 100 * W
    const cy = parseFloat(parts[1]) / 100 * H
    const maxR = Math.sqrt(W * W + H * H)
    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, maxR)
    for (const stop of parseStops(radMatch[2])) grad.addColorStop(stop.pos, stop.color)
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H); return
  }
  ctx.fillStyle = '#1a1a2e'; ctx.fillRect(0, 0, W, H)
}

function parseStops(s: string): { pos: number; color: string }[] {
  const stops: { pos: number; color: string }[] = []
  // Match: #hex or rgb() or rgba(), followed by optional percentage
  const re = /(#[0-9a-fA-F]{3,8}|rgba?\([^)]+\))\s+(\d+(?:\.\d+)?)%/g
  let m: RegExpExecArray | null
  while ((m = re.exec(s)) !== null) stops.push({ color: m[1], pos: parseFloat(m[2]) / 100 })
  return stops
}

function roundedRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const clampedR = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + clampedR, y)
  ctx.lineTo(x + w - clampedR, y); ctx.arcTo(x + w, y, x + w, y + clampedR, clampedR)
  ctx.lineTo(x + w, y + h - clampedR); ctx.arcTo(x + w, y + h, x + w - clampedR, y + h, clampedR)
  ctx.lineTo(x + clampedR, y + h); ctx.arcTo(x, y + h, x, y + h - clampedR, clampedR)
  ctx.lineTo(x, y + clampedR); ctx.arcTo(x, y, x + clampedR, y, clampedR)
  ctx.closePath()
}

/** Draw a cursor dot overlay in canvas coordinates */
function drawCursorOverlay(
  ctx: CanvasRenderingContext2D,
  cursorVX: number, cursorVY: number,
  sx: number, sy: number, sw: number, sh: number,
  vdx: number, vdy: number, vdw: number, vdh: number
) {
  // Map from video physical pixel space → canvas destination space
  const crX = (cursorVX - sx) / sw
  const crY = (cursorVY - sy) / sh
  if (crX < 0 || crX > 1 || crY < 0 || crY > 1) return
  const cx = vdx + crX * vdw
  const cy = vdy + crY * vdh

  ctx.save()
  // Outer glow
  ctx.shadowColor = 'rgba(0,0,0,0.55)'
  ctx.shadowBlur = 12
  // White circle
  ctx.beginPath()
  ctx.arc(cx, cy, 10, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.fill()
  ctx.shadowBlur = 0
  // Dark ring
  ctx.strokeStyle = 'rgba(0,0,0,0.25)'
  ctx.lineWidth = 1.5
  ctx.stroke()
  // Inner dot
  ctx.beginPath()
  ctx.arc(cx, cy, 3, 0, Math.PI * 2)
  ctx.fillStyle = 'rgba(0,0,0,0.4)'
  ctx.fill()
  ctx.restore()
}

function drawText(ctx: CanvasRenderingContext2D, ann: TextAnnotation, W: number, H: number) {
  const x = ann.x * W; const y = ann.y * H; const fs = ann.fontSize
  ctx.font = `${ann.bold ? 'bold ' : ''}${fs}px -apple-system, sans-serif`
  ctx.textAlign = ann.align; ctx.textBaseline = 'middle'
  const tw = ctx.measureText(ann.text).width; const th = fs * 1.4
  if (ann.bgEnabled) {
    const pad = fs * 0.3
    ctx.fillStyle = ann.bgColor + 'cc'
    ctx.beginPath()
    const rx = ann.align === 'center' ? x - tw / 2 - pad : ann.align === 'right' ? x - tw - pad : x - pad
    roundedRectPath(ctx, rx, y - th / 2 - pad / 2, tw + pad * 2, th + pad, 6)
    ctx.fill()
  }
  ctx.fillStyle = ann.color; ctx.fillText(ann.text, x, y)
}
