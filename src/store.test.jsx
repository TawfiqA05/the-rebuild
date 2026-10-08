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

// --- saved data that can't be read, rescue copies and repairs ---------------

const RESCUE = 'the-rebuild:rescue:'
const rescueKeys = () => Object.keys(localStorage).filter((k) => k.startsWith(RESCUE)).sort()
const saved = () => JSON.parse(localStorage.getItem(KEY))
// Refuse every write to a rescue key, the way a full storage would.
function refuseRescueWrites() {
  const realSet = Storage.prototype.setItem
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  return vi.spyOn(Storage.prototype, 'setItem').mockImplementation(function (k, v) {
    if (String(k).startsWith(RESCUE)) throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    return realSet.call(this, k, v)
  })
}
const quiet = () => vi.spyOn(console, 'warn').mockImplementation(() => {})

describe('saved data that can not be read', () => {
  const unreadable = {
    'text that is not JSON': '{"settings":{"onboarded":tr',
    'a list': '[1,2]',
    'a number': '5',
    'settings that are not an object': JSON.stringify({ ...sampleSave(), settings: 'x' }),
  }
  for (const [name, raw] of Object.entries(unreadable)) {
    it(`keeps ${name} under a rescue key, reads it back, then starts fresh and saves`, () => {
      quiet()
      localStorage.setItem(KEY, raw)
      const app = mount()
      const keys = rescueKeys()
      expect(keys).toHaveLength(1)
      expect(localStorage.getItem(keys[0])).toBe(raw)
      expect(app.store().rescue).toMatchObject({ kind: 'kept', copy: keys[0] })
      expect(app.store().state.settings.onboarded).toBe(false)
      // Saving goes on: the fresh state is saved and the next change too.
      expect(saved().settings.onboarded).toBe(false)
      act(() => app.store().toggleHabit('2026-10-05', 'bed'))
      expect(saved().logs['2026-10-05'].bed.status).toBe('full')
      expect(localStorage.getItem(keys[0])).toBe(raw)
    })
  }

  it('loads healthy data exactly as before and writes no rescue copy', () => {
    const app = mount()
    expect(rescueKeys()).toEqual([])
    expect(app.store().rescue).toBe(null)
    expect(saved().wins[0].text).toBe('Cooked at home all week')
  })

  it('does not keep a second copy of the same original when it loads twice', () => {
    quiet()
    localStorage.setItem(KEY, 'not json')
    const before = localStorage.getItem.bind(localStorage)
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation((k) => (k === KEY ? 'not json' : before(k)))
    mount()
    mount()
    expect(rescueKeys()).toHaveLength(1)
  })
})

