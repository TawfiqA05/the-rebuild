// ---------------------------------------------------------------------------
// calendar.js — turn a task into a calendar event, with no account and no
// network. A task with a due day becomes a single ALL-DAY event on that day.
//
// Two outputs, both built entirely on-device from the task's title and due day
// and NOTHING else:
//   googleCalendarUrl(task) — a prefilled Google Calendar "create event" link
//   taskICS(task)           — an RFC-5545 all-day VEVENT as text (a .ics file)
//
// Neither leaves the device until the user taps: the link only goes anywhere
// when it's clicked (a new tab to Google), and the .ics is a local blob the user
// saves. No OAuth, no sync, no tokens. These functions are pure so the "only the
// title and date ever go in" guarantee is unit-testable.
// ---------------------------------------------------------------------------

import { addDaysKey } from './time.js'

/** "YYYY-MM-DD" -> "YYYYMMDD" (calendar basic date form). */
function basic(dayKey) {
  return String(dayKey).replaceAll('-', '')
}

/** The task title, trimmed to a plain single line. */
function title(task) {
  return String(task?.text || '').trim()
}

/**
 * A Google Calendar "create event" URL, prefilled with the task title and an
 * all-day span on its due day (end date is exclusive, per Google's format).
 * Only three params ever go in: action, text, dates. Nothing else.
 */
export function googleCalendarUrl(task) {
  const start = basic(task.dueDay)
  const end = basic(addDaysKey(task.dueDay, 1))
  // Build the query by hand so the date range keeps its literal "/" separator
  // (Google wants start/end, not an encoded slash); the title is encoded.
  const query = `action=TEMPLATE&text=${encodeURIComponent(title(task))}&dates=${start}/${end}`
  return `https://calendar.google.com/calendar/render?${query}`
}

// Escape a value for an iCalendar text field (RFC 5545 §3.3.11).
function escapeICS(s) {
  return String(s)
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r?\n/g, '\\n')
}

// A UTC DTSTAMP like 20260819T050000Z. Required by the spec; it's the moment the
// file was made, not any personal data.
function stamp(now) {
  const p = (n) => String(n).padStart(2, '0')
  return `${now.getUTCFullYear()}${p(now.getUTCMonth() + 1)}${p(now.getUTCDate())}`
    + `T${p(now.getUTCHours())}${p(now.getUTCMinutes())}${p(now.getUTCSeconds())}Z`
}

/**
 * The task as an RFC-5545 all-day VEVENT (a .ics file body). Carries only the
 * title (SUMMARY) and the due day (DTSTART/DTEND). CRLF line endings, as the
 * spec wants. `now` is injectable so the output is deterministic in tests.
 */
export function taskICS(task, { now = new Date() } = {}) {
  const start = basic(task.dueDay)
  const end = basic(addDaysKey(task.dueDay, 1))
  const uid = `${task.id || start}@the-rebuild`
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//the-rebuild//tasks//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp(now)}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    `SUMMARY:${escapeICS(title(task))}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return lines.join('\r\n') + '\r\n'
}

/** A friendly, safe filename for the .ics download, e.g. "renew-passport-2026-08-25.ics". */
export function icsFilename(task) {
  const slug = title(task).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
  return `${slug || 'task'}-${task.dueDay}.ics`
}

/**
 * Save the task's .ics as a local file. Pure-DOM, no network — a blob URL the
 * browser downloads. Only called on an explicit tap.
 */
export function downloadTaskICS(task) {
  const blob = new Blob([taskICS(task)], { type: 'text/calendar;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = icsFilename(task)
  a.click()
  URL.revokeObjectURL(url)
}
