import { contextBridge, ipcRenderer } from 'electron'

const api = {
  getSources: () => ipcRenderer.invoke('get-sources'),
  saveRecording: (buffer: ArrayBuffer, format: string) =>
    ipcRenderer.invoke('save-recording', buffer, format),
  saveToDownloads: (buffer: ArrayBuffer, format: string) =>
    ipcRenderer.invoke('save-to-downloads', buffer, format),
  checkScreenPermission: (): Promise<string> => ipcRenderer.invoke('check-screen-permission'),
  getDisplayInfo: () => ipcRenderer.invoke('get-display-info'),

  // Main renderer → main process: report recording status
  sendRecordingStatus: (status: { state: string; duration: number; countdown: number; sourceName: string }) => {
    ipcRenderer.send('recording:status', status)
  },

  // Main renderer → listen for commands from control bar (each channel has at most one listener)
  onRemoteStart:  (cb: () => void) => { ipcRenderer.removeAllListeners('remote:start');  ipcRenderer.on('remote:start',  () => cb()) },
  onRemoteStop:   (cb: () => void) => { ipcRenderer.removeAllListeners('remote:stop');   ipcRenderer.on('remote:stop',   () => cb()) },
  onRemotePause:  (cb: () => void) => { ipcRenderer.removeAllListeners('remote:pause');  ipcRenderer.on('remote:pause',  () => cb()) },
  onRemoteResume: (cb: () => void) => { ipcRenderer.removeAllListeners('remote:resume'); ipcRenderer.on('remote:resume', () => cb()) },

  // Control bar → main process: send a command
  controlCommand: (cmd: string) => { ipcRenderer.send('control:command', cmd) },

  // Control bar → select a source (relayed to main renderer)
  setSource: (source: unknown) => { ipcRenderer.send('control:set-source', source) },

  // Control bar → resize its own window
  resizeControlBar: (height: number) => { ipcRenderer.send('control:resize', height) },

  // Control bar → listen for status broadcasts from main process
  onControlStatus: (cb: (status: { state: string; duration: number; countdown: number; sourceName: string }) => void) => {
    ipcRenderer.removeAllListeners('control:status')
    ipcRenderer.on('control:status', (_event, status) => cb(status))
  },

  // Main renderer → listen for source set from control bar
  onRemoteSetSource: (cb: (source: unknown) => void) => {
    ipcRenderer.removeAllListeners('remote:set-source')
    ipcRenderer.on('remote:set-source', (_event, source) => cb(source))
  },

  // Main renderer → listen for region-picker activation from control bar
  onRemoteRegionMode: (cb: () => void) => {
    ipcRenderer.removeAllListeners('remote:region-mode')
    ipcRenderer.on('remote:region-mode', () => cb())
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