describe('a rescue copy that storage refuses', () => {
  it('leaves the original untouched and saves nothing until Start fresh', () => {
    const raw = '{"settings":{"onboarded":tr'
    localStorage.setItem(KEY, raw)
    refuseRescueWrites()
    const app = mount()
    expect(rescueKeys()).toEqual([])
    expect(app.store().rescue).toMatchObject({ kind: 'refused', copy: null })
    expect(localStorage.getItem(KEY)).toBe(raw)
    // Changes are not saved while the screen is up.
    act(() => app.store().toggleHabit('2026-10-05', 'bed'))
    expect(localStorage.getItem(KEY)).toBe(raw)
    // Export reads what is saved, and the screen stays.
    const file = JSON.parse(app.store().exportSaved())
    expect(file.savedText).toBe(raw)
    expect(app.store().rescue.kind).toBe('refused')
    // Start fresh erases it and saving starts again.
    act(() => app.store().startFresh())
    expect(app.store().rescue).toBe(null)
    expect(saved().settings.onboarded).toBe(false)
    act(() => app.store().toggleHabit('2026-10-05', 'bed'))
    expect(saved().logs['2026-10-05'].bed.status).toBe('full')
  })

  it('treats a copy that reads back different as refused, and removes it', () => {
    const raw = 'not json at all'
    localStorage.setItem(KEY, raw)
    quiet()
    const realGet = Storage.prototype.getItem
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(function (k) {
      const v = realGet.call(this, k)
      return String(k).startsWith(RESCUE) && v != null ? v.slice(0, 3) : v
    })
    const app = mount()
    expect(app.store().rescue.kind).toBe('refused')
    expect(rescueKeys()).toEqual([])
    expect(realGet.call(localStorage, KEY)).toBe(raw)
  })

  it('also stops a set-aside repair, since that needs the copy', () => {
    const raw = JSON.stringify({ ...sampleSave(), habits: 'oops' })
    localStorage.setItem(KEY, raw)
    refuseRescueWrites()
    const app = mount()
    expect(app.store().rescue.kind).toBe('refused')
    expect(localStorage.getItem(KEY)).toBe(raw)
  })

  it('stops a list entry set-aside too, and Start fresh then keeps everything that could be read', () => {
    const s = { ...sampleSave(), wins: [null, ...sampleSave().wins], days: { '2026-09-28': { roughDay: true } } }
    const raw = JSON.stringify(s)
    localStorage.setItem(KEY, raw)
    refuseRescueWrites()
    const app = mount()
    expect(app.store().rescue.kind).toBe('refused')
    expect(localStorage.getItem(KEY)).toBe(raw)
    act(() => app.store().startFresh())
    expect(app.store().rescue).toBe(null)
    expect(saved().settings.onboarded).toBe(true)
    expect(saved().habits.find((h) => h.id === 'walk-x1')).toBeTruthy()
    expect(saved().logs).toEqual(sampleSave().logs)
    expect(saved().days).toEqual(s.days)
    expect(saved().wins.map((w) => w.text)).toEqual(['Cooked at home all week'])
    act(() => app.store().toggleHabit('2026-10-05', 'walk-x1'))
    expect(saved().logs['2026-10-05']['walk-x1'].status).toBe('full')
  })

  it('Start fresh after a set-aside of habits keeps every log and day', () => {
    const s = { ...sampleSave(), habits: 'oops' }
    localStorage.setItem(KEY, JSON.stringify(s))
    refuseRescueWrites()
    const app = mount()
    expect(app.store().rescue.kind).toBe('refused')
    act(() => app.store().startFresh())
    expect(saved().logs).toEqual(sampleSave().logs)
    expect(saved().votes).toBe(3)
  })

  it('still saves a fix that sets nothing aside, and does not claim a copy', () => {
    const s = sampleSave()
    delete s.habits[0].frequency
    localStorage.setItem(KEY, JSON.stringify(s))
    refuseRescueWrites()
    const app = mount()
    expect(app.store().rescue).toMatchObject({ kind: 'repaired', copy: null })
    expect(saved().habits[0].frequency).toEqual({ kind: 'daily' })
  })
})

