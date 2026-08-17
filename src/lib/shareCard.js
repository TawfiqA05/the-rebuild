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
 * ({ bg, surface, fg, muted, faint, accent, accentInk, line }). Sizes the
 * canvas to fit the rows. Returns the logical { width, height }.
 */
export function drawShareCard(canvas, summary, colors) {
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

  // background
  ctx.fillStyle = colors.bg
  ctx.fillRect(0, 0, W, H)

  // header
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = colors.accentInk
  ctx.font = '600 15px Inter, sans-serif'
  ctx.fillText('THE REBUILD', pad, pad + 12)

  ctx.fillStyle = colors.fg
  ctx.font = '600 82px Fraunces, Georgia, serif'
  ctx.fillText(`${summary.overallPct}%`, pad, pad + 96)

  ctx.fillStyle = colors.muted
  ctx.font = '400 18px Inter, sans-serif'
  ctx.fillText(`this week · ${summary.weekLabel}`, pad, pad + 126)

  ctx.fillStyle = colors.muted
  ctx.font = '400 15px Inter, sans-serif'
  const votes = `${summary.votes.toLocaleString()} votes for who I’m becoming`
  ctx.fillText(votes, pad, pad + 154)

  // divider
  ctx.strokeStyle = colors.line
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(pad, headerH - 20); ctx.lineTo(W - pad, headerH - 20); ctx.stroke()

  // rows
  const barW = 120
  const barX = W - pad - barW - 62
  rows.forEach((r, i) => {
    const y = headerH + i * rowH
    const cy = y + rowH / 2
    ctx.textBaseline = 'middle'
    ctx.font = '400 22px Inter, sans-serif'
    ctx.fillStyle = colors.fg
    ctx.fillText(r.emoji, pad, cy)

    // name (truncate to fit)
    ctx.font = '450 17px Inter, sans-serif'
    let name = r.name
    const maxNameW = barX - (pad + 36)
    while (ctx.measureText(name).width > maxNameW && name.length > 3) name = name.slice(0, -1)
    if (name !== r.name) name = name.slice(0, -1) + '…'
    ctx.fillStyle = colors.fg
    ctx.fillText(name, pad + 36, cy)

    // bar track + fill
    const pct = Math.max(0, Math.min(100, r.pct))
    ctx.fillStyle = colors.line
    rr(ctx, barX, cy - 4, barW, 8, 4); ctx.fill()
    ctx.fillStyle = colors.accent
    rr(ctx, barX, cy - 4, Math.max(8, (barW * pct) / 100), 8, 4); ctx.fill()

    // score + streak
    ctx.textAlign = 'right'
    ctx.font = '500 15px Inter, sans-serif'
    ctx.fillStyle = colors.fg
    ctx.fillText(scoreLabel(r), W - pad, cy - (r.streak > 0 ? 8 : 0))
    if (r.streak > 0) {
      ctx.font = '400 12px Inter, sans-serif'
      ctx.fillStyle = colors.muted
      ctx.fillText(`🔥 ${r.streak}`, W - pad, cy + 9)
    }
    ctx.textAlign = 'left'
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
    let note = `“${summary.note}”`
    const maxW = W - pad * 2 - 36
    while (ctx.measureText(note).width > maxW && note.length > 4) note = note.slice(0, -1)
    ctx.fillText(note, pad + 18, ny + 33)
  }

  // footer
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = colors.faint
  ctx.font = '400 14px Inter, sans-serif'
  ctx.fillText('Never miss twice.', pad, H - pad + 6)

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
