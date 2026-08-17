// English — the base string table and source of truth. Every key that the UI
// uses lives here; other languages overlay on top and fall back to these, so a
// missing translation shows English, never a raw key.
export default {
  // nav
  'nav.today': 'Today',
  'nav.stats': 'Stats',
  'nav.windDown': 'Wind down',
  'nav.settings': 'Settings',
  'nav.private': 'Private',

  // common
  'common.skip': 'Skip',
  'common.next': 'Next',
  'common.back': 'Back',
  'common.gotIt': 'Got it',
  'common.notNow': 'Not now',

  // onboarding
  'ob.brand': 'The Rebuild',
  'ob.pitchTitle': 'Build the person you’re becoming, one rep at a time.',
  'ob.pitch1': 'It’s a habit tracker with one rule that matters. Never miss twice. Miss a day, fine. Just don’t miss the next one. Every habit has a two-minute version, so on a bad day you shrink it instead of skipping it.',
  'ob.pitch2': 'Add one-off tasks alongside your habits, and jot down what you eat. Both sit off to the side and never touch your streaks.',
  'ob.pitch3': 'Everything stays on your device. No account, nothing to sign up for.',
  'ob.getStarted': 'Get started',
  'ob.langTitle': 'Choose your language',
  'ob.langIntro': 'You can change this anytime in Settings.',
  'ob.confirm': 'Continue',
  'ob.anchorsTitle': 'Pick your anchors',
  'ob.anchorsIntro': 'These are the Phase 1 defaults. Keep them, or switch off what doesn’t fit. You can add your own later in Settings.',
  'ob.startClean': 'Continue with a clean slate',
  'ob.startN': 'Continue with {n} {unit}',
  'ob.anchor': 'anchor',
  'ob.anchors': 'anchors',
  'ob.prayerTitle': 'Prayer times',
  'ob.prayerIntro': 'Set your location and the Salah card shows accurate athan times, cached to work offline. You can change it anytime in Settings.',
  'ob.skipForNow': 'Skip for now',

  // prayer names
  'salah.fajr': 'Fajr',
  'salah.dhuhr': 'Dhuhr',
  'salah.asr': 'Asr',
  'salah.maghrib': 'Maghrib',
  'salah.isha': 'Isha',
  'salah.title': 'Salah on time',

  // settings section labels
  'settings.title': 'Settings',
  'settings.appearance': 'Appearance',
  'settings.language': 'Language',
  'settings.system': 'System',
  'settings.replayTour': 'Replay the quick tour',
  'settings.prayerLocation': 'Prayer location',
  'settings.prayerTimes': 'Prayer times',
  'settings.habits': 'Habits',
  'settings.myQuotes': 'My quotes',
  'settings.dayRollover': 'Day rollover',
  'settings.backup': 'Backup & data',
  'settings.langNote': 'More of the app is being translated. Spotted something awkward? Tell Tawfiq.',
}
