const API = 'http://127.0.0.1:7823'

const dot          = document.getElementById('dot')
const statusText   = document.getElementById('statusText')
const durationText = document.getElementById('durationText')
const startBtn     = document.getElementById('startBtn')
const stopBtn      = document.getElementById('stopBtn')
const offlineNotice = document.getElementById('offlineNotice')

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

async function fetchStatus() {
  try {
    const res = await fetch(`${API}/status`, { signal: AbortSignal.timeout(1500) })
    if (!res.ok) throw new Error('not ok')
    return await res.json()
  } catch {
    return null
  }
}

function applyStatus(status) {
  if (!status || !status.appRunning) {
    // App offline
    dot.className = 'dot offline'
    statusText.textContent = 'App not running'
    durationText.textContent = ''
    startBtn.disabled = true
    stopBtn.style.display = 'none'
    offlineNotice.style.display = 'block'
    return
  }

  offlineNotice.style.display = 'none'

  if (status.state === 'recording') {
    dot.className = 'dot recording'
    statusText.textContent = 'Recording'
    durationText.textContent = formatDuration(Math.floor(status.duration))
    startBtn.style.display = 'none'
    stopBtn.style.display = 'flex'
    stopBtn.disabled = false
  } else if (status.state === 'paused') {
    dot.className = 'dot paused'
    statusText.textContent = 'Paused'
    durationText.textContent = formatDuration(Math.floor(status.duration))
    startBtn.style.display = 'none'
    stopBtn.style.display = 'flex'
    stopBtn.disabled = false
  } else {
    // idle / countdown / processing
    dot.className = 'dot idle'
    statusText.textContent = status.state === 'countdown' ? 'Starting…' : 'Ready'
    durationText.textContent = ''
    startBtn.style.display = 'flex'
    startBtn.disabled = (status.state !== 'idle')
    stopBtn.style.display = 'none'
  }
}

startBtn.addEventListener('click', async () => {
  startBtn.disabled = true
  try {
    await fetch(`${API}/record/start`, { method: 'POST', signal: AbortSignal.timeout(2000) })
  } catch { /* ignore */ }
  setTimeout(refresh, 500)
})

stopBtn.addEventListener('click', async () => {
  stopBtn.disabled = true
  try {
    await fetch(`${API}/record/stop`, { method: 'POST', signal: AbortSignal.timeout(2000) })
  } catch { /* ignore */ }
  setTimeout(refresh, 500)
})

async function refresh() {
  const status = await fetchStatus()
  applyStatus(status)
}

// Poll every 2 seconds while popup is open
refresh()
setInterval(refresh, 2000)
