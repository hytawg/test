#!/usr/bin/env node
/**
 * analyze-log.js — offline analysis of the NDJSON focus log.
 *
 * Usage:  node analyze-log.js [path/to/focus-log.ndjson]
 *
 * Prints:
 *   • Total frames / duration
 *   • State distribution (% time in each state)
 *   • Zoom statistics (min/max/avg)
 *   • Focus transitions (when & where the target changed)
 */

const fs   = require('fs')
const path = require('path')
const readline = require('readline')

const logPath = process.argv[2] ?? path.join(__dirname, 'focus-log.ndjson')

if (!fs.existsSync(logPath)) {
  console.error(`Log file not found: ${logPath}`)
  process.exit(1)
}

const rl = readline.createInterface({ input: fs.createReadStream(logPath) })

const stateCounts  = {}
let zoomSum = 0, zoomMin = Infinity, zoomMax = -Infinity
let totalFrames = 0
let firstTs = null, lastTs = null
let prevTarget = null
const transitions = []

rl.on('line', (line) => {
  if (!line.trim()) return
  let rec
  try { rec = JSON.parse(line) } catch { return }

  totalFrames++
  firstTs = firstTs ?? rec.ts
  lastTs = rec.ts

  stateCounts[rec.state] = (stateCounts[rec.state] ?? 0) + 1

  zoomSum += rec.camera.zoom
  if (rec.camera.zoom < zoomMin) zoomMin = rec.camera.zoom
  if (rec.camera.zoom > zoomMax) zoomMax = rec.camera.zoom

  const tx = rec.target.x.toFixed(3)
  const ty = rec.target.y.toFixed(3)
  const key = `${tx},${ty}`
  if (prevTarget !== key) {
    transitions.push({ ts: rec.ts, state: rec.state, target: rec.target, camera: rec.camera })
    prevTarget = key
  }
})

rl.on('close', () => {
  if (totalFrames === 0) { console.log('No frames found.'); return }

  const durationSec = ((lastTs - firstTs) / 1000).toFixed(1)
  console.log(`\n── Focus Log Analysis ─────────────────────────────────────────`)
  console.log(`   Frames : ${totalFrames}  |  Duration : ${durationSec}s  |  Avg fps : ${(totalFrames / Number(durationSec)).toFixed(1)}`)

  console.log(`\n── State distribution ─────────────────────────────────────────`)
  for (const [state, count] of Object.entries(stateCounts).sort((a, b) => b[1] - a[1])) {
    const pct = (count / totalFrames * 100).toFixed(1).padStart(5)
    console.log(`   ${state.padEnd(10)} ${pct}%  (${count} frames)`)
  }

  console.log(`\n── Zoom statistics ────────────────────────────────────────────`)
  console.log(`   min=${zoomMin.toFixed(3)}  max=${zoomMax.toFixed(3)}  avg=${(zoomSum / totalFrames).toFixed(3)}`)

  console.log(`\n── Focus transitions (last 20) ────────────────────────────────`)
  const last20 = transitions.slice(-20)
  for (const t of last20) {
    const elapsed = ((t.ts - firstTs) / 1000).toFixed(2).padStart(7)
    const tx = (t.target.x * 100).toFixed(1).padStart(5)
    const ty = (t.target.y * 100).toFixed(1).padStart(5)
    const cx = (t.camera.x * 100).toFixed(1).padStart(5)
    const cy = (t.camera.y * 100).toFixed(1).padStart(5)
    const z  = t.camera.zoom.toFixed(2)
    console.log(`   t=${elapsed}s  [${t.state.padEnd(8)}]  target(${tx}%,${ty}%)  cam(${cx}%,${cy}%)  zoom=×${z}`)
  }
  console.log()
})
