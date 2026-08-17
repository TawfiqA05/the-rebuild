// ---------------------------------------------------------------------------
// themes.js — the theme system. A theme is DATA: one palette object. Adding a
// new theme means adding an entry here, nothing else. The palettes drive CSS
// custom properties (generated into a <style> at runtime), the swatches in
// Settings, the live PWA theme-color, and the contrast test.
//
// One-accent rule per theme: a single accent, split into a fill (`accent`) and
// a darker text version (`accentInk`). `onAccent` is the text/icon colour that
// sits ON the fill, chosen per theme so it always clears AA.
// ---------------------------------------------------------------------------

// palette key → CSS variable name
export const VAR = {
  ink: '--color-ink', ink2: '--color-ink-2', surface: '--color-surface', surface2: '--color-surface-2',
  line: '--color-line', line2: '--color-line-2',
  fg: '--color-fg', muted: '--color-muted', faint: '--color-faint',
  accent: '--color-accent', accentStrong: '--color-accent-strong', accentInk: '--color-accent-ink',
  accentSoft: '--color-accent-soft', onAccent: '--color-on-accent',
  min: '--color-min', minSoft: '--color-min-soft',
  risk: '--color-risk', riskSoft: '--color-risk-soft', danger: '--color-danger',
}

export const THEMES = [
  {
    id: 'ivory', name: 'Ivory', scheme: 'light',
    palette: {
      ink: '#f5f0e6', ink2: '#efe7d8', surface: '#fffdf9', surface2: '#f2ead9', line: '#e7ddcb', line2: '#d6c8ac',
      fg: '#241f18', muted: '#5b5340', faint: '#6b6350',
      accent: '#c6902f', accentStrong: '#b17d20', accentInk: '#7c5a12', accentSoft: '#f6ebd3', onAccent: '#231a09',
      min: '#855f1f', minSoft: '#f1e7cd', risk: '#6d6047', riskSoft: '#ece5d4', danger: '#a63a25',
    },
  },
  {
    id: 'charcoal', name: 'Charcoal', scheme: 'dark',
    palette: {
      ink: '#1b1917', ink2: '#232019', surface: '#262220', surface2: '#332f28', line: '#3a352d', line2: '#4d463a',
      fg: '#f1eadd', muted: '#c3b8a2', faint: '#9d927c',
      accent: '#d7a948', accentStrong: '#c39a3d', accentInk: '#e8c471', accentSoft: '#3a331f', onAccent: '#201a0b',
      min: '#d4ad5e', minSoft: '#332c1c', risk: '#b0a488', riskSoft: '#302b22', danger: '#ef8f79',
    },
  },
  {
    id: 'midnight', name: 'Midnight', scheme: 'dark',
    palette: {
      ink: '#0f1420', ink2: '#161c2b', surface: '#1a2130', surface2: '#242d40', line: '#2a3347', line2: '#3b4761',
      fg: '#eaf0fb', muted: '#aeb9cf', faint: '#8592ad',
      accent: '#8fb2e6', accentStrong: '#799fd8', accentInk: '#aac6f0', accentSoft: '#20293c', onAccent: '#0c1420',
      min: '#9fb6d8', minSoft: '#1f2a3c', risk: '#9aa6bd', riskSoft: '#212a3a', danger: '#f0908a',
    },
  },
  {
    id: 'sand', name: 'Sand', scheme: 'light',
    palette: {
      ink: '#efe4d3', ink2: '#e7dac4', surface: '#faf2e6', surface2: '#ecdec7', line: '#ddccb2', line2: '#c9b48f',
      fg: '#2c2318', muted: '#5f4f3a', faint: '#6d5c44',
      accent: '#b0542e', accentStrong: '#9d4a28', accentInk: '#a34a28', accentSoft: '#f2ded0', onAccent: '#fdf6ef',
      min: '#8c4f2c', minSoft: '#f0e0cd', risk: '#6f5c42', riskSoft: '#e8dac4', danger: '#a83824',
    },
  },
  {
    id: 'sage', name: 'Sage', scheme: 'light',
    palette: {
      ink: '#f2f4ee', ink2: '#e7ebe0', surface: '#fbfcf8', surface2: '#e9eee1', line: '#dde3d3', line2: '#c4cfb4',
      fg: '#20261d', muted: '#4d5744', faint: '#5b6551',
      accent: '#4a7740', accentStrong: '#416a38', accentInk: '#3f6a39', accentSoft: '#e4ecdd', onAccent: '#f7faf4',
      min: '#4e6d3e', minSoft: '#e5ecdb', risk: '#586451', riskSoft: '#e6ebde', danger: '#a83f2a',
    },
  },
  {
    id: 'rose', name: 'Rose', scheme: 'light',
    palette: {
      ink: '#f7efec', ink2: '#f1e4df', surface: '#fdf7f5', surface2: '#f2e2dc', line: '#ecd8d1', line2: '#dcbdb2',
      fg: '#2b2220', muted: '#5f4a45', faint: '#6d554f',
      accent: '#b05252', accentStrong: '#9d4747', accentInk: '#9c4747', accentSoft: '#f5e0dd', onAccent: '#fdf5f4',
      min: '#9a4f4c', minSoft: '#f2ddd8', risk: '#725a54', riskSoft: '#eddcd6', danger: '#b23a2a',
    },
  },
]

