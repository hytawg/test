import { app, BrowserWindow, ipcMain, desktopCapturer, dialog, screen, systemPreferences } from 'electron'
import { join, basename } from 'path'
import { writeFile, readFile, mkdir, unlink } from 'fs/promises'
import { existsSync } from 'fs'
import { is } from '@electron-toolkit/utils'
import { MouseTracker, FocusLogRecord, ClickEventRecord, KeyEventRecord } from './mouseTracker'
import Store from 'electron-store'
import { findFfmpegBin, buildFfmpegArgs, runFfmpeg, ScreenStudioOptions } from './ffmpegProcessor'

// ── Persistent storage ────────────────────────────────────────────────────────

type RecordingHistoryEntry = {
  id: string
  filePath: string
  fileName: string
  savedAt: number
  durationSec: number
  format: string
}

const store = new Store<{ recordingHistory: RecordingHistoryEntry[] }>()

let mainWindow: BrowserWindow | null = null
let controlBarWindow: BrowserWindow | null = null
let regionPickerWindow: BrowserWindow | null = null

// ── Mouse / focus tracking ─────────────────────────────────────────────────────

let mouseTracker: MouseTracker | null = null
let lastFocusLog: FocusLogRecord[] = []
let lastClickLog: ClickEventRecord[] = []
let lastKeyLog: KeyEventRecord[] = []

// ── Control bar window ────────────────────────────────────────────────────────

function createControlBarWindow() {
  const { bounds } = screen.getPrimaryDisplay()
  const BAR_W = 740
  const BAR_H = 64

  controlBarWindow = new BrowserWindow({
    width: BAR_W,
    height: BAR_H,
    x: Math.round(bounds.x + (bounds.width - BAR_W) / 2),
    y: bounds.y + 28, // just below macOS menu bar
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: true,
    resizable: false,
    movable: true,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  controlBarWindow.setAlwaysOnTop(true, 'floating')
  controlBarWindow.setVisibleOnAllWorkspaces(true)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    controlBarWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#control-bar')
  } else {
    controlBarWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'control-bar' })
  }
}

// ── Main window ───────────────────────────────────────────────────────────────

function createWindow(): void {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  mainWindow = new BrowserWindow({
    width: Math.min(1280, width - 40),
    height: Math.min(820, height - 40),
    minWidth: 960,
    minHeight: 640,
    show: false,
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 16, y: 16 },
    vibrancy: 'under-window',
    visualEffectState: 'active',
    backgroundColor: '#00000000',
    transparent: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow?.show())

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function sendToMain(channel: string, ...args: unknown[]) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, ...args)
}
function sendToBar(channel: string, ...args: unknown[]) {
  if (controlBarWindow && !controlBarWindow.isDestroyed()) controlBarWindow.webContents.send(channel, ...args)
}

// ── IPC: recording status from renderer → forward to control bar ──────────────

ipcMain.on('recording:status', (_event, status) => {
  sendToBar('control:status', status)
  // Start/stop mouse tracker in sync with recording state
  if (status.state === 'recording') {
    if (!mouseTracker) mouseTracker = new MouseTracker()
    mouseTracker.start()
  } else if (status.state === 'processing') {
    const result = mouseTracker?.stop() ?? { focusLog: [], clickLog: [], keyLog: [] }
    lastFocusLog = result.focusLog
    lastClickLog = result.clickLog
    lastKeyLog   = result.keyLog
  }
})

ipcMain.handle('get-focus-log', () => lastFocusLog)
ipcMain.handle('get-click-log', () => lastClickLog)
ipcMain.handle('get-key-log',   () => lastKeyLog)

// ── IPC: commands from control bar → forward to main renderer ─────────────────

ipcMain.on('control:command', (_event, cmd: string) => {
  switch (cmd) {
    case 'start':     sendToMain('remote:start'); break
    case 'stop':      sendToMain('remote:stop'); break
    case 'pause':     sendToMain('remote:pause'); break
    case 'resume':    sendToMain('remote:resume'); break
    case 'show-main': mainWindow?.show(); mainWindow?.focus(); break
    case 'hide-bar':  if (controlBarWindow && !controlBarWindow.isDestroyed()) controlBarWindow.hide(); break
    case 'show-bar':  if (controlBarWindow && !controlBarWindow.isDestroyed()) controlBarWindow.show(); break
    case 'region':
      // Do NOT force the main window to the front here. For screen sources the
      // region-picker overlay is a separate full-screen window so the main window
      // does not need to be visible. For window sources, App.tsx will show the
      // main window itself after receiving remote:region-mode.
      sendToMain('remote:region-mode')
      break
  }
})

