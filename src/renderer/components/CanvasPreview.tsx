import { useEffect, useRef, useMemo, useState, useCallback } from 'react'
import type { CanvasSettings, CameraSettings, CaptureSource, CaptureRegion } from '../types'
import clsx from 'clsx'
import { Crop, X } from 'lucide-react'

type Props = {
  canvas: CanvasSettings
  camera: CameraSettings
  source: CaptureSource | null
  screenStream: MediaStream | null
  cameraStream: MediaStream | null
  captureRegion: CaptureRegion | null
  onRegionChange: (region: CaptureRegion | null) => void
  /** When toggled to true from outside, activate the in-app region picker (window sources) */
  externalPickerActive?: boolean
  onExternalPickerDone?: () => void
  /** Called when the user clicks "範囲を指定" — App decides overlay vs in-app */
  onStartRegionPicker?: () => void
}

// Returns the CSS aspect-ratio value
function aspectRatioCSS(ar: CanvasSettings['aspectRatio']): string {
  switch (ar) {
    case '16:9': return '16 / 9'
    case '4:3': return '4 / 3'
    case '1:1': return '1 / 1'
    case '9:16': return '9 / 16'
    case 'fill': return 'auto'
  }
}

function cameraPositionStyle(
  pos: CameraSettings['position'],
  size: number
): React.CSSProperties {
  const gap = 12 // px
  switch (pos) {
    case 'top-left':    return { top: gap, left: gap }
    case 'top-right':   return { top: gap, right: gap }
    case 'bottom-left': return { bottom: gap, left: gap }
    case 'bottom-right':
    default:            return { bottom: gap, right: gap }
  }
}

function cameraClipPath(shape: CameraSettings['shape']): string {
  switch (shape) {
    case 'circle': return 'circle(50%)'
    case 'rounded': return 'inset(0% round 16%)'
    case 'square': return 'inset(0%)'
  }
}

