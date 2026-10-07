// @vitest-environment jsdom
import { describe, it, expect, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import ErrorBoundary from './ErrorBoundary.jsx'

// A crash while drawing shows a plain screen with a way out, instead of a
// blank page. Its export is built from what is saved, not from the state that
// crashed.

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const KEY = 'the-rebuild:v1'
const COPY_KEY = 'the-rebuild:rescue:2026-10-01T09:00:00.000Z'

function Boom() {
  throw new Error('made-up crash while drawing')
}

let root = null
let container = null
function render(ui) {
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(ui))
}

afterEach(() => {
  if (root) act(() => root.unmount())
  root = null
  container?.remove()
  vi.restoreAllMocks()
  localStorage.clear()
})

describe('the error screen', () => {
  it('shows a plain line, Reload and Export my data instead of a blank page', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    await act(async () => {})
    expect(container.textContent).toContain('Something went wrong while showing this screen')
    expect(container.querySelector('[data-testid="crash-reload"]')).not.toBeNull()
    expect(container.querySelector('[data-testid="crash-export"]')).not.toBeNull()
  })

  it('exports what is saved, with every rescue copy', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const save = { version: 2, settings: { onboarded: true, language: 'en' }, habits: [], logs: {}, days: {}, votes: 7 }
    localStorage.setItem(KEY, JSON.stringify(save))
    localStorage.setItem(COPY_KEY, 'not json')
    let blob = null
    vi.spyOn(URL, 'createObjectURL').mockImplementation((b) => { blob = b; return 'blob:made-up' })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    await act(async () => {})
    act(() => container.querySelector('[data-testid="crash-export"]').click())
    const file = JSON.parse(await blob.text())
    expect(file.app).toBe('the-rebuild')
    expect(file.state).toEqual(save)
    expect(file.rescueCopies).toEqual([{ key: COPY_KEY, text: 'not json' }])
    // The screen stays up after an export.
    expect(container.querySelector('[data-testid="crash-reload"]')).not.toBeNull()
  })

  it('speaks the saved language', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    localStorage.setItem(KEY, JSON.stringify({ settings: { language: 'ar' }, habits: [] }))
    render(<ErrorBoundary><Boom /></ErrorBoundary>)
    await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
    expect(container.querySelector('[dir="rtl"]')).not.toBeNull()
    expect(container.textContent).not.toContain('Something went wrong')
  })

  it('draws its children when nothing crashes', () => {
    render(<ErrorBoundary><p>All fine</p></ErrorBoundary>)
    expect(container.textContent).toBe('All fine')
  })
})
