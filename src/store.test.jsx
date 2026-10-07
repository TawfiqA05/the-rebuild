// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { StoreProvider, useStore } from './store.jsx'
import { serializeBackup } from './lib/backup.js'

// These run the real store in a simulated browser: the provider mounts, reads
// and writes localStorage, and the actions go through React state updates the
// way they do in the app.

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const KEY = 'the-rebuild:v1'

// A made-up save from someone a few days in.
function sampleSave() {
  return {
    version: 2,
    settings: { onboarded: true, tourSeen: true, language: 'en', currentPhase: 1, includeIslamic: true, collapseDefaultsApplied: true },
    habits: [{ id: 'walk-x1', name: 'Evening walk', emoji: '🚶', phase: 1, type: 'standard', frequency: { kind: 'daily' }, minVersion: 'Walk to the corner', stock: false, archived: false, createdAt: '2026-09-01T12:00:00.000Z' }],
    logs: {
      '2026-09-28': { 'walk-x1': { status: 'full', at: 1 }, bed: { status: 'full', at: 1 } },
      '2026-09-29': { 'walk-x1': { status: 'min', at: 2 } },
    },
    days: {},
    votes: 3,
    wins: [{ id: 'w1', at: 1, text: 'Cooked at home all week' }],
  }
}

const mounted = []
function mount() {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  const ref = { current: null }
  function Probe() {
    ref.current = useStore()
    return null
  }
  act(() => root.render(<StoreProvider><Probe /></StoreProvider>))
  const handle = { store: () => ref.current, unmount: () => act(() => root.unmount()) }
  mounted.push(handle)
  return handle
}

beforeEach(() => {
  localStorage.clear()
  localStorage.setItem(KEY, JSON.stringify(sampleSave()))
})

afterEach(() => {
  while (mounted.length) mounted.pop().unmount()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  localStorage.clear()
})

describe('importing a backup through the store', () => {
  const badFiles = {
    'an empty object': '{}',
    'a list': '[]',
    'an envelope with an empty state': JSON.stringify({ schemaVersion: 1, app: 'the-rebuild', exportedAt: '2026-10-01T00:00:00.000Z', state: {} }),
    "another app's file": JSON.stringify({ schemaVersion: 1, app: 'some-other-app', state: { settings: {}, habits: [] } }),
    'a cut-off file': serializeBackup(sampleSave()).slice(0, 120),
  }

  for (const [name, file] of Object.entries(badFiles)) {
    it(`refuses ${name} and leaves the state and storage as they were`, () => {
      const app = mount()
      const before = app.store().state
      const savedBefore = localStorage.getItem(KEY)
      let thrown = null
      act(() => {
        const { importJSON } = app.store()
        try { importJSON(file) } catch (err) { thrown = err }
      })
      expect(thrown).not.toBeNull()
      expect(app.store().state).toBe(before)
      expect(localStorage.getItem(KEY)).toBe(savedBefore)
    })
  }

  it('reads a good backup without changing anything, then restores it', () => {
    const app = mount()
    const before = app.store().state
    const other = sampleSave()
    other.votes = 99
    other.wins = [{ id: 'w9', at: 9, text: 'Finished the long book' }]
    const file = serializeBackup(other)

    const next = app.store().readBackup(file)
    expect(next.votes).toBe(99)
    expect(app.store().state).toBe(before)

    const { importJSON } = app.store()
    act(() => importJSON(file))
    expect(app.store().state.votes).toBe(99)
    expect(app.store().state.wins.map((w) => w.text)).toEqual(['Finished the long book'])
    expect(JSON.parse(localStorage.getItem(KEY)).votes).toBe(99)
  })
})
