// ---------------------------------------------------------------------------
// shareCard.js — draw the accountability summary onto a <canvas>.
//
// Pure canvas 2D, no external services. Colours are passed in (read from the
// active theme's CSS variables) so the card always matches the app's look.
// ---------------------------------------------------------------------------

import { scoreLabel } from './share.js'

const SCALE = 2 // retina export
const W = 540 // logical width

function rr(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return }
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * Draw `summary` onto `canvas` using `colors`
 * ({ bg, surface, fg, muted, faint, accent, accentInk, line }) and `opts`:
 *   { dir: 'ltr' | 'rtl', labels: { brand, thisWeek, votes, footer } }
 * In RTL the whole layout mirrors. Numbers stay Western for a shared image's
 * cross-audience legibility. Returns the logical { width, height }.
 */
export function drawShareCard(canvas, summary, colors, opts = {}) {
  const { dir = 'ltr', labels = {} } = opts
  const rtl = dir === 'rtl'
  const pad = 44
  const rows = summary.rows.slice(0, 9)
  const rowH = 54
  const headerH = 232
  const noteH = summary.note ? 92 : 8
  const footerH = 58
  const H = headerH + rows.length * rowH + noteH + footerH + pad

  canvas.width = W * SCALE
  canvas.height = H * SCALE
  const ctx = canvas.getContext('2d')
  ctx.scale(SCALE, SCALE)
  ctx.direction = rtl ? 'rtl' : 'ltr'

  // edges that flip with direction
  const startX = rtl ? W - pad : pad          // where headers/labels begin
  const startAlign = rtl ? 'right' : 'left'
  const endX = rtl ? pad : W - pad            // opposite edge (scores)
  const endAlign = rtl ? 'left' : 'right'

  ctx.fillStyle = colors.bg
  ctx.fillRect(0, 0, W, H)

  // header
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = startAlign
  ctx.fillStyle = colors.accentInk
  ctx.font = '600 15px Inter, sans-serif'
  ctx.fillText(labels.brand || 'THE REBUILD', startX, pad + 12)

  ctx.fillStyle = colors.fg
  ctx.font = '600 82px Fraunces, Georgia, serif'
  ctx.fillText(`${summary.overallPct}%`, startX, pad + 96)

  ctx.fillStyle = colors.muted
  ctx.font = '400 18px Inter, sans-serif'
  ctx.fillText(labels.thisWeek || `this week · ${summary.weekLabel}`, startX, pad + 126)

  ctx.font = '400 15px Inter, sans-serif'
  ctx.fillText(labels.votes || `${summary.votes.toLocaleString()} votes`, startX, pad + 154)

  // divider
  ctx.strokeStyle = colors.line
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(pad, headerH - 20); ctx.lineTo(W - pad, headerH - 20); ctx.stroke()

  // rows
  const barW = 120
  const barX = rtl ? pad + 62 : W - pad - barW - 62
  const emojiX = startX
  const nameX = rtl ? W - pad - 34 : pad + 36
  rows.forEach((r, i) => {
    const cy = headerH + i * rowH + rowH / 2
    ctx.textBaseline = 'middle'

    ctx.textAlign = startAlign
    ctx.font = '400 22px Inter, sans-serif'
    ctx.fillStyle = colors.fg
    ctx.fillText(r.emoji, emojiX, cy)

    // name (truncate to fit the gap between it and the bar)
    ctx.font = '450 17px Inter, sans-serif'
    let name = r.name
    const maxNameW = rtl ? (nameX - (barX + barW)) : (barX - nameX)
    while (ctx.measureText(name).width > maxNameW && name.length > 3) name = name.slice(0, -1)
    if (name !== r.name) name = name.slice(0, -1) + '…'
    ctx.fillText(name, nameX, cy)

    // bar track + fill (fill grows from the start edge)
    const pct = Math.max(0, Math.min(100, r.pct))
    const fillW = Math.max(8, (barW * pct) / 100)
    ctx.fillStyle = colors.line
    rr(ctx, barX, cy - 4, barW, 8, 4); ctx.fill()
    ctx.fillStyle = colors.accent
    rr(ctx, rtl ? barX + barW - fillW : barX, cy - 4, fillW, 8, 4); ctx.fill()

    // score + streak at the far edge
    ctx.textAlign = endAlign
    ctx.font = '500 15px Inter, sans-serif'
    ctx.fillStyle = colors.fg
    ctx.fillText(scoreLabel(r), endX, cy - (r.streak > 0 ? 8 : 0))
    if (r.streak > 0) {
      ctx.font = '400 12px Inter, sans-serif'
      ctx.fillStyle = colors.muted
      ctx.fillText(`🔥 ${r.streak}`, endX, cy + 9)
    }
  })

  // note
  if (summary.note) {
    const ny = headerH + rows.length * rowH + 8
    ctx.fillStyle = colors.surface
    rr(ctx, pad, ny, W - pad * 2, 64, 16); ctx.fill()
    ctx.strokeStyle = colors.line; ctx.stroke()
    ctx.fillStyle = colors.fg
    ctx.font = 'italic 400 17px Fraunces, Georgia, serif'
    ctx.textBaseline = 'middle'
    ctx.textAlign = startAlign
    let note = `“${summary.note}”`
    const maxW = W - pad * 2 - 36
    while (ctx.measureText(note).width > maxW && note.length > 4) note = note.slice(0, -1)
    ctx.fillText(note, rtl ? W - pad - 18 : pad + 18, ny + 33)
  }

  // footer
  ctx.textBaseline = 'alphabetic'
  ctx.textAlign = startAlign
  ctx.fillStyle = colors.faint
  ctx.font = '400 14px Inter, sans-serif'
  ctx.fillText(labels.footer || 'Never miss twice.', startX, H - pad + 6)

  return { width: W, height: H }
}

/** Read the palette the card needs from the active theme's CSS variables. */
export function themeColors(el = document.documentElement) {
  const s = getComputedStyle(el)
  const v = (name, fallback) => (s.getPropertyValue(name).trim() || fallback)
  return {
    bg: v('--color-ink', '#f5f0e6'),
    surface: v('--color-surface', '#fffdf9'),
    fg: v('--color-fg', '#241f18'),
    muted: v('--color-muted', '#6b6151'),
    faint: v('--color-faint', '#9a9080'),
    accent: v('--color-accent', '#c6902f'),
    accentInk: v('--color-accent-ink', '#7c5a12'),
    line: v('--color-line', '#e7ded0'),
  }
}
