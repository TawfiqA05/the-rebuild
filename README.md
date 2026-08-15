# The Rebuild

A personal, local-first habit tracker that enforces one specific discipline
system — not a generic streak app. Everything runs in your browser; there is no
account, no backend, and no data ever leaves your device (it lives in
`localStorage`, with JSON export/import for backup).

Built with **Vite + React + Tailwind v4**. Dark, mobile-first, installable as a
PWA.

## The system it enforces

The philosophy is baked into the *logic*, not just the copy:

1. **Never miss twice.** One missed day is fine; two consecutive misses is the
   failure state. The app shows them differently — a single miss triggers a
   supportive "don't miss twice" nudge, never a shame spiral.
2. **Shrink it, don't skip it.** Every habit has a 2-minute version. Logging it
   counts as a completion — a *minimum rep* (◐) vs a *full rep* (✓).
3. **No shame spirals.** A miss resets nothing but the consecutive-day count.
   Lifetime totals only ever go up.
4. **Automaticity takes ~60+ days**, so progress is measured over months
   (trailing-21-day phase completion), not 21-day challenges.

### The 5 phases

Habits are grouped into phases you unlock in order:

1. **Anchors** — Salah on time, consistent sleep/wake, gym 3×/week, make bed
2. **Mind & Structure** — plan tomorrow, Sunday plan, read, Quran, no snooze
3. **Body & Focus** — no-phone windows, deep work, water, protein, walk, tidy
4. **Money & Admin** — expenses, meal prep, chore days, 48h impulse rule
5. **Character** — adhkar, gratitude, journal, friend check-in, Mon/Thu fasting

A phase unlocks manually (you decide when it feels automatic). The app *suggests*
unlocking when the current phase is ≥80% complete over the trailing 21 days.

## Run it

Node 18+ is required.

```bash
npm install
npm run dev      # local dev server (prints a URL, open it on your phone too)
npm run build    # production build → dist/
npm run preview  # serve the production build locally
```

Open the printed URL on your phone (same Wi-Fi) and "Add to Home Screen" to use
it as an installable app.

## What's built so far

This was built iteratively. **Done:** the data model + rules engine, and the
**Today** screen (tap targets, Salah 5-prayer card, weekly-frequency progress,
daily score with anchor emojis, at-risk banner, restart protocol, rough-day /
minimum-viable-day). The other tabs (Stats, Evening shutdown, Weekly review,
Private log + urge timer, Settings, reminders) are scaffolded placeholders,
built out in following passes.

## How it's organized

```
src/
  lib/
    time.js     # logical-day math — day rolls over at 3am (configurable)
    seed.js     # the system as data: all phases, habits, 2-min versions
    logic.js    # pure rules engine: streaks, never-miss-twice, phase %, MVD
  store.jsx     # single localStorage-backed state + intent-named actions
  components/   # HabitCard, SalahCard, useLongPress
  screens/      # Today (more to come)
  App.jsx       # shell + bottom nav
public/
  manifest.webmanifest, sw.js, icons   # PWA
```

### Key model decisions

- **Logical days.** A "day" is your wall clock shifted back by the rollover hour
  (default 3am), so a 12:30am check-in still counts as *today*. All logic keys
  off `dayKeyFor()` in `lib/time.js`.
- **One state object**, persisted to `localStorage` on every change and loaded
  through `migrate()` so newly-shipped seed habits merge into old saves.
- **`votes`** (the "who I'm becoming" counter) is a monotonic counter incremented
  on each new completion and never decremented — it only goes up.

## How to add / change things

- **Add or edit a habit's data:** edit `SEED_HABITS` in `src/lib/seed.js`
  (id, emoji, phase, `frequency`, `minVersion`). New entries auto-merge into
  existing saved state via `migrate()`. (A full in-app habit editor lives in
  the upcoming Settings screen.)
- **Change a rule:** the rules are pure functions in `src/lib/logic.js`
  (e.g. `isMVDWin`, `riskSignals`, `phaseProgress`). Change them there and the
  whole UI follows.
- **Change the day-rollover hour:** `settings.dayRolloverHour` (Settings screen,
  or edit the exported JSON).
- **Add a screen:** drop a component in `src/screens/`, add a tab in
  `TABS` in `src/App.jsx`.

## Backup

Settings → Export downloads a JSON snapshot of everything. Import restores it on
any device. That's your whole backup story — no cloud required.

## Deploying (Cloudflare Pages, from a private repo)

The repo stays **private** on GitHub; **Cloudflare Pages** builds and hosts it
for free and redeploys on every push. (This is the free-plan way to keep code
private — GitHub Pages itself needs a paid plan for private repos.)

GitHub Actions runs a **build check** (`.github/workflows/ci.yml`) on every push
so broken builds are caught before Cloudflare deploys.

### One-time Cloudflare setup

1. Push this repo to GitHub (private is fine).
2. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**,
   authorize GitHub, pick this repo.
3. Build settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
   - Node version is pinned to 20 via `.nvmrc`.
4. **Save and Deploy.** Your site goes live at
   `https://<project>.pages.dev` (add a custom domain later if you want).

Every push to the production branch triggers an automatic rebuild + deploy.
To keep the site itself private, use **Cloudflare Access** (Pages → your project
→ Settings → enable Access policy) for email-gated or one-time-PIN login.

Notes:

- The app uses `base: './'` in `vite.config.js`, so it works at any path/domain
  with no extra config.
- No personal data is ever in the repo or on the server — all app data lives in
  your browser's localStorage.
