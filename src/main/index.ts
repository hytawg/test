import { app, BrowserWindow, ipcMain, desktopCapturer, dialog, screen, systemPreferences } from 'electron'
import { join } from 'path'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { is } from '@electron-toolkit/utils'

const HTTP_PORT = 7823

let mainWindow: BrowserWindow | null = null

// Recording status tracked by main process
let recordingStatus: { state: string; duration: number } = { state: 'idle', duration: 0 }

// ── HTTP server for Chrome extension ────────────────────────────────────────

function startHttpServer() {
  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    // CORS headers so Chrome extension can fetch
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Content-Type', 'application/json')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      res.end()
      return
    }

    const url = req.url ?? '/'

    // GET /status — return current recording state
    if (req.method === 'GET' && url === '/status') {
      res.writeHead(200)
      res.end(JSON.stringify({ ...recordingStatus, appRunning: true }))
      return
    }

    // POST /record/start
    if (req.method === 'POST' && url === '/record/start') {
      if (recordingStatus.state !== 'idle') {
        res.writeHead(409)
        res.end(JSON.stringify({ error: 'Already recording' }))
        return
      }
      mainWindow?.webContents.send('remote:start')
      res.writeHead(200)
      res.end(JSON.stringify({ ok: true }))
      return
    }

    // POST /record/stop
    if (req.method === 'POST' && url === '/record/stop') {
      if (recordingStatus.state !== 'recording' && recordingStatus.state !== 'paused') {
        res.writeHead(409)
        res.end(JSON.stringify({ error: 'Not recording' }))
        return
      }
      mainWindow?.webContents.send('remote:stop')
      res.writeHead(200)
      res.end(JSON.stringify({ ok: true }))
      return
    }

    // POST /record/toggle
    if (req.method === 'POST' && url === '/record/toggle') {
      if (recordingStatus.state === 'idle') {
        mainWindow?.webContents.send('remote:start')
      } else {
        mainWindow?.webContents.send('remote:stop')
      }
      res.writeHead(200)
      res.end(JSON.stringify({ ok: true, action: recordingStatus.state === 'idle' ? 'start' : 'stop' }))
      return
    }

    res.writeHead(404)
    res.end(JSON.stringify({ error: 'Not found' }))
  })

  server.listen(HTTP_PORT, '127.0.0.1', () => {
    console.log(`[ScreenStudio] HTTP server listening on http://127.0.0.1:${HTTP_PORT}`)
  })

  server.on('error', (err) => {
    console.error('[ScreenStudio] HTTP server error:', err)
  })
}

// Renderer reports recording status changes
ipcMain.on('remote:status-update', (_event, status: { state: string; duration: number }) => {
  recordingStatus = status
})

// ── Window ───────────────────────────────────────────────────────────────────

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
  startHttpServer()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