describe('repairs on load', () => {
  it('a habit with no frequency becomes daily, is named in the report, saved, and the original is kept', () => {
    const s = sampleSave()
    delete s.habits[0].frequency
    const raw = JSON.stringify(s)
    localStorage.setItem(KEY, raw)
    const app = mount()
    const r = app.store().rescue
    expect(r.kind).toBe('repaired')
    expect(r.fixes).toEqual([{ type: 'daily', habitId: 'walk-x1' }])
    expect(localStorage.getItem(r.copy)).toBe(raw)
    expect(saved().habits[0].frequency).toEqual({ kind: 'daily' })
    expect(saved().logs).toEqual(s.logs)
    act(() => app.store().toggleHabit('2026-10-05', 'walk-x1'))
    expect(saved().logs['2026-10-05']['walk-x1'].status).toBe('full')
  })

  it('habits saved as an object are read out, and nothing else changes', () => {
    const s = sampleSave()
    s.habits = { 'walk-x1': s.habits[0] }
    localStorage.setItem(KEY, JSON.stringify(s))
    const app = mount()
    expect(app.store().rescue.fixes).toEqual([{ type: 'readOut', field: 'habits' }])
    expect(saved().habits[0].id).toBe('walk-x1')
    expect(saved().logs).toEqual(sampleSave().logs)
    expect(saved().votes).toBe(3)
  })

  it('habits that cannot be read are set aside in the copy and every log and day is kept', () => {
    const s = { ...sampleSave(), habits: 'oops', days: { '2026-09-28': { roughDay: true } } }
    const raw = JSON.stringify(s)
    localStorage.setItem(KEY, raw)
    const app = mount()
    const r = app.store().rescue
    expect(r.kind).toBe('repaired')
    expect(r.setAside).toEqual([{ field: 'habits' }])
    expect(localStorage.getItem(r.copy)).toBe(raw)
    expect(saved().logs).toEqual(s.logs)
    expect(saved().days).toEqual(s.days)
    expect(Array.isArray(saved().habits)).toBe(true)
  })

  it('habit entries that are not objects are set aside in the copy and every habit that is stays', () => {
    const s = { ...sampleSave() }
    s.habits = [null, s.habits[0], 'x']
    const raw = JSON.stringify(s)
    localStorage.setItem(KEY, raw)
    const app = mount()
    const r = app.store().rescue
    expect(r.setAside).toEqual([{ field: 'habits', entries: 2 }])
    expect(localStorage.getItem(r.copy)).toBe(raw)
    expect(saved().habits.filter((h) => h.id === 'walk-x1')).toHaveLength(1)
    expect(saved().habits.every((h) => h && typeof h === 'object')).toBe(true)
    expect(saved().logs).toEqual(sampleSave().logs)
  })

  it('null entries in wins, tasks, food and quotes are set aside in the copy and every real entry stays', () => {
    const s = { ...sampleSave(), wins: [null, ...sampleSave().wins], tasks: ['x'], food: [null], myQuotes: [3] }
    const raw = JSON.stringify(s)
    localStorage.setItem(KEY, raw)
    const app = mount()
    const r = app.store().rescue
    expect(r.kind).toBe('repaired')
    expect(r.setAside.map((x) => x.field).sort()).toEqual(['food', 'myQuotes', 'tasks', 'wins'])
    expect(localStorage.getItem(r.copy)).toBe(raw)
    expect(saved().wins.map((w) => w.text)).toEqual(['Cooked at home all week'])
    expect(saved().tasks).toEqual([])
    expect(saved().logs).toEqual(sampleSave().logs)
  })

  it('a null in the task archive is set aside in the copy, and the load no longer crashes', () => {
    const entry = { id: 'a1', text: 'Renew the car tag', reason: 'completed', archivedAt: Date.now() }
    const s = { ...sampleSave(), taskArchive: [null, entry] }
    const raw = JSON.stringify(s)
    localStorage.setItem(KEY, raw)
    const app = mount()
    const r = app.store().rescue
    expect(r.kind).toBe('repaired')
    expect(r.setAside).toEqual([{ field: 'taskArchive', entries: 1 }])
    expect(localStorage.getItem(r.copy)).toBe(raw)
    expect(saved().taskArchive).toEqual([entry])
    expect(saved().logs).toEqual(sampleSave().logs)
  })

  it('what the rules leave as it is loads with no repair and no copy', () => {
    const s = sampleSave()
    s.logs['2026-09-30'] = null
    s.days = { '2026-09-28': 'x' }
    s.habits.push({ ...s.habits[0], id: 'odd-x2', frequency: { kind: 'monthly' } })
    localStorage.setItem(KEY, JSON.stringify(s))
    const app = mount()
    expect(app.store().rescue).toBe(null)
    expect(rescueKeys()).toEqual([])
    expect(saved().logs['2026-09-30']).toBe(null)
    expect(saved().days).toEqual({ '2026-09-28': 'x' })
  })

  it('a repaired save loads clean the next time, with no second copy', () => {
    const s = sampleSave()
    delete s.habits[0].frequency
    localStorage.setItem(KEY, JSON.stringify(s))
    const first = mount()
    first.unmount()
    mounted.pop()
    const again = mount()
    expect(again.store().rescue).toBe(null)
    expect(rescueKeys()).toHaveLength(1)
  })

  it('an imported file is repaired as it is read, with no rescue copy', () => {
    const app = mount()
    const s = sampleSave()
    delete s.habits[0].frequency
    act(() => app.store().importJSON(serializeBackup(s)))
    expect(app.store().state.habits[0].frequency).toEqual({ kind: 'daily' })
    expect(saved().habits[0].frequency).toEqual({ kind: 'daily' })
    expect(rescueKeys()).toEqual([])
  })
})

