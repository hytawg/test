// ScreenStudio content script — captures clicks and sends screen coordinates to Electron overlay

const API = 'http://127.0.0.1:7823'

document.addEventListener('click', (e) => {
  // Calculate screen coordinates (including browser chrome/toolbar height)
  const toolbarH = window.outerHeight - window.innerHeight
  const screenX = window.screenX + e.clientX
  const screenY = window.screenY + toolbarH + e.clientY

  fetch(`${API}/click`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ x: screenX, y: screenY })
  }).catch(() => {})
}, true)
