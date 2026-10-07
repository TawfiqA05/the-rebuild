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

// What another tab's save looks like to this one.
function storageEventFrom(oldValue, newValue) {
  window.dispatchEvent(new StorageEvent('storage', { key: KEY, oldValue, newValue, storageArea: localStorage }))
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

describe('a save that fails', () => {
  it('says so, tries again on the next change, and clears once a save works', () => {
    const app = mount()
    expect(app.store().saveFailed).toBe(false)

    const realSet = Storage.prototype.setItem
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function () {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    })
    vi.spyOn(console, 'error').mockImplementation(() => {})
    act(() => app.store().addWin('Took the stairs'))
    expect(spy).toHaveBeenCalled()
    expect(app.store().saveFailed).toBe(true)

    // Still failing: the next change tries again and the line stays.
    const callsSoFar = spy.mock.calls.length
    act(() => app.store().addWin('Drank water'))
    expect(spy.mock.calls.length).toBeGreaterThan(callsSoFar)
    expect(app.store().saveFailed).toBe(true)

    // Storage works again: the next change saves everything and the line goes.
    spy.mockImplementation(function (...args) { return realSet.apply(this, args) })
    act(() => app.store().addWin('Slept on time'))
    expect(app.store().saveFailed).toBe(false)
    const saved = JSON.parse(localStorage.getItem(KEY))
    expect(saved.wins.map((w) => w.text)).toEqual(['Slept on time', 'Drank water', 'Took the stairs', 'Cooked at home all week'])
  })
})

describe('two tabs open at once', () => {
  it('settle after one change in each, with no repeated writes and nothing lost', () => {
    const a = mount()
    const b = mount()
    const writes = vi.spyOn(Storage.prototype, 'setItem')
    const keyWrites = () => writes.mock.calls.filter(([k]) => k === KEY).length

    // A change in tab A is written once. Tab B hears about it and takes it.
    let old = localStorage.getItem(KEY)
    act(() => a.store().addWin('From the first tab'))
    expect(keyWrites()).toBe(1)
    act(() => storageEventFrom(old, localStorage.getItem(KEY)))
    expect(b.store().state.wins[0].text).toBe('From the first tab')
    expect(keyWrites()).toBe(1)

    // A change in tab B now builds on A's, and A takes it back the same way.
    old = localStorage.getItem(KEY)
    act(() => b.store().addWin('From the second tab'))
    expect(keyWrites()).toBe(2)
    act(() => storageEventFrom(old, localStorage.getItem(KEY)))
    expect(keyWrites()).toBe(2)

    const texts = (s) => s.wins.map((w) => w.text)
    expect(texts(a.store().state)).toEqual(['From the second tab', 'From the first tab', 'Cooked at home all week'])
    expect(a.store().state).toEqual(b.store().state)
    expect(texts(JSON.parse(localStorage.getItem(KEY)))).toEqual(texts(a.store().state))
  })

  it('ignores a cleared or unreadable value from the other tab', () => {
    const a = mount()
    const before = a.store().state
    act(() => storageEventFrom(localStorage.getItem(KEY), null))
    act(() => storageEventFrom(localStorage.getItem(KEY), '{"settings":'))
    expect(a.store().state).toBe(before)
  })
})

describe('ids without crypto.randomUUID', () => {
  it('every action that makes an id still works', () => {
    vi.stubGlobal('crypto', { getRandomValues: (a) => a })
    const app = mount()
    act(() => {
      app.store().addWin('Walked after lunch')
      app.store().addMyQuote('Small steps every day.')
      app.store().addPrivateEntry({ note: 'made-up note' })
      app.store().addWaveSurvived({ seconds: 30 })
    })
    const s = app.store().state
    const ids = [s.wins[0].id, s.myQuotes[0].id, s.privateLog.entries[0].id, s.privateLog.waves[0].id]
    for (const id of ids) expect(typeof id).toBe('string')
    expect(new Set(ids).size).toBe(4)
  })
})
