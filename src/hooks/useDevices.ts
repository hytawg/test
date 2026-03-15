import { useState, useEffect } from 'react'

export type MediaDeviceInfo = {
  deviceId: string
  label: string
  kind: 'videoinput' | 'audioinput'
}

export function useDevices() {
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [microphones, setMicrophones] = useState<MediaDeviceInfo[]>([])

  const refreshDevices = async () => {
    try {
      // Request permission to enumerate devices
      await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).catch(() => {
        return navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null)
      })

      const devices = await navigator.mediaDevices.enumerateDevices()
      setCameras(
        devices
          .filter((d) => d.kind === 'videoinput')
          .map((d) => ({ deviceId: d.deviceId, label: d.label || `Camera ${d.deviceId.slice(0, 6)}`, kind: 'videoinput' as const }))
      )
      setMicrophones(
        devices
          .filter((d) => d.kind === 'audioinput')
          .map((d) => ({ deviceId: d.deviceId, label: d.label || `Mic ${d.deviceId.slice(0, 6)}`, kind: 'audioinput' as const }))
      )
    } catch {
      // permission denied
    }
  }

  useEffect(() => {
    refreshDevices()
    navigator.mediaDevices.addEventListener('devicechange', refreshDevices)
    return () => navigator.mediaDevices.removeEventListener('devicechange', refreshDevices)
  }, [])

  return { cameras, microphones, refreshDevices }
}
