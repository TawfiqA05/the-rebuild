import { describe, it, expect } from 'vitest'
import { googleCalendarUrl, taskICS, icsFilename } from './calendar.js'

// The whole promise of the calendar action is that ONLY the task title and its
// due date ever go into the output — no ids of other tasks, no notes, no
// account, nothing else. These tests pin the exact shape and, crucially, that
// unrelated data can't sneak in.

const task = {
  id: 't1', text: 'Renew passport', source: 'manual',
  createdAt: 111, createdDay: '2026-08-01', dueDay: '2026-08-25', doneDay: null, doneAt: null,
}

describe('google calendar link', () => {
  it('is an all-day event on the due day, exclusive end date', () => {
    const u = new URL(googleCalendarUrl(task))
    expect(u.host).toBe('calendar.google.com')
    expect(u.pathname).toBe('/calendar/render')
    expect(u.searchParams.get('action')).toBe('TEMPLATE')
    expect(u.searchParams.get('text')).toBe('Renew passport')
    expect(u.searchParams.get('dates')).toBe('20260825/20260826')
  })

  it('carries only action, text and dates — nothing else', () => {
    const u = new URL(googleCalendarUrl(task))
    expect([...u.searchParams.keys()].sort()).toEqual(['action', 'dates', 'text'])
  })

  it('never leaks any field other than title and due day', () => {
    const nosy = { ...task, text: 'Pay rent', note: 'SECRET', source: 'shutdown', doneAt: 999 }
    const link = googleCalendarUrl(nosy)
    expect(link).not.toContain('SECRET')
    expect(link).not.toContain('shutdown')
    expect(link).not.toContain('999')
  })

  it('encodes a title with spaces and symbols safely', () => {
    const u = new URL(googleCalendarUrl({ ...task, text: 'Call mum & dad, 5pm?' }))
    expect(u.searchParams.get('text')).toBe('Call mum & dad, 5pm?') // decodes back cleanly
  })
})

describe('.ics file', () => {
  const ics = taskICS(task, { now: new Date(Date.UTC(2026, 7, 19, 5, 0, 0)) })

  it('is a well-formed all-day VEVENT with only title + date', () => {
    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('BEGIN:VEVENT')
    expect(ics).toContain('UID:t1@the-rebuild')
    expect(ics).toContain('DTSTAMP:20260819T050000Z')
    expect(ics).toContain('DTSTART;VALUE=DATE:20260825')
    expect(ics).toContain('DTEND;VALUE=DATE:20260826')
    expect(ics).toContain('SUMMARY:Renew passport')
    expect(ics).toContain('END:VCALENDAR')
    expect(ics.endsWith('\r\n')).toBe(true)
    expect(ics).toContain('\r\n') // CRLF line endings
  })

  it('escapes commas, semicolons and backslashes in the title (RFC 5545)', () => {
    const out = taskICS({ ...task, text: 'Buy milk, eggs; and \\ stuff' })
    expect(out).toContain('SUMMARY:Buy milk\\, eggs\\; and \\\\ stuff')
  })

  it('never includes any field beyond the title and due day', () => {
    const out = taskICS({ ...task, text: 'Pay rent', note: 'SECRET', source: 'shutdown', doneAt: 999 })
    expect(out).not.toContain('SECRET')
    expect(out).not.toContain('shutdown')
    expect(out).not.toContain('999')
  })
})

describe('filename', () => {
  it('slugifies the title and stamps the due day', () => {
    expect(icsFilename(task)).toBe('renew-passport-2026-08-25.ics')
  })
  it('falls back to "task" for a title with no usable characters', () => {
    expect(icsFilename({ ...task, text: '؟؟؟' })).toBe('task-2026-08-25.ics')
  })
})
