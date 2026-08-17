# Estate audit — 2026-08-17 (read-only)

Verification only; nothing was changed to produce this. Scope: `the-rebuild`
plus the local sibling repos `block-time-planner`, `Command-Center`, `waypoint`.
(`deal-scout` is linked from the profile but not cloned locally — see gaps.)

---

## A. the-rebuild: deploy integrity — **PASS** (one flag)

- **Working tree clean; HEAD == origin/main** (`2fe8274`). No uncommitted changes.
- **Production matches HEAD.** The live `index.html` references
  `assets/index-j_IFAsCO.js`, identical to the local production build. The last
  commit (`2fe8274`) is docs/screenshots only, so the bundle is unchanged from
  the last code build (`7ee2150`).
- **Service worker serves the latest build.** Navigations are network-first
  (fresh HTML) and assets are content-fingerprinted, so a new deploy's HTML pulls
  the new files. Old caches are purged on activate by cache-name.
- **CI: all green.** Every run today is `success`; the deploy pipeline gates on
  `npm test` + `npm run e2e` + build before publishing.
- 🚩 **Flag: the site is publicly reachable** (`https://the-rebuild.pages.dev`
  returns 200, no login). Session notes said Cloudflare Access was enabled; it
  appears off now. Low data-risk (the app keeps nothing server-side), but it
  contradicts the "keep the site private" intent — re-enable Access if that still
  holds.

## B. Secrets hygiene — **FLAG** (one real item)

- **the-rebuild:** clean. No `.env`/key files tracked, nothing key-shaped in full
  history, no PIN/token/personal data. (The PIN only ever exists as a salted hash
  in the browser at runtime — never in the repo.)
- **waypoint:** clean. API keys are referenced by name only (Vercel env vars),
  never committed.
- **block-time-planner:** clean. The one history hit (`password" value={pw}`) was
  a `<input type="password">` form field, not a credential; it's gone from the
  current tree.
- 🚩 **Command-Center:** a **Firebase web config is committed in `index.html`**
  (`apiKey: "AIzaSyDx…"`, `projectId: command-center-83640`). A Firebase web
  `apiKey` is *public by design* — but it only stays safe if the **Firestore
  security rules are locked down**. I can't see the rules from here. If they're
  open (`allow read, write: if true`), anyone with this config can read/write the
  database. **Verify the rules.** (No `.env` ignore rule exists in any of the four
  repos — none have an `.env`, but adding the rule is cheap prevention.)

## C. Portfolio links — **PASS**

- **Demo sites all 200 and render:** `block-time-planner-two.vercel.app`
  ("block·time — daily planner"), `waypoint-theta.vercel.app` ("Waypoint —
  travel dossiers"), `the-rebuild.pages.dev` ("The Rebuild").
- **Profile README links resolve:** the three repo links
  (`block-time-planner`, `waypoint`, `deal-scout`) all return 200; the two demo
  links are the ones above. LinkedIn returns 999 (LinkedIn blocks non-browser
  clients — not a broken link, just not machine-verifiable).
- Note: `Command-Center` is 404 on the public API (private/renamed) but it isn't
  linked from the profile README, so it's not a broken public link.

## D. Pipeline coherence — **PASS**

Both workflows are consistent and correctly ordered, with no duplicate steps:

- `deploy.yml` (push to main): checkout → Node 20 → `npm ci` → **test** →
  **build** → install Playwright Chromium → **viewport-fit E2E** → deploy. Every
  quality gate runs before the deploy step, so a red test or E2E blocks the ship.
- `ci.yml` (PRs / manual): the same chain minus the deploy step.
- The E2E is wired in (`node scripts/e2e/viewport.mjs`) and reuses the build
  output (no double build).

## E. Data promises — **PASS**

**The localStorage claim holds for app data:** habit logs, journal, food log,
the private log, the PIN, and votes are never sent anywhere. Every outbound
request the app can make:

| Destination | When | Payload | App data? |
|---|---|---|---|
| `fonts.googleapis.com` / `fonts.gstatic.com` | every load | font request + IP | no |
| `api.aladhan.com` | prayer times (Islamic layer on + location set) | location (coords or address) + year/month | no — location only |
| `navigator.share` | user taps Share | the week card PNG + text (habits/streaks + typed line) | habits only — never private/food |

- **Update (2026-08-17):** the BigDataCloud reverse-geocode call has been
  **removed**. "Use my location" now stores the raw
  coordinates and queries AlAdhan by lat/long directly (AlAdhan takes coordinates
  natively), and the display label is a purely local string ("Current location",
  or one the user types). So the **only** outbound request carrying location is
  now the prayer-times call the feature requires. A CI E2E asserts this: it grants
  a mock geolocation, taps "use my location", and fails if any reverse geocoder is
  contacted or if AlAdhan isn't queried by coordinates.
- With **Islamic practices off**, the prayer-times and geolocation calls don't
  happen at all — only Google Fonts remains.
- `navigator.share` hands data to the OS share sheet (user-initiated), and
  `share.js` reads only habits, so the private and food logs can't leak into a
  share. Confirmed in code + a unit test.

## F. TODO / FIXME / REVIEW markers — **PASS**

- **0** `TODO` / `FIXME` / `HACK` / `XXX` markers in `src` or `scripts`.
- **13** `// REVIEW:` notes, all in `src/lib/i18n/ar.js` — deliberate
  translation-quality flags the author left on Arabic phrasings they weren't sure
  about (coined jargon like "minimum viable day", plural agreement with `{n}`,
  "votes for who I'm becoming"). Not bugs; a translation-review checklist.

---

## Top 5 things that most deserve your attention next

1. **Verify Command-Center's Firestore security rules.** The Firebase config is
   committed (fine on its own), but if the rules are permissive the database is
   effectively world-readable/writable. This is the only finding with real blast
   radius.
2. **Decide whether the-rebuild should be public.** It's serving to the open
   internet now; if you wanted Access-gated, it isn't. Low data-risk, but it's a
   stated-intent mismatch you should resolve deliberately.
3. ~~**Disclose (or drop) the BigDataCloud reverse-geocode call.**~~ **Done** —
   the call was removed; coordinates now go only to AlAdhan, guarded by a CI test.
4. **Finish secrets hygiene on `deal-scout`.** It's linked from your profile but
   wasn't cloned here, so its history is unscanned. Clone + scan it the same way,
   and add an `.env` ignore rule across the repos as cheap prevention.
5. **Schedule the two known tech-debt items** in the-rebuild: SW runtime-cache
   bloat (grows across deploys; correctness is fine) and the still-unbuilt
   reminders. Neither is urgent, but they're the real remaining backlog.
