# Session report — 2026-08-19

Everything below shipped to `main` and deployed via CI (Cloudflare Pages), one
feature at a time. Each PR passed CI, and each merge re-ran `npm test` +
`npm run e2e` + build before publishing. All runs green. Hashes are the deployed
(squash) commits on `main`.

Test suite now: **232 unit tests** + **11 E2E checks**.

## Shipped

| # | Commit | What |
|---|--------|------|
| 1 | `1a59a98` | **Task archive.** Completed tasks stay crossed out for the day, then sweep into an Archive after the 3am rollover instead of vanishing; deleting a task moves it there too (undo toast still the instant path). The Archive sits behind a quiet "Archived" link at the bottom of the Tasks card: searchable, newest first, each entry tagged completed vs deleted with its date, with **Bring back** (revives it open, due today) and **Delete forever** (also undoable). Anything archived over 90 days auto-purges on the next rollover. Rides in the backup export/import; zero effect on score, streaks, or votes. Stats now counts finished tasks across the live list AND the archive, so the lifetime number never drops. Toast now shows Undo only when there's something to undo. EN + AR, RTL verified. Tests: complete→archive→revive, delete→undo and →revive, 90-day purge, search/order, archive-aware count, backup round-trip. |
| 2 | `5ef439a` | **Food suggestions collapse.** Reproduced first: with a long history the frequent-food chips stacked into a multi-line wall that pushed the log down. Now they live behind one quiet "Suggestions" row that expands on tap into a short, self-scrolling list (bounded height, scrolls past a handful) and collapses again the moment you pick one (which logs it to today). Verified at 390px in EN and AR/RTL with a long history. |
| 3 | `708dc01` | **Add-to-calendar for tasks (no account).** Every open task gets a small calendar action revealing two on-device options built from the title + due day only: a prefilled **Google Calendar** link (new tab) and a downloadable **.ics** (all-day VEVENT, opens in Apple Calendar or any other). No OAuth, sync, or tokens. Nothing leaves the device until a tap, and only the title/date travel. New network-privacy E2E: opens the options and saves the .ics, asserts the action adds zero requests (not even to Google, which only fires on a real click) and that nothing the app requests carries the task title or other state. EN + AR, RTL verified. Unit tests cover the link shape, .ics body + escaping, filename, and no-leak. |

---

# Session report — 2026-08-17

Everything below shipped to `main` and deployed via CI (Cloudflare Pages). Each
deploy ran `npm test` + `npm run e2e` + build before publishing; all runs are
green. Hashes are the deployed commits.

## Shipped

| # | Commit | What |
|---|--------|------|
| 1 | `23341cc` | **Share sheet fits the viewport.** Root cause was a containing-block trap: screens keep a lingering `animate-rise` transform, so the sheet's `fixed inset-0` anchored to the tall page, not the viewport. Fixed by portaling the sheet to `<body>` and rebuilding it as a fixed-height flex column (scaled preview, pinned buttons, safe-area inset). Added the headless viewport-fit E2E. |
| 2 | `d38f50e` | **Inclusive onboarding.** New early "Include Islamic practices? Yes/No" step, changeable in Settings. No = clean secular app (no Salah card, no fast, universal-only anchor, prayer setup hidden). Visibility-only, reversible. Existing devices default to Yes and never see the step. Rides in the backup. EN + AR. |
| 3 | `cd1f6f6` | **Portaled DayEditor** (the "fix a past day" sheet) — same containing-block bug — and extended the E2E to open it and assert it fits. |
| 4 | `7ba5e19` | **Localized stock habit names.** Built-in habits store an i18n key and follow the language live; custom habits stay literal. Migration converts by matching the saved name against shipped stock names (any language); renamed/custom habits are left untouched. Ids never change, so streaks/history/stats survive (tested). |
| 5 | `72e36c0` | **Moved the Daily anchor** back under the score card, above the habits, and pinned its DOM position in the E2E. |
| 6 | `252572f` | **Central faith-content registry** (`src/lib/faith.js`) — closes the whole toggle-leak class (adhkar and Quran were still showing in No mode). The toggle reads only the registry; also gated the "make wudu" urge prompt and the Settings habit manager. Definitive E2E: renders every screen in No mode on fresh + legacy profiles and fails if any Islamic term leaks. |
| 7 | `9fc06b0` | **Accessibility pass.** Habit rings announce state + `aria-pressed`; decorative anchor row hidden from readers; share/day-fix sheets are proper dialogs (role, aria-modal, focus-on-open, Escape); labelled the prayer-nudge buttons; reduced-motion now clamps transitions + tap-scale. PWA nits: re-enabled pinch-zoom, added manifest `id`/`lang`/`dir`. |
| 8 | `7ee2150` | **Versioned backup envelope** (`schemaVersion` + `exportedAt` + state); import unwraps any envelope or a legacy bare-state export, then migrates. Tested with a synthetic old-format file. Plus coverage-gap tests (migrate PIN-clear branch, 3am rollover during an open session, faith-toggle edge). |
| 9 | `ce0404e` | **Removed the BigDataCloud reverse-geocode** (audit follow-up). "Use my location" now stores raw coords and queries AlAdhan by lat/long directly; the label is a local "Current location" with an optional user-typed city. The only outbound request carrying location is now the prayer-times call itself. E2E grants a mock geolocation and fails if any reverse geocoder is contacted. AUDIT.md §E updated. |
| 10 | `408e202` | **Interactive learn-by-doing tutorial** (replaces the slideshow tour). A throwaway "practice" habit card teaches the real gestures — tap → full, hold → 2-minute ◐, tap → undo — advancing only when each gesture happens, then points at the score / never-miss-twice / nav. A portal-to-body spotlight dims the rest with a cutout. The practice state is entirely local, so it leaves no votes/logs/streaks/backup trace. EN + AR (RTL verified), every theme, reduced-motion respected; legacy devices never see it; "Replay tutorial" in Settings. E2E covers the flow, no-trace, portal/fit, RTL, reduced-motion, and legacy-skip. |

