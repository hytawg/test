import type { CaptureSource, DisplayInfo } from './index'

export {}

declare global {
  interface Window {
    electronAPI?: {
      getSources: () => Promise<CaptureSource[]>
      saveRecording: (buffer: ArrayBuffer, format: string) => Promise<{ success: boolean; filePath?: string }>
      saveToDownloads: (buffer: ArrayBuffer, format: string) => Promise<{ success: boolean; filePath?: string }>
      checkScreenPermission: () => Promise<string>
      getDisplayInfo: () => Promise<DisplayInfo[]>
    }
  }
}