// ── IPC: control bar selects a source → forward to main renderer ──────────────

ipcMain.on('control:set-source', (_event, source) => {
  sendToMain('remote:set-source', source)
})

// ── IPC: control bar resizes itself ───────────────────────────────────────────

ipcMain.on('control:resize', (_event, height: number) => {
  if (!controlBarWindow) return
  const { bounds } = screen.getPrimaryDisplay()
  const BAR_W = 740
  controlBarWindow.setSize(BAR_W, height)
  controlBarWindow.setPosition(
    Math.round(bounds.x + (bounds.width - BAR_W) / 2),
    bounds.y + 28
  )
})

// ── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 640, height: 400 },
    fetchWindowIcons: true
  })
  return sources.map((s) => ({
    id: s.id, name: s.name,
    thumbnailDataURL: s.thumbnail.toDataURL(),
    appIconDataURL: s.appIcon?.toDataURL() ?? null,
    display_id: s.display_id
  }))
})

ipcMain.handle('save-recording', async (_event, buffer: ArrayBuffer, format: string) => {
  const ext = format === 'gif' ? 'gif' : 'mp4'
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: 'Save Recording',
    defaultPath: `ScreenStudio-${Date.now()}.${ext}`,
    filters: [{ name: ext === 'mp4' ? 'MP4 Video' : 'GIF Image', extensions: [ext] }]
  })
  if (result.canceled || !result.filePath) return { success: false }
  await writeFile(result.filePath, Buffer.from(buffer))
  return { success: true, filePath: result.filePath }
})

ipcMain.handle('save-to-downloads', async (_event, buffer: ArrayBuffer, format: string) => {
  const ext = format === 'gif' ? 'gif' : 'mp4'
  const downloadsPath = app.getPath('downloads')
  const filename = `ScreenStudio-${Date.now()}.${ext}`
  const filePath = join(downloadsPath, filename)
  if (!existsSync(downloadsPath)) await mkdir(downloadsPath, { recursive: true })
  await writeFile(filePath, Buffer.from(buffer))
  return { success: true, filePath }
})

ipcMain.handle('check-screen-permission', async () => {
  if (process.platform !== 'darwin') return 'granted'
  return systemPreferences.getMediaAccessStatus('screen')
})

ipcMain.handle('open-region-picker', async (_event, bounds: { x: number; y: number; width: number; height: number }) => {
  if (regionPickerWindow && !regionPickerWindow.isDestroyed()) {
    regionPickerWindow.close()
    regionPickerWindow = null
  }
  regionPickerWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  regionPickerWindow.setAlwaysOnTop(true, 'screen-saver')
  regionPickerWindow.setVisibleOnAllWorkspaces(true)
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    regionPickerWindow.loadURL(process.env['ELECTRON_RENDERER_URL'] + '#region-picker')
  } else {
    regionPickerWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'region-picker' })
  }
  return true
})

ipcMain.on('region-picker:result', (_event, result) => {
  if (regionPickerWindow && !regionPickerWindow.isDestroyed()) {
    regionPickerWindow.close()
    regionPickerWindow = null
  }
  sendToMain('remote:region-picker-result', result)
})

ipcMain.handle('get-display-info', () => {
  return screen.getAllDisplays().map((d) => ({
    id: d.id, label: `Display ${d.id}`,
    bounds: d.bounds, scaleFactor: d.scaleFactor,
    isPrimary: d.id === screen.getPrimaryDisplay().id
  }))
})

// ── IPC: video file import & recording history ────────────────────────────────

