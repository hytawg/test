import type { CaptureSource, DisplayInfo } from './index'

export {}

type RecordingStatus = { state: string; duration: number; countdown: number; sourceName: string }

declare global {
  interface Window {
    electronAPI?: {
      getSources: () => Promise<CaptureSource[]>
      saveRecording: (buffer: ArrayBuffer, format: string) => Promise<{ success: boolean; filePath?: string }>
      saveToDownloads: (buffer: ArrayBuffer, format: string) => Promise<{ success: boolean; filePath?: string }>
      checkScreenPermission: () => Promise<string>
      getDisplayInfo: () => Promise<DisplayInfo[]>
      // Control bar ↔ main renderer communication
      sendRecordingStatus: (status: RecordingStatus) => void
      onRemoteStart:  (cb: () => void) => void
      onRemoteStop:   (cb: () => void) => void
      onRemotePause:  (cb: () => void) => void
      onRemoteResume: (cb: () => void) => void
      // Control bar window
      controlCommand:    (cmd: string) => void
      setSource:         (source: unknown) => void
      resizeControlBar:  (height: number) => void
      onControlStatus:   (cb: (status: RecordingStatus) => void) => void
      onRemoteSetSource: (cb: (source: unknown) => void) => void
    }
  }
}
