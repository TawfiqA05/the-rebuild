import { describe, it, expect } from 'vitest'
import { THEMES, contrast, resolveThemeId } from './themes.js'

// A future theme can't ship broken: every palette must clear WCAG AA on the
// text and button combinations the app actually renders. If someone adds a
// theme with a too-light accent or muted ink, this fails.

const AA = 4.5

describe('every theme passes WCAG AA', () => {
  for (const t of THEMES) {
    const p = t.palette
    describe(t.name, () => {
      // Body + secondary text on both the app background and the cards.
      for (const bg of ['ink', 'surface']) {
        it(`fg / muted / faint / accentInk / min / danger on ${bg}`, () => {
          for (const fg of ['fg', 'muted', 'faint', 'accentInk', 'min', 'danger']) {
            expect(contrast(p[fg], p[bg]), `${fg} on ${bg}`).toBeGreaterThanOrEqual(AA)
          }
        })
      }
      it('text/icons on the accent fill (buttons, markers) clear AA', () => {
        expect(contrast(p.onAccent, p.accent), 'onAccent on accent').toBeGreaterThanOrEqual(AA)
      })
      it('the accent fill is distinct from the background (markers read)', () => {
        // not a text ratio, just enough separation to see a filled marker
        expect(contrast(p.accent, p.ink), 'accent vs ink').toBeGreaterThanOrEqual(1.6)
      })
    })
  }
})

describe('system resolves to Ivory/Charcoal, manual overrides', () => {
  it('follows the device for system', () => {
    expect(resolveThemeId('system', false)).toBe('ivory')
    expect(resolveThemeId('system', true)).toBe('charcoal')
    expect(resolveThemeId(undefined, true)).toBe('charcoal')
  })
  it('honours a manual choice regardless of device', () => {
    expect(resolveThemeId('sage', true)).toBe('sage')
    expect(resolveThemeId('midnight', false)).toBe('midnight')
  })
})
