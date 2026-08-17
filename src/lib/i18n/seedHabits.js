// Localized names + 2-minute versions for the built-in seed habits, keyed by
// habit id. Applied ONCE at onboarding for the chosen language (see
// store.finishOnboarding). Existing devices keep whatever names they already
// have. Only languages present here get localized habits; others stay English.
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
