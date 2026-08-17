import { SEED_HABITS } from '../seed.js'

// Localized names + 2-minute versions for the built-in seed habits, keyed by
// habit id. Stock habits carry `stock: true` and render their name/minVersion
// through the resolver below, so they follow the language switch live. Custom
// habits (anything the user typed) have no such flag and stay literal forever.
// Only languages present here get localized habits; others fall back to English.
export const SEED_HABIT_L10N = {
  ar: {
    salah: { name: 'الصلاة في وقتها', minVersion: 'صلِّ، حتى المتأخرة تُحتسب' },
    sleep: { name: 'نوم واستيقاظ منتظم', minVersion: 'في السرير في وقتك، الأنوار مطفأة' },
    gym: { name: 'النادي', minVersion: 'اذهب، ١٥ دقيقة' },
    bed: { name: 'رتّب سريرك', minVersion: 'افرد الغطاء' },
    'phone-kitchen': { name: 'الهاتف إلى المطبخ قبل ١٠:٣٠ م', minVersion: 'اشحنه خارج غرفة النوم' },
    'clean-feed': { name: 'موجز نظيف', minVersion: 'أغلق التطبيق وضع الهاتف' },
    'plan-tomorrow': { name: 'خطّط للغد الليلة', minVersion: 'اكتب أهم مهمة للغد' },
    'weekly-plan': { name: 'خطة الأسبوع يوم الأحد', minVersion: 'اكتب ٣ أولويات للأسبوع' },
    read: { name: 'اقرأ ١٠ صفحات', minVersion: 'افتح الكتاب، اقرأ صفحة' },
    quran: { name: 'القرآن يوميًا', minVersion: 'آية واحدة' },
    'no-snooze': { name: 'بلا غفوة', minVersion: 'قدماك على الأرض خلال دقيقة' },
    'no-phone-am': { name: 'بلا هاتف أول ٣٠ دقيقة', minVersion: 'بلا هاتف أول ٥ دقائق' },
    'no-phone-bed': { name: 'بلا هاتف في السرير', minVersion: 'الهاتف يُشحن بعيدًا عبر الغرفة' },
    'deep-work': { name: 'فترة عمل عميق', minVersion: '١٠ دقائق تركيز، نافذة واحدة' },
    water: { name: 'هدف الماء', minVersion: 'كوب كامل الآن' },
    protein: { name: 'البروتين', minVersion: 'حصة بروتين واحدة' },
    walk: { name: 'المشي أيام الراحة', minVersion: 'مشية ٥ دقائق حول الحي' },
    tidy: { name: 'ترتيب ١٠ دقائق', minVersion: 'رتّب سطحًا واحدًا' },
    expenses: { name: 'تتبّع المصاريف', minVersion: 'سجّل مصروفًا واحدًا' },
    'meal-prep': { name: 'تحضير الوجبات يوم الأحد', minVersion: 'حضّر وجبة واحدة للأسبوع' },
    'chore-days': { name: 'حدّد أيام المهام المنزلية', minVersion: 'اختر يوم المهام لهذا الأسبوع' },
    'impulse-48h': { name: 'قاعدة ٤٨ ساعة للشراء', minVersion: 'أضف رغباتك لقائمة، ودعها ٤٨ ساعة' },
    adhkar: { name: 'أذكار الصباح والمساء', minVersion: 'سطر واحد من الأذكار' },
    gratitude: { name: 'امتنان ×٣', minVersion: 'اذكر شيئًا تشكر عليه' },
    journal: { name: 'مذكرة من ٣ أسطر', minVersion: 'سطر واحد' },
    'friend-checkin': { name: 'تفقّد صديق أسبوعيًا', minVersion: 'أرسل رسالة واحدة' },
    fasting: { name: 'صيام الاثنين والخميس', minVersion: 'انوِ الصيام، وتجاوز وجبة خفيفة' },
  },
}

// English base, derived from the seed definitions so there's one source of truth
// for the built-in names. `stockKey` on a habit indexes into this by seed id.
const SEED_EN = Object.fromEntries(SEED_HABITS.map((h) => [h.id, { name: h.name, minVersion: h.minVersion }]))

/** Every shipped language's stock names/min-versions, keyed by seed id. */
export const SEED_HABIT_NAMES = { en: SEED_EN, ar: SEED_HABIT_L10N.ar }

/** Localized { name, minVersion } for a stock habit key, or null if unknown. */
export function stockHabitLabel(key, lang = 'en') {
  return SEED_HABIT_NAMES[lang]?.[key] || SEED_EN[key] || null
}

/**
 * Reverse map of every known stock name in ANY shipped language → seed id. Used
 * by migrate() to decide whether an existing habit is a still-stock built-in
 * (its name matches a shipped one → convert to a key) or a user customization
 * (no match → treat as custom, leave the literal name untouched).
 */
export const STOCK_NAME_TO_KEY = (() => {
  const m = new Map()
  for (const lang of Object.keys(SEED_HABIT_NAMES)) {
    for (const [key, v] of Object.entries(SEED_HABIT_NAMES[lang])) {
      if (v?.name) m.set(v.name, key)
    }
  }
  return m
})()

/** Display name for a habit in `lang`: localized for stock, literal for custom. */
export function habitDisplayName(habit, lang = 'en') {
  if (habit?.stock) {
    const l = stockHabitLabel(habit.stockKey || habit.id, lang)
    if (l) return l.name
  }
  return habit?.name || ''
}

/** Display 2-minute version for a habit in `lang` (localized for stock). */
export function habitDisplayMin(habit, lang = 'en') {
  if (habit?.stock) {
    const l = stockHabitLabel(habit.stockKey || habit.id, lang)
    if (l) return l.minVersion
  }
  return habit?.minVersion || ''
}
