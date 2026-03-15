import { useEffect, useRef, useMemo } from 'react'
import type { CanvasSettings, CameraSettings, CaptureSource } from '../types'
import clsx from 'clsx'

type Props = {
  canvas: CanvasSettings
  camera: CameraSettings
  source: CaptureSource | null
  screenStream: MediaStream | null
  cameraStream: MediaStream | null
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

export function CanvasPreview({ canvas, camera, source, screenStream, cameraStream }: Props) {
  const screenVideoRef = useRef<HTMLVideoElement>(null)
  const cameraVideoRef = useRef<HTMLVideoElement>(null)

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
      case 'gradient': return { background: canvas.backgroundGradient }
      case 'solid':    return { background: canvas.backgroundColor }
      case 'blur':     return { background: '#1a1a1a', backdropFilter: 'blur(40px)' }
      case 'none':     return { background: 'transparent' }
    }
  }, [canvas.backgroundType, canvas.backgroundGradient, canvas.backgroundColor])

  const shadowStyle = useMemo((): React.CSSProperties => {
    if (!canvas.shadowEnabled) return {}
    const alpha = (canvas.shadowIntensity / 100) * 0.7
    return {
      boxShadow: `0 ${canvas.padding * 0.5}px ${canvas.padding * 1.5}px rgba(0,0,0,${alpha})`
    }
  }, [canvas.shadowEnabled, canvas.shadowIntensity, canvas.padding])

  const camPositionStyle = cameraPositionStyle(camera.position, camera.size)
  const camClip = cameraClipPath(camera.shape)

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
