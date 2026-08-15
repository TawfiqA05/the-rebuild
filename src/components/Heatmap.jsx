import { useStore } from '../store.jsx'
import { addDaysKey, weekKeyFor } from '../lib/time.js'
import { habitStatusOn, isRequiredOnDay } from '../lib/logic.js'

/**
 * A GitHub-style contribution grid for one habit: columns = weeks, rows = days
 * (Sun→Sat), most recent week on the right.
 *   full rep → emerald
 *   min rep  → amber
 *   scheduled but missed → faint outline (no shame — it's just absence)
 *   not scheduled / future → blank
 */
export default function Heatmap({ habit, weeks = 20 }) {
  const { state, today } = useStore()

  const startSunday = weekKeyFor(addDaysKey(today, -7 * (weeks - 1)))
  const cols = []
  for (let c = 0; c < weeks; c++) {
    const col = []
    for (let r = 0; r < 7; r++) {
      const key = addDaysKey(startSunday, c * 7 + r)
      if (key > today) { col.push({ key, kind: 'future' }); continue }
      const status = habitStatusOn(state, habit, key)
      let kind = 'blank'
      if (status === 'full') kind = 'full'
      else if (status === 'min') kind = 'min'
      else if (isRequiredOnDay(habit, key)) kind = 'miss'
      col.push({ key, kind })
    }
    cols.push(col)
  }

  const cell = {
    full: 'bg-[var(--color-accent)]',
    min: 'bg-[var(--color-min)]',
    miss: 'border border-[var(--color-line)]',
    blank: 'bg-[var(--color-surface-2)]',
    future: 'opacity-0',
  }

  return (
    <div className="flex gap-[3px] overflow-x-auto">
      {cols.map((col, i) => (
        <div key={i} className="flex flex-col gap-[3px]">
          {col.map((d) => (
            <div key={d.key} title={d.key} className={`w-2.5 h-2.5 rounded-[3px] ${cell[d.kind]}`} />
          ))}
        </div>
      ))}
    </div>
  )
}