ipcMain.handle('open-file-by-path', async (_event, filePath: string) => {
  if (!existsSync(filePath)) return null
  const nodeBuffer = await readFile(filePath)
  const arrayBuffer = new ArrayBuffer(nodeBuffer.byteLength)
  new Uint8Array(arrayBuffer).set(nodeBuffer)
  return { fileName: basename(filePath), filePath, buffer: arrayBuffer }
})

ipcMain.handle('get-recording-history', () => {
  return store.get('recordingHistory', [])
})

ipcMain.handle('add-recording-history', (_event, entry: RecordingHistoryEntry) => {
  const history = store.get('recordingHistory', [])
  store.set('recordingHistory', [entry, ...history].slice(0, 50))
})

ipcMain.handle('remove-recording-history', (_event, id: string) => {
  const history = store.get('recordingHistory', [])
  store.set('recordingHistory', history.filter((e) => e.id !== id))
})

// ── IPC: FFmpeg Screen Studio export ──────────────────────────────────────────

/** Check whether a usable FFmpeg binary exists. Returns the path or null. */
ipcMain.handle('ffmpeg-find', () => {
  const bin = findFfmpegBin()
  if (!bin || bin === 'ffmpeg') {
    // Verify the bare "ffmpeg" name is actually on PATH by checking common
    // locations — findFfmpegBin() returns 'ffmpeg' as a last resort even when
    // the binary may not be present.
    const pathCandidates = [
      '/opt/homebrew/bin/ffmpeg', '/usr/local/bin/ffmpeg', '/usr/bin/ffmpeg',
      'C:\\ffmpeg\\bin\\ffmpeg.exe',
    ]
    const found = pathCandidates.find(p => existsSync(p))
    return found ?? null   // null = not found
  }
  return bin
})

/**
 * Run the Screen Studio FFmpeg pipeline on a raw video blob.
 * Workflow:
 *   1. Write the incoming ArrayBuffer to a temp .mp4 in the OS temp dir
 *   2. Open a save-file dialog for the output path
 *   3. Spawn FFmpeg; stream progress back via 'ffmpeg-progress' IPC event
 *   4. Delete the temp file and return the result
 */
ipcMain.handle('ffmpeg-process', async (
  event,
  blobBuffer: ArrayBuffer,
  opts: Omit<ScreenStudioOptions, 'inputPath' | 'outputPath'>,
) => {
  const bin = findFfmpegBin()
  if (!bin) return { success: false, error: 'FFmpeg binary not found' }

  // ── Prompt user for output path ────────────────────────────────────────────
  const saveResult = await dialog.showSaveDialog(mainWindow!, {
    title: 'Save Screen Studio Export',
    defaultPath: `ScreenStudio-Export-${Date.now()}.mp4`,
    filters: [{ name: 'MP4 Video', extensions: ['mp4'] }],
  })
  if (saveResult.canceled || !saveResult.filePath) return { success: false, canceled: true }
  const outputPath = saveResult.filePath

  // ── Write raw recording to a temp file ────────────────────────────────────
  const tmpPath = join(app.getPath('temp'), `ss_raw_${Date.now()}.mp4`)
  await writeFile(tmpPath, Buffer.from(blobBuffer))

  const args = buildFfmpegArgs({ inputPath: tmpPath, outputPath, ...opts })

  return new Promise<{ success: boolean; error?: string; filePath?: string }>((resolve) => {
    const cancel = runFfmpeg(bin, args, {
      onProgress: (pct) => {
        if (!event.sender.isDestroyed()) event.sender.send('ffmpeg-progress', pct)
      },
      onDone: async (result) => {
        // Clean up temp file regardless of success
        unlink(tmpPath).catch(() => {})
        if (result.success) resolve({ success: true, filePath: outputPath })
        else resolve(result)
      },
    })
    // Kill FFmpeg if the renderer is destroyed before completion
    event.sender.once('destroyed', cancel)
  })
})

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow()
  createControlBarWindow()

  // Dock icon click: toggle main window
  app.on('activate', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isVisible()) {
        mainWindow.focus()
      } else {
        mainWindow.show()
      }
    } else {
      mainWindow = null
      createWindow()
    }
    // Always ensure control bar is visible
    if (!controlBarWindow || controlBarWindow.isDestroyed()) {
      createControlBarWindow()
    } else {
      controlBarWindow.show()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
