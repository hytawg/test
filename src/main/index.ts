import { app, BrowserWindow, ipcMain, desktopCapturer, dialog, screen, systemPreferences } from 'electron'
import { join } from 'path'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { is } from '@electron-toolkit/utils'

let mainWindow: BrowserWindow | null = null
let controlBarWindow: BrowserWindow | null = null

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

// ── IPC: recording status from renderer → forward to control bar ──────────────

ipcMain.on('recording:status', (_event, status) => {
  controlBarWindow?.webContents.send('control:status', status)
})

// ── IPC: commands from control bar → forward to main renderer ─────────────────

ipcMain.on('control:command', (_event, cmd: string) => {
  switch (cmd) {
    case 'start':  mainWindow?.webContents.send('remote:start'); break
    case 'stop':   mainWindow?.webContents.send('remote:stop'); break
    case 'pause':  mainWindow?.webContents.send('remote:pause'); break
    case 'resume': mainWindow?.webContents.send('remote:resume'); break
    case 'show-main': mainWindow?.show(); mainWindow?.focus(); break
    case 'hide-bar': controlBarWindow?.hide(); break
    case 'show-bar': controlBarWindow?.show(); break
  }
})

// ── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 200 },
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

ipcMain.handle('get-display-info', () => {
  return screen.getAllDisplays().map((d) => ({
    id: d.id, label: `Display ${d.id}`,
    bounds: d.bounds, scaleFactor: d.scaleFactor,
    isPrimary: d.id === screen.getPrimaryDisplay().id
  }))
})

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  createWindow()
  createControlBarWindow()

  // Dock icon click: toggle main window
  app.on('activate', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.focus()
      } else {
        mainWindow.show()
      }
    } else {
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