export function CanvasPreview({ canvas, camera, source, screenStream, cameraStream, captureRegion, onRegionChange, externalPickerActive, onExternalPickerDone, onStartRegionPicker }: Props) {
  const screenVideoRef = useRef<HTMLVideoElement>(null)
  const cameraVideoRef = useRef<HTMLVideoElement>(null)
  const innerRef = useRef<HTMLDivElement>(null)

  const [isSelectingRegion, setIsSelectingRegion] = useState(false)
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null)
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null)

  // Activate picker when triggered from outside (e.g. ControlBar)
  useEffect(() => {
    if (externalPickerActive && source) {
      setIsSelectingRegion(true)
      setDragStart(null)
      setDragCurrent(null)
      onExternalPickerDone?.()
    }
  }, [externalPickerActive, source, onExternalPickerDone])

  // Attach screen stream
  useEffect(() => {
    if (!screenVideoRef.current) return
    if (screenStream) {
      screenVideoRef.current.srcObject = screenStream
      screenVideoRef.current.play().catch(() => {})
    } else {
      screenVideoRef.current.srcObject = null
    }
  }, [screenStream])

  // Attach camera stream
  useEffect(() => {
    if (!cameraVideoRef.current) return
    if (cameraStream) {
      cameraVideoRef.current.srcObject = cameraStream
      cameraVideoRef.current.play().catch(() => {})
    } else {
      cameraVideoRef.current.srcObject = null
    }
  }, [cameraStream])

  const background = useMemo((): React.CSSProperties => {
    switch (canvas.backgroundType) {
      case 'gradient':  return { background: canvas.backgroundGradient }
      case 'wallpaper': return { background: canvas.backgroundWallpaper }
      case 'solid':     return { background: canvas.backgroundColor }
      case 'image':     return canvas.backgroundImageDataUrl
        ? { backgroundImage: `url(${canvas.backgroundImageDataUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' }
        : { background: '#1a1a1a' }
      case 'blur':      return { background: '#1a1a1a', backdropFilter: 'blur(40px)' }
      case 'none':      return { background: 'transparent' }
    }
  }, [canvas.backgroundType, canvas.backgroundGradient, canvas.backgroundWallpaper, canvas.backgroundColor, canvas.backgroundImageDataUrl])

  const shadowStyle = useMemo((): React.CSSProperties => {
    if (!canvas.shadowEnabled) return {}
    const alpha = (canvas.shadowIntensity / 100) * 0.7
    return {
      boxShadow: `0 ${canvas.padding * 0.5}px ${canvas.padding * 1.5}px rgba(0,0,0,${alpha})`
    }
  }, [canvas.shadowEnabled, canvas.shadowIntensity, canvas.padding])

  const camPositionStyle = cameraPositionStyle(camera.position, camera.size)
  const camClip = cameraClipPath(camera.shape)

  // Region picker helpers
  const getNormalized = useCallback((clientX: number, clientY: number) => {
    const el = innerRef.current
    if (!el) return { x: 0, y: 0 }
    const rect = el.getBoundingClientRect()
    return {
      x: Math.max(0, Math.min(1, (clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (clientY - rect.top) / rect.height))
    }
  }, [])

  const handleInnerMouseDown = useCallback((e: React.MouseEvent) => {
    if (!isSelectingRegion) return
    e.preventDefault()
    const pos = getNormalized(e.clientX, e.clientY)
    setDragStart(pos)
    setDragCurrent(pos)

    const move = (ev: MouseEvent) => {
      setDragCurrent(getNormalized(ev.clientX, ev.clientY))
    }
    const up = (ev: MouseEvent) => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
      const end = getNormalized(ev.clientX, ev.clientY)
      const x = Math.min(pos.x, end.x)
      const y = Math.min(pos.y, end.y)
      const w = Math.abs(end.x - pos.x)
      const h = Math.abs(end.y - pos.y)
      if (w > 0.02 && h > 0.02) {
        onRegionChange({ x, y, w, h })
      }
      setDragStart(null)
      setDragCurrent(null)
      setIsSelectingRegion(false)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }, [isSelectingRegion, getNormalized, onRegionChange])

  // Preview drag rectangle
  const dragRect = useMemo(() => {
    if (!dragStart || !dragCurrent) return null
    return {
      left: `${Math.min(dragStart.x, dragCurrent.x) * 100}%`,
      top: `${Math.min(dragStart.y, dragCurrent.y) * 100}%`,
      width: `${Math.abs(dragCurrent.x - dragStart.x) * 100}%`,
      height: `${Math.abs(dragCurrent.y - dragStart.y) * 100}%`,
    }
  }, [dragStart, dragCurrent])

  return (
    <div className="flex-1 flex items-center justify-center p-8 bg-[#0d0d0d] min-h-0 relative overflow-hidden">
      {/* Subtle grid bg */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
          backgroundSize: '32px 32px'
        }}
      />

      {/* Region picker / clear buttons */}
      {source && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 z-20">
          {captureRegion && (
            <button
              onClick={() => onRegionChange(null)}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[10px] font-medium transition-all"
            >
              <X size={11} />
              範囲解除
            </button>
          )}
          <button
            onClick={() => {
              if (onStartRegionPicker) {
                onStartRegionPicker()
              } else {
                setIsSelectingRegion(v => !v); setDragStart(null); setDragCurrent(null)
              }
            }}
            className={clsx(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all',
              isSelectingRegion
                ? 'bg-purple-500/30 text-purple-300 ring-1 ring-purple-400/40'
                : 'bg-white/5 hover:bg-white/10 text-white/50 hover:text-white/80'
            )}
          >
            <Crop size={11} />
            {isSelectingRegion ? 'ドラッグで選択' : '範囲を指定'}
          </button>
        </div>
      )}

      {/* Canvas wrapper */}
      <div
        className="relative w-full max-w-3xl"
        style={{ aspectRatio: aspectRatioCSS(canvas.aspectRatio) }}
      >
        {/* Outer background layer */}
        <div
          className="absolute inset-0 rounded-2xl overflow-hidden"
          style={background}
        >
          {/* Inner screen frame */}
          {canvas.backgroundType !== 'none' ? (
            <div
              className="absolute overflow-hidden"
              style={{
                inset: canvas.padding,
                borderRadius: canvas.cornerRadius,
                ...shadowStyle
              }}
            >
              <ScreenContent
                source={source}
                screenStream={screenStream}
                videoRef={screenVideoRef}
              />
            </div>
          ) : (
            <ScreenContent
              source={source}
              screenStream={screenStream}
              videoRef={screenVideoRef}
              style={{ position: 'absolute', inset: 0 }}
            />
          )}

          {/* Camera overlay */}
          {camera.enabled && (
            <div
              className="absolute z-10"
              style={{
                ...camPositionStyle,
                width: `${camera.size}%`,
                aspectRatio: '1 / 1'
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  clipPath: camClip,
                  border: camera.borderEnabled
                    ? `${camera.borderWidth}px solid ${camera.borderColor}`
                    : 'none',
                  overflow: 'hidden',
                  position: 'relative'
                }}
              >
                {cameraStream ? (
                  <video
                    ref={cameraVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                    style={{ transform: camera.mirrorEnabled ? 'scaleX(-1)' : 'none' }}
                  />
                ) : (
                  <div className="w-full h-full bg-surface-800 flex items-center justify-center">
                    <span className="text-white/20 text-xs">No camera</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Region picker overlay (over entire canvas area) */}
        <div
          ref={innerRef}
          className={clsx(
            'absolute inset-0 rounded-2xl z-10',
            isSelectingRegion ? 'cursor-crosshair' : 'pointer-events-none'
          )}
          onMouseDown={handleInnerMouseDown}
        >
          {/* Drag preview */}
          {dragRect && (
            <div
              className="absolute border-2 border-dashed border-purple-400 bg-purple-400/10 pointer-events-none"
              style={dragRect}
            />
          )}

          {/* Committed capture region overlay */}
          {captureRegion && !isSelectingRegion && (
            <>
              {/* Dim outside region */}
              <div className="absolute inset-0 bg-black/50 pointer-events-none" style={{
                clipPath: `polygon(
                  0% 0%, 100% 0%, 100% 100%, 0% 100%,
                  0% ${captureRegion.y * 100}%,
                  ${captureRegion.x * 100}% ${captureRegion.y * 100}%,
                  ${captureRegion.x * 100}% ${(captureRegion.y + captureRegion.h) * 100}%,
                  ${(captureRegion.x + captureRegion.w) * 100}% ${(captureRegion.y + captureRegion.h) * 100}%,
                  ${(captureRegion.x + captureRegion.w) * 100}% ${captureRegion.y * 100}%,
                  0% ${captureRegion.y * 100}%
                )`
              }} />
              {/* Region border */}
              <div className="absolute border-2 border-purple-400/80 pointer-events-none" style={{
                left: `${captureRegion.x * 100}%`,
                top: `${captureRegion.y * 100}%`,
                width: `${captureRegion.w * 100}%`,
                height: `${captureRegion.h * 100}%`,
              }} />
              <div className="absolute flex items-center gap-1 px-1.5 py-0.5 bg-purple-500 text-white text-[9px] font-medium rounded pointer-events-none" style={{
                left: `${captureRegion.x * 100}%`,
                top: `${captureRegion.y * 100}%`,
                transform: 'translateY(-100%)'
              }}>
                <Crop size={8} />
                収録範囲
              </div>
            </>
          )}
        </div>
      </div>

      {/* Empty state */}
      {!source && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-white/5 flex items-center justify-center mx-auto mb-3">
              <span className="text-3xl">🖥️</span>
            </div>
            <p className="text-white/40 text-sm font-medium">Select a capture source</p>
            <p className="text-white/20 text-xs mt-1">Choose a display or window from the Source panel</p>
          </div>
        </div>
      )}
    </div>
  )
}

function ScreenContent({
  source,
  screenStream,
  videoRef,
  style
}: {
  source: CaptureSource | null
  screenStream: MediaStream | null
  videoRef: React.RefObject<HTMLVideoElement>
  style?: React.CSSProperties
}) {
  return (
    <div
      className="w-full h-full bg-surface-900"
      style={style}
    >
      {screenStream ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />
      ) : source ? (
        // Show thumbnail as placeholder
        <img
          src={source.thumbnailDataURL}
          alt={source.name}
          className="w-full h-full object-cover opacity-60"
        />
      ) : null}
    </div>
  )
}
