import { contextBridge, ipcRenderer } from 'electron'

const api = {
  getSources: () => ipcRenderer.invoke('get-sources'),
  saveRecording: (buffer: ArrayBuffer, format: string) =>
    ipcRenderer.invoke('save-recording', buffer, format),
  saveToDownloads: (buffer: ArrayBuffer, format: string) =>
    ipcRenderer.invoke('save-to-downloads', buffer, format),
  checkScreenPermission: (): Promise<string> => ipcRenderer.invoke('check-screen-permission'),
  getDisplayInfo: () => ipcRenderer.invoke('get-display-info'),
  // Chrome extension remote control
  onRemoteStart: (cb: () => void) => {
    ipcRenderer.on('remote:start', () => cb())
  },
  onRemoteStop: (cb: () => void) => {
    ipcRenderer.on('remote:stop', () => cb())
  },
  sendStatus: (status: { state: string; duration: number; countdown?: number }) => {
    ipcRenderer.send('remote:status-update', status)
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
