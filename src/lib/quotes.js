// ---------------------------------------------------------------------------
// quotes.js — the curated pool for the Daily anchor.
//
// Ground rules for this list (see the Daily-anchor feature):
//   • No invented or paraphrased quotes. Every line is verifiable.
//   • Scripture is quoted EXACTLY. Qur'an ayat use the Sahih International
//     wording with a precise Surah:Ayah citation. Hadith are quoted in a
//     standard translation with the collection cited — and only the few that
//     are firmly established. When in doubt, we include fewer, never more.
//   • Secular quotes carry their correct attribution. Note the "excellence is a
//     habit" line is credited to Will Durant, who wrote it while summarising
//     Aristotle — it is not a direct Aristotle quote, and we don't pretend it is.
//
// This is the *only* place to add general wisdom. The user's own additions
// ("My quotes" in Settings) are merged into the same pool at runtime.
// ---------------------------------------------------------------------------

export const CURATED = [
  // --- Qur'an (English: Sahih International; Arabic: the exact ayah) -------
  { text: 'Indeed, with hardship [will be] ease.', author: 'Qur’an 94:6',
    ar: 'إِنَّ مَعَ الْعُسْرِ يُسْرًا', arAuthor: 'القرآن ٩٤:٦' },
  { text: 'Indeed, Allah is with the patient.', author: 'Qur’an 2:153',
    ar: 'إِنَّ اللَّهَ مَعَ الصَّابِرِينَ', arAuthor: 'القرآن ٢:١٥٣' },
  { text: 'Allah does not charge a soul except [with that within] its capacity.', author: 'Qur’an 2:286',
    ar: 'لَا يُكَلِّفُ اللَّهُ نَفْسًا إِلَّا وُسْعَهَا', arAuthor: 'القرآن ٢:٢٨٦' },
  { text: 'So be patient. Indeed, the promise of Allah is truth.', author: 'Qur’an 30:60',
    ar: 'فَاصْبِرْ إِنَّ وَعْدَ اللَّهِ حَقٌّ', arAuthor: 'القرآن ٣٠:٦٠' },
  { text: 'And whoever fears Allah — He will make for him a way out.', author: 'Qur’an 65:2',
    ar: 'وَمَن يَتَّقِ اللَّهَ يَجْعَل لَّهُ مَخْرَجًا', arAuthor: 'القرآن ٦٥:٢' },

  // --- Hadith (well-established; Arabic is the original wording) -----------
  { text: 'The most beloved of deeds to Allah are those done regularly, even if they are few.', author: 'Prophet Muhammad ﷺ · Bukhari & Muslim',
    ar: 'أَحَبُّ الأَعْمَالِ إِلَى اللَّهِ أَدْوَمُهَا وَإِنْ قَلَّ', arAuthor: 'النبي ﷺ · البخاري ومسلم' },
  { text: 'The strong man is not the one who overcomes others by his strength, but the one who controls himself when angry.', author: 'Prophet Muhammad ﷺ · Bukhari & Muslim',
    ar: 'لَيْسَ الشَّدِيدُ بِالصُّرَعَةِ، إِنَّمَا الشَّدِيدُ الَّذِي يَمْلِكُ نَفْسَهُ عِنْدَ الْغَضَبِ', arAuthor: 'النبي ﷺ · البخاري ومسلم' },

  // --- Stoics --------------------------------------------------------------
  { text: 'We suffer more often in imagination than in reality.', author: 'Seneca' },
  { text: 'It is not that we have a short time to live, but that we waste a lot of it.', author: 'Seneca' },
  { text: 'The impediment to action advances action. What stands in the way becomes the way.', author: 'Marcus Aurelius' },
  { text: 'Waste no more time arguing about what a good man should be. Be one.', author: 'Marcus Aurelius' },
  { text: 'If it is not right, do not do it; if it is not true, do not say it.', author: 'Marcus Aurelius' },
  { text: 'First say to yourself what you would be; and then do what you have to do.', author: 'Epictetus' },
  { text: 'No man is free who is not master of himself.', author: 'Epictetus' },
  { text: 'How long are you going to wait before you demand the best for yourself?', author: 'Epictetus' },

  // --- Philosophers --------------------------------------------------------
  { text: 'He who has a why to live can bear almost any how.', author: 'Friedrich Nietzsche' },
  { text: 'That which does not kill us makes us stronger.', author: 'Friedrich Nietzsche' },
  { text: 'Knowing is not enough; we must apply. Willing is not enough; we must do.', author: 'Johann Wolfgang von Goethe' },

  // --- Athletes & coaches --------------------------------------------------
  { text: 'I’ve failed over and over and over again in my life. And that is why I succeed.', author: 'Michael Jordan' },
  { text: 'You miss 100% of the shots you don’t take.', author: 'Wayne Gretzky' },
  { text: 'Everybody has a plan until they get punched in the mouth.', author: 'Mike Tyson' },
  { text: 'It’s not whether you get knocked down; it’s whether you get up.', author: 'Vince Lombardi' },
  { text: 'Make each day your masterpiece.', author: 'John Wooden' },
  { text: 'Nothing in the world is worth having or worth doing unless it means effort, pain, difficulty.', author: 'Theodore Roosevelt' },

  // --- Resolve -------------------------------------------------------------
  { text: 'Courage is not the absence of fear, but the triumph over it.', author: 'Nelson Mandela' },
  { text: 'It always seems impossible until it’s done.', author: 'Nelson Mandela' },
  { text: 'Do not pray for an easy life; pray for the strength to endure a difficult one.', author: 'Bruce Lee' },

  // --- Habits & systems ----------------------------------------------------
  { text: 'Every action you take is a vote for the type of person you wish to become.', author: 'James Clear' },
  { text: 'You do not rise to the level of your goals. You fall to the level of your systems.', author: 'James Clear' },
  { text: 'Habits are the compound interest of self-improvement.', author: 'James Clear' },
  { text: 'Discipline equals freedom.', author: 'Jocko Willink' },
  { text: 'We are what we repeatedly do. Excellence, then, is not an act, but a habit.', author: 'Will Durant (on Aristotle)' },

  // --- Proverbs & persistence ---------------------------------------------
  { text: 'Fall seven times, stand up eight.', author: 'Japanese proverb' },
  { text: 'A journey of a thousand miles begins with a single step.', author: 'Lao Tzu' },
  { text: 'The best time to plant a tree was twenty years ago. The second best time is now.', author: 'Proverb' },
  { text: 'Energy and persistence conquer all things.', author: 'Benjamin Franklin' },
  { text: 'Well done is better than well said.', author: 'Benjamin Franklin' },
  { text: 'Success is the sum of small efforts, repeated day in and day out.', author: 'Robert Collier' },
  { text: 'Perseverance is not a long race; it is many short races one after another.', author: 'Walter Elliot' },
  { text: 'Little by little, one walks far.', author: 'Peruvian proverb' },
]
