import { app, BrowserWindow, ipcMain, desktopCapturer, dialog, screen, systemPreferences } from 'electron'
import { join } from 'path'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { is } from '@electron-toolkit/utils'

let mainWindow: BrowserWindow | null = null

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

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// --- IPC Handlers ---

// Get all available capture sources (screens + windows)
ipcMain.handle('get-sources', async () => {
  const sources = await desktopCapturer.getSources({
    types: ['screen', 'window'],
    thumbnailSize: { width: 320, height: 200 },
    fetchWindowIcons: true
  })
  return sources.map((s) => ({
    id: s.id,
    name: s.name,
    thumbnailDataURL: s.thumbnail.toDataURL(),
    appIconDataURL: s.appIcon?.toDataURL() ?? null,
    display_id: s.display_id
  }))
})

// Show save dialog and write recording file
ipcMain.handle('save-recording', async (_event, buffer: ArrayBuffer, format: string) => {
  const ext = format === 'gif' ? 'gif' : 'mp4'
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: 'Save Recording',
    defaultPath: `ScreenStudio-${Date.now()}.${ext}`,
    filters: [
      { name: ext === 'mp4' ? 'MP4 Video' : 'GIF Image', extensions: [ext] }
    ]
  })
  if (result.canceled || !result.filePath) return { success: false }
  await writeFile(result.filePath, Buffer.from(buffer))
  return { success: true, filePath: result.filePath }
})

// Save recording to Downloads automatically
ipcMain.handle('save-to-downloads', async (_event, buffer: ArrayBuffer, format: string) => {
  const ext = format === 'gif' ? 'gif' : 'mp4'
  const downloadsPath = app.getPath('downloads')
  const filename = `ScreenStudio-${Date.now()}.${ext}`
  const filePath = join(downloadsPath, filename)
  if (!existsSync(downloadsPath)) {
    await mkdir(downloadsPath, { recursive: true })
  }
  await writeFile(filePath, Buffer.from(buffer))
  return { success: true, filePath }
})

// Check / request screen recording permission (macOS)
ipcMain.handle('check-screen-permission', async () => {
  if (process.platform !== 'darwin') return 'granted'
  const status = systemPreferences.getMediaAccessStatus('screen')
  return status
})

// Get primary display info
ipcMain.handle('get-display-info', () => {
  const displays = screen.getAllDisplays()
  return displays.map((d) => ({
    id: d.id,
    label: `Display ${d.id}`,
    bounds: d.bounds,
    scaleFactor: d.scaleFactor,
    isPrimary: d.id === screen.getPrimaryDisplay().id
  }))
})

// App lifecycle
app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
