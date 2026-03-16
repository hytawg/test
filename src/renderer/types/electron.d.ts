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
      onRemoteRegionMode: (cb: () => void) => void
      // Region picker overlay
      openRegionPicker: (bounds: { x: number; y: number; width: number; height: number }) => Promise<boolean>
      sendRegionPickerResult: (result: { x: number; y: number; w: number; h: number } | null) => void
      onRegionPickerResult: (cb: (result: { x: number; y: number; w: number; h: number } | null) => void) => void
      // Focus / click / key logs (auto-zoom + overlays)
      getFocusLog: () => Promise<import('./index').FocusLogRecord[]>
      getClickLog: () => Promise<import('./index').ClickEvent[]>
      getKeyLog:   () => Promise<import('./index').KeyEvent[]>
      // Video file import & recording history
      openFileByPath: (filePath: string) => Promise<{ fileName: string; filePath: string; buffer: ArrayBuffer } | null>
      getRecordingHistory: () => Promise<import('./index').RecordingHistoryEntry[]>
      addRecordingHistory: (entry: import('./index').RecordingHistoryEntry) => Promise<void>
      removeRecordingHistory: (id: string) => Promise<void>
    }
  }
}
