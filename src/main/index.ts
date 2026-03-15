import { app, BrowserWindow, ipcMain, desktopCapturer, dialog, screen, systemPreferences } from 'electron'
import { join } from 'path'
import { writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { is } from '@electron-toolkit/utils'

const HTTP_PORT = 7823

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null

// Recording status tracked by main process
let recordingStatus: { state: string; duration: number; countdown: number } = { state: 'idle', duration: 0, countdown: 0 }

// Click effect setting
let clickEffect = 'ripple'

// ── Overlay window for click effects ────────────────────────────────────────

const OVERLAY_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
*{margin:0;padding:0;box-sizing:border-box}
html,body{width:100vw;height:100vh;overflow:hidden;background:transparent}
.fx{position:fixed;pointer-events:none;transform:translate(-50%,-50%);border-radius:50%}
.fx-ripple{border:3px solid rgba(255,255,255,0.9);animation:rpl 0.65s ease-out forwards}
@keyframes rpl{0%{width:0;height:0;opacity:0.9}100%{width:88px;height:88px;opacity:0}}
.fx-spotlight{background:radial-gradient(circle,rgba(255,230,50,0.55) 0%,transparent 70%);animation:spl 0.6s ease-out forwards}
@keyframes spl{0%{width:0;height:0;opacity:1}100%{width:140px;height:140px;opacity:0}}
.fx-dot{background:rgba(255,200,0,1);box-shadow:0 0 14px rgba(255,210,0,0.9);animation:dot 0.5s ease-out forwards}
@keyframes dot{0%{width:14px;height:14px;opacity:1}100%{width:46px;height:46px;opacity:0}}
.fx-ring{border:4px solid rgba(80,200,255,0.9);animation:ring 0.8s ease-out forwards}
@keyframes ring{0%{width:8px;height:8px;opacity:1}100%{width:104px;height:104px;opacity:0}}
</style></head><body><script>
function showEffect(x,y,type){
  if(!type||type==='none')return;
  var el=document.createElement('div');
  el.className='fx fx-'+type;
  el.style.left=x+'px';el.style.top=y+'px';
  document.body.appendChild(el);
  setTimeout(function(){el.remove()},1000);
}
</script></body></html>`

function createOverlayWindow() {
  const { bounds } = screen.getPrimaryDisplay()
  overlayWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width,
    height: bounds.height,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    focusable: false,
    show: false,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: false,
      sandbox: false
    }
  })
  overlayWindow.setIgnoreMouseEvents(true)
  overlayWindow.setAlwaysOnTop(true, 'screen-saver')
  overlayWindow.setVisibleOnAllWorkspaces(true)
  overlayWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(OVERLAY_HTML))
  overlayWindow.once('ready-to-show', () => overlayWindow?.show())
}

// ── HTTP server for Chrome extension ────────────────────────────────────────

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (chunk) => { body += chunk })
    req.on('end', () => resolve(body))
  })
}

function startHttpServer() {
  const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    res.setHeader('Content-Type', 'application/json')

    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }

    const url = req.url ?? '/'

    // GET /status
    if (req.method === 'GET' && url === '/status') {
      res.writeHead(200)
      res.end(JSON.stringify({ ...recordingStatus, appRunning: true }))
      return
    }

    // GET /settings
    if (req.method === 'GET' && url === '/settings') {
      res.writeHead(200)
      res.end(JSON.stringify({ clickEffect }))
      return
    }

    // POST /settings
    if (req.method === 'POST' && url === '/settings') {
      const body = await readBody(req)
      try {
        const data = JSON.parse(body)
        if (data.clickEffect) clickEffect = data.clickEffect
        res.writeHead(200)
        res.end(JSON.stringify({ ok: true }))
      } catch { res.writeHead(400); res.end(JSON.stringify({ error: 'Bad request' })) }
      return
    }

    // POST /click — receive click from Chrome extension content script
    if (req.method === 'POST' && url === '/click') {
      const body = await readBody(req)
      try {
        const { x, y } = JSON.parse(body)
        if (recordingStatus.state === 'recording' && overlayWindow && clickEffect !== 'none') {
          overlayWindow.webContents.executeJavaScript(
            `showEffect(${Math.round(x)}, ${Math.round(y)}, '${clickEffect}')`
          ).catch(() => {})
        }
        res.writeHead(200)
        res.end(JSON.stringify({ ok: true }))
      } catch { res.writeHead(400); res.end(JSON.stringify({ error: 'Bad request' })) }
      return
    }

    // POST /record/start
    if (req.method === 'POST' && url === '/record/start') {
      if (recordingStatus.state !== 'idle') {
        res.writeHead(409); res.end(JSON.stringify({ error: 'Already recording' })); return
      }
      mainWindow?.webContents.send('remote:start')
      res.writeHead(200); res.end(JSON.stringify({ ok: true })); return
    }

    // POST /record/stop
    if (req.method === 'POST' && url === '/record/stop') {
      if (recordingStatus.state !== 'recording' && recordingStatus.state !== 'paused') {
        res.writeHead(409); res.end(JSON.stringify({ error: 'Not recording' })); return
      }
      mainWindow?.webContents.send('remote:stop')
      res.writeHead(200); res.end(JSON.stringify({ ok: true })); return
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

    res.writeHead(404); res.end(JSON.stringify({ error: 'Not found' }))
  })

  server.listen(HTTP_PORT, '127.0.0.1', () => {
    console.log(`[ScreenStudio] HTTP server listening on http://127.0.0.1:${HTTP_PORT}`)
  })
  server.on('error', (err) => console.error('[ScreenStudio] HTTP server error:', err))
}

// Renderer reports recording status changes
ipcMain.on('remote:status-update', (_event, status: { state: string; duration: number; countdown?: number }) => {
  recordingStatus = { state: status.state, duration: status.duration, countdown: status.countdown ?? 0 }
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
  createOverlayWindow()
  startHttpServer()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().filter(w => w !== overlayWindow).length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