describe('when a rescue copy already exists', () => {
  const OLD_KEY = `${RESCUE}2026-10-01T09:00:00.000Z`
  const OLD_COPY = '{"habits":"oops"'

  it('a second failure gets a new dated copy and the old one is untouched', () => {
    quiet()
    localStorage.setItem(OLD_KEY, OLD_COPY)
    localStorage.setItem(KEY, '{"settings":{"onbo')
    const app = mount()
    const keys = rescueKeys()
    expect(keys).toHaveLength(2)
    expect(localStorage.getItem(OLD_KEY)).toBe(OLD_COPY)
    expect(localStorage.getItem(app.store().rescue.copy)).toBe('{"settings":{"onbo')
    expect(app.store().rescue.kind).toBe('kept')
  })

  it('a repairable habit gets a new dated copy too, and the repaired data is saved', () => {
    localStorage.setItem(OLD_KEY, OLD_COPY)
    const s = sampleSave()
    delete s.habits[0].frequency
    const raw = JSON.stringify(s)
    localStorage.setItem(KEY, raw)
    const app = mount()
    expect(rescueKeys()).toHaveLength(2)
    expect(localStorage.getItem(OLD_KEY)).toBe(OLD_COPY)
    expect(localStorage.getItem(app.store().rescue.copy)).toBe(raw)
    expect(saved().habits[0].frequency).toEqual({ kind: 'daily' })
  })

  it('Reset everything removes every rescue copy', () => {
    localStorage.setItem(OLD_KEY, OLD_COPY)
    localStorage.setItem(`${RESCUE}2026-10-02T09:00:00.000Z`, 'x')
    const app = mount()
    act(() => app.store().resetAll())
    expect(rescueKeys()).toEqual([])
    expect(saved().settings.onboarded).toBe(false)
  })

  it('Reset everything or an import clears the repair report, so it never speaks of a copy that is gone', () => {
    const s = sampleSave()
    delete s.habits[0].frequency
    localStorage.setItem(KEY, JSON.stringify(s))
    const app = mount()
    expect(app.store().rescue.kind).toBe('repaired')
    act(() => app.store().resetAll())
    expect(app.store().rescue).toBe(null)

    localStorage.clear()
    localStorage.setItem(KEY, JSON.stringify(s))
    const again = mount()
    expect(again.store().rescue.kind).toBe('repaired')
    act(() => again.store().importJSON(serializeBackup(sampleSave())))
    expect(again.store().rescue).toBe(null)
  })

  it('the saved-data export holds the save and every copy, read from storage', () => {
    localStorage.setItem(OLD_KEY, OLD_COPY)
    const app = mount()
    act(() => app.store().addWin('Only in memory for a moment'))
    localStorage.setItem(KEY, JSON.stringify(sampleSave()))
    const file = JSON.parse(app.store().exportSaved())
    expect(file.app).toBe('the-rebuild')
    expect(file.state.wins.map((w) => w.text)).toEqual(['Cooked at home all week'])
    expect(file.rescueCopies).toEqual([{ key: OLD_KEY, text: OLD_COPY }])
  })
})

describe('storage blocked outright', () => {
  it('keeps no rescue copy and starts in memory, as before', async () => {
    vi.resetModules()
    localStorage.setItem(KEY, 'not json')
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('blocked', 'SecurityError') })
    quiet()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const mod = await import('./store.jsx')
    expect(mod.storageAvailable).toBe(false)
    const container = document.createElement('div')
    const root = createRoot(container)
    const ref = { current: null }
    function Probe() { ref.current = mod.useStore(); return null }
    act(() => root.render(<mod.StoreProvider><Probe /></mod.StoreProvider>))
    expect(ref.current.rescue).toBe(null)
    expect(rescueKeys()).toEqual([])
    expect(localStorage.getItem(KEY)).toBe('not json')
    act(() => root.unmount())
  })
})