Test suite: **215 unit tests** + **10 E2E checks**, all green.

## QA sweep (item 5) — result: clean

Walked every screen at 390px across language (EN/AR) × theme (Ivory/Charcoal) ×
profile (fresh-data / simulated legacy) with a headless harness: no console
errors, no thrown errors, no leaked i18n keys, no blank screens. Verified both
onboarding faith paths complete to Today with the tour and correct Salah
visibility, and the Private-tab reveal (5 version taps → 🔒 tab). No
test-guarded issues found to fix on the spot.

## Perf + PWA audit (item 6)

- **Throttled load (Fast 3G + 4× CPU):** DOMContentLoaded ~1.05s, app
  interactive ~1.66s. Healthy for the profile.
- **Initial payload (gzip):** JS 94 KB + CSS 7.7 KB ≈ **102 KB**. Arabic string
  table is lazy-loaded (7.6 KB, only when Arabic is active).
- **Service worker:** correctly avoids stale cache after deploys — navigations
  are network-first (fresh HTML), and built assets are content-fingerprinted, so
  a new deploy's `index.html` pulls the new files. Manifest is complete;
  registered PROD-only.
- **No critical cheap win** that was also behavior-safe. Folded two tiny fixes
  into the a11y commit (pinch-zoom, manifest `id`). Remaining items are reported,
  not fixed (see Known limitations in the README).

## npm audit (item 9)

`npm audit`: **0 vulnerabilities.** Nothing auto-fixable. See decisions below for
the major-version upgrades (left alone per the no-major-bumps rule).

## Skipped / not done (and why)

- **Web-notification reminders** — still not built (out of scope for today; the
  SW has stubs noted). Pre-existing gap, now documented in the README.
- **Deleting the old dark-theme screenshots** (`today.png`, `stats.png`,
  `onboarding.png`) — left in place; the README now points at the new
  light/Arabic set. Harmless; say the word and I'll remove them.
- **A full functional E2E** — the E2E guards layout + the no-leak rule, not every
  interaction. Deliberate scope.

## Needs your decision

1. **Major dependency upgrades.** All current deps are one major behind by
   choice and have no known vulnerabilities: **React 18 → 19**, **Vite 6 → 8**,
   **@vitejs/plugin-react 4 → 6**. React 19 in particular is a real migration
   (it's not a drop-in). I did not touch these. Want me to take any of them, on a
   branch, behind CI?
2. **Old screenshots** — delete `today.png` / `stats.png` / `onboarding.png`, or
   keep them?
3. **Reminders** — if you want push/local notifications next, that's the biggest
   unbuilt feature and needs a product call on timing/copy.
