/**
 * generate-icons.js — Create PNG icons for the Chrome extension.
 *
 * Requires Node.js with the `canvas` package installed:
 *   npm install canvas   (or: pnpm add canvas)
 *
 * Run once:
 *   node extension/icons/generate-icons.js
 *
 * Output: icon16.png, icon48.png, icon128.png in this directory.
 */
const { createCanvas } = require('canvas')
const fs = require('fs')
const path = require('path')

const SIZES = [16, 48, 128]
const OUT_DIR = __dirname

for (const size of SIZES) {
  const canvas = createCanvas(size, size)
  const ctx = canvas.getContext('2d')

  // Blue circle background
  ctx.fillStyle = '#2563eb'
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.fill()

  // White sparkle emoji (✨ approximated as a star)
  ctx.fillStyle = '#ffffff'
  ctx.font = `bold ${Math.floor(size * 0.55)}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('✦', size / 2, size / 2 + 1)

  const outPath = path.join(OUT_DIR, `icon${size}.png`)
  fs.writeFileSync(outPath, canvas.toBuffer('image/png'))
  console.log(`✓  ${outPath}`)
}

console.log('Icons generated.')
