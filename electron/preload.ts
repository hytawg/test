import { contextBridge, ipcRenderer } from 'electron'

export type CaptureSource = {
  id: string
  name: string
  thumbnailDataURL: string
  appIconDataURL: string | null
  display_id: string
}

export type DisplayInfo = {
  id: number
  label: string
  bounds: { x: number; y: number; width: number; height: number }
  scaleFactor: number
  isPrimary: boolean
}

const api = {
  getSources: (): Promise<CaptureSource[]> => ipcRenderer.invoke('get-sources'),
  saveRecording: (buffer: ArrayBuffer, format: string) =>
    ipcRenderer.invoke('save-recording', buffer, format),
  saveToDownloads: (buffer: ArrayBuffer, format: string) =>
    ipcRenderer.invoke('save-to-downloads', buffer, format),
  checkScreenPermission: (): Promise<string> => ipcRenderer.invoke('check-screen-permission'),
  getDisplayInfo: (): Promise<DisplayInfo[]> => ipcRenderer.invoke('get-display-info')
}

contextBridge.exposeInMainWorld('electronAPI', api)
