const API = 'http://127.0.0.1:7823'

const dot           = document.getElementById('dot')
const statusText    = document.getElementById('statusText')
const durationText  = document.getElementById('durationText')
const startBtn      = document.getElementById('startBtn')
const stopBtn       = document.getElementById('stopBtn')
const offlineNotice = document.getElementById('offlineNotice')
const countdownBox  = document.getElementById('countdownBox')
const countdownNum  = document.getElementById('countdownNum')
const effectBtns    = document.querySelectorAll('.effect-btn')

// ── Effect selection ───────────────────────────────────────────────────────

function setActiveEffect(effect) {
  effectBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.effect === effect)
  })
}

async function loadEffect() {
  try {
    const res = await fetch(`${API}/settings`, { signal: AbortSignal.timeout(1500) })
    if (res.ok) {
      const data = await res.json()
      setActiveEffect(data.clickEffect || 'ripple')
    }
  } catch { /* app not running */ }
}

effectBtns.forEach(btn => {
  btn.addEventListener('click', async () => {
    const effect = btn.dataset.effect
    setActiveEffect(effect)
    try {
      await fetch(`${API}/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clickEffect: effect }),
        signal: AbortSignal.timeout(1500)
      })
    } catch { /* ignore */ }
  })
})

// ── Status polling ─────────────────────────────────────────────────────────

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

async function fetchStatus() {
  try {
    const res = await fetch(`${API}/status`, { signal: AbortSignal.timeout(1500) })
    if (!res.ok) throw new Error()
    return await res.json()
  } catch { return null }
}

let pollInterval = null

function startPolling(ms) {
  if (pollInterval) clearInterval(pollInterval)
  pollInterval = setInterval(refresh, ms)
}

function applyStatus(status) {
  if (!status || !status.appRunning) {
    dot.className = 'dot offline'
    statusText.textContent = 'App not running'
    durationText.textContent = ''
    startBtn.disabled = true
    stopBtn.style.display = 'none'
    countdownBox.style.display = 'none'
    offlineNotice.style.display = 'block'
    startPolling(3000)
    return
  }

  offlineNotice.style.display = 'none'

  if (status.state === 'countdown') {
    dot.className = 'dot idle'
    statusText.textContent = 'Starting…'
    durationText.textContent = ''
    startBtn.style.display = 'none'
    stopBtn.style.display = 'none'
    countdownBox.style.display = 'flex'
    countdownNum.textContent = status.countdown || '…'
    startPolling(400) // fast poll during countdown
    return
  }

  countdownBox.style.display = 'none'

  if (status.state === 'recording') {
    dot.className = 'dot recording'
    statusText.textContent = 'Recording'
    durationText.textContent = formatDuration(Math.floor(status.duration))
    startBtn.style.display = 'none'
    stopBtn.style.display = 'flex'
    stopBtn.disabled = false
    startPolling(1000)
  } else if (status.state === 'paused') {
    dot.className = 'dot paused'
    statusText.textContent = 'Paused'
    durationText.textContent = formatDuration(Math.floor(status.duration))
    startBtn.style.display = 'none'
    stopBtn.style.display = 'flex'
    stopBtn.disabled = false
    startPolling(1500)
  } else {
    dot.className = 'dot idle'
    statusText.textContent = status.state === 'processing' ? 'Processing…' : 'Ready'
    durationText.textContent = ''
    startBtn.style.display = 'flex'
    startBtn.disabled = (status.state !== 'idle')
    stopBtn.style.display = 'none'
    startPolling(2000)
  }
}

startBtn.addEventListener('click', async () => {
  startBtn.disabled = true
  try {
    await fetch(`${API}/record/start`, { method: 'POST', signal: AbortSignal.timeout(2000) })
  } catch { /* ignore */ }
  setTimeout(refresh, 300)
})

stopBtn.addEventListener('click', async () => {
  stopBtn.disabled = true
  try {
    await fetch(`${API}/record/stop`, { method: 'POST', signal: AbortSignal.timeout(2000) })
  } catch { /* ignore */ }
  setTimeout(refresh, 300)
})

async function refresh() {
  const status = await fetchStatus()
  applyStatus(status)
}

// Init
loadEffect()
refresh()
startPolling(2000)