export function themeById(id) {
  return THEMES.find((t) => t.id === id) || THEMES[0]
}

/**
 * Resolve a stored choice ('system' | theme id) to a concrete theme id.
 * System follows the device: dark → Charcoal, light → Ivory.
 */
export function resolveThemeId(choice, prefersDark) {
  if (!choice || choice === 'system') return prefersDark ? 'charcoal' : 'ivory'
  return themeById(choice).id
}

// --- CSS generation ---------------------------------------------------------

function themeBlock(theme) {
  const decls = Object.entries(theme.palette)
    .map(([k, v]) => `${VAR[k]}:${v}`)
    .join(';')
  // :root[data-theme] beats the @theme :root defaults on specificity.
  return `:root[data-theme="${theme.id}"]{color-scheme:${theme.scheme};${decls}}`
}

/** All themes as one CSS string, ready to drop into a <style>. */
export function themesCss() {
  return THEMES.map(themeBlock).join('\n')
}

// --- runtime application (browser only) -------------------------------------

export function prefersDark() {
  return typeof matchMedia !== 'undefined' && matchMedia('(prefers-color-scheme: dark)').matches
}

let injected = false
/** Add the generated theme CSS to <head> once. */
export function injectThemeStyles() {
  if (injected || typeof document === 'undefined') return
  const style = document.createElement('style')
  style.id = 'rb-themes'
  style.textContent = themesCss()
  document.head.appendChild(style)
  injected = true
}

/**
 * Apply a theme choice ('system' | id) to the document: set data-theme, update
 * the PWA theme-color, and stash the resolved id + background so the next cold
 * start can paint the right colour before the bundle loads. Returns the id.
 */
export function applyTheme(choice) {
  if (typeof document === 'undefined') return 'ivory'
  injectThemeStyles()
  const id = resolveThemeId(choice, prefersDark())
  const theme = themeById(id)
  const root = document.documentElement
  root.setAttribute('data-theme', id)
  root.style.background = theme.palette.ink
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.setAttribute('content', theme.palette.ink)
  const bar = document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')
  if (bar) bar.setAttribute('content', theme.scheme === 'dark' ? 'black-translucent' : 'default')
  try {
    localStorage.setItem('rebuild:theme-id', id)
    localStorage.setItem('rebuild:bg', theme.palette.ink)
  } catch { /* private mode */ }
  return id
}

// --- WCAG contrast (used by the test and safe to run anywhere) --------------

function toRgb(hex) {
  const h = hex.replace('#', '')
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255)
}
function luminance(hex) {
  const [r, g, b] = toRgb(hex).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
export function contrast(a, b) {
  const l1 = luminance(a)
  const l2 = luminance(b)
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)
}
