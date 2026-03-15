import { contextBridge, ipcRenderer } from 'electron'

const api = {
  getSources: () => ipcRenderer.invoke('get-sources'),
  saveRecording: (buffer: ArrayBuffer, format: string) =>
    ipcRenderer.invoke('save-recording', buffer, format),
  saveToDownloads: (buffer: ArrayBuffer, format: string) =>
    ipcRenderer.invoke('save-to-downloads', buffer, format),
  checkScreenPermission: (): Promise<string> => ipcRenderer.invoke('check-screen-permission'),
  getDisplayInfo: () => ipcRenderer.invoke('get-display-info')
}

contextBridge.exposeInMainWorld('electronAPI', api)
