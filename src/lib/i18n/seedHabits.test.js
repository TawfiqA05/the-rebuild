import { describe, it, expect } from 'vitest'
import { SEED_HABIT_L10N } from './seedHabits.js'
import { SEED_HABITS } from '../seed.js'

// A new Arabic user shouldn't get any English habit names, so every seed habit
// must have an Arabic name + 2-minute version. If a habit is added to the seed
// without an Arabic entry, this fails.
describe('Arabic seed habits are complete', () => {
  const ar = SEED_HABIT_L10N.ar
  for (const h of SEED_HABITS) {
    it(`${h.id} has an Arabic name + min-version`, () => {
      expect(ar[h.id], `${h.id}`).toBeTruthy()
      expect(ar[h.id].name).toBeTruthy()
      expect(ar[h.id].minVersion).toBeTruthy()
      expect(/[؀-ۿ]/.test(ar[h.id].name), 'name is Arabic').toBe(true)
    })
  }
})
