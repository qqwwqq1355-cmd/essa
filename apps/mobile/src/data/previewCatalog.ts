import type { Track } from '@shared/types/track';
import { normalizeArabic } from '@shared/arabic/normalize';
import { getDeterministicPalette } from '@shared/arabic/lyricsParser';

interface SeedItem {
  msgId: number;
  title: string;
  poet: string;
  category: Track['category'];
  durationSec: number;
  fileSizeBytes: number;
  daysAgo: number;
  playCount: number;
  lyrics: string;
}

/**
 * مكتبة معاينة تفاعلية جاهزة للتجربة الفورية في Chrome قبل ربط مفاتيح تليجرام.
 * فور ربط رابط Edge API الخاص بقناة https://t.me/IssaAllaith تُستبدل تلقائياً بالمقاطع الحقيقية من القناة.
 */
const PREVIEW_SEEDS: SeedItem[] = [
  {
    msgId: 5412,
    title: 'صدى الجبال الشامخات',
    poet: 'شعر تراثي يمني (نموذج معاينة)',
    category: 'زوامل',
    durationSec: 42,
    fileSizeBytes: 5_840_000,
    daysAgo: 0,
    playCount: 48200,
    lyrics: `يَا قِمَّةَ المَجْدِ التَّلِيدِ تَكَلَّمِي
وَارْوِي لِأَجْيَالِ الزَّمَانِ مَسِيرَنَا
شُمُّ الجِبَالِ شَهِدْنَ صِدْقَ ثَبَاتِنَا
وَالفَجْرُ يُشْرِقُ مِنْ ضِيَاءِ ضَمِيرِنَا
نَمْضِي عَلَى دَرْبِ الكَرَامَةِ وَالإِبَا
وَالخَيْرُ يَجْرِي فِي مَدَى تَدْبِيرِنَا
صَوْتُ الأصَالَةِ فِي الصُّدُورِ مُخَلَّدٌ
يَحْيَا بِعِزٍّ فِي رُبَى تَارِيخِنَا`,
  },
  {
    msgId: 5408,
    title: 'راية العز والوفاء',
    poet: 'ديوان الأصالة (نموذج معاينة)',
    category: 'زوامل',
    durationSec: 38,
    fileSizeBytes: 5_120_000,
    daysAgo: 1,
    playCount: 39450,
    lyrics: `عَلَى العَهْدِ نَبْقَى لَا نَمِيلُ وَلَا نَلِينْ
وَرَايَاتُنَا فِي الأُفْقِ تَعْلُو بِكُلِّ حِينْ
تَوَارَثَ الأَبْنَاءُ مَجْداً مُؤَثَّلاً
وَعَزْماً يُضِيءُ الدَّرْبَ لِلسَّائِرِينْ
سَلَامٌ عَلَى أَرْضِ الكِرَامِ وَأَهْلِهَا
وَمَنْ صَانَ عَهْداً بِالوَفَاءِ المَتِينْ`,
  },
  {
    msgId: 5395,
    title: 'نسائم الفجر اليماني',
    poet: 'مختارات شعرية (نموذج معاينة)',
    category: 'أناشيد',
    durationSec: 44,
    fileSizeBytes: 6_340_000,
    daysAgo: 2,
    playCount: 61800,
    lyrics: `هَبَّتْ نَسَائِمُ فَجْرِنَا بِالسَّلَامْ
وَأَضَاءَ نُورُ الصُّبْحِ بَعْدَ الظَّلَامْ
فِي كُلِّ وَادٍ مِنْ بِلَادِي صَدَى
يَشْدُو بِحُبِّ الخَيْرِ بَيْنَ الأَنَامْ
يَا مَوْطِنَ الحِكْمَةِ وَأَهْلِ النَّدَى
دُمْتَ المَنَارَ المُسْتَنِيرَ المُقَامْ`,
  },
  {
    msgId: 5381,
    title: 'عهد الأحرار في الميدان',
    poet: 'أبيات مختارة (نموذج معاينة)',
    category: 'قصائد',
    durationSec: 40,
    fileSizeBytes: 5_490_000,
    daysAgo: 4,
    playCount: 28900,
    lyrics: `إِذَا نَادَى المُنَادِي لِلمَعَالِي
أَجَبْنَا بِالعَزِيمَةِ وَالثَّبَاتِ
وَسِرْنَا لَا نُبَالِي بِالصِّعَابِ
وَنَصْنَعُ مِنْ تَحَدِّينَا الحَيَاةِ
فَمَا نَالَ العُلَا إِلَّا كَرِيمٌ
صَبُورٌ فِي الشَّدَائِدِ وَالثَّبَاتِ`,
  },
  {
    msgId: 5360,
    title: 'حادي الركب الأصيل',
    poet: 'تراث شعبي (نموذج معاينة)',
    category: 'تراثية',
    durationSec: 36,
    fileSizeBytes: 4_760_000,
    daysAgo: 6,
    playCount: 52100,
    lyrics: `يَا حَادِيَ الرَّكْبِ المُسَافِرِ فِي المَدَى
رَتِّلْ لَنَا لَحْنَ الكَرَامَةِ وَالهُدَى
مِنْ عَهْدِ أَجْدَادٍ بَنَوْا صَرْحَ العُلَا
مَا زَالَ ذِكْرُهُمُ يُرَدِّدُهُ الصَّدَى
فِي كُلِّ مَجْلِسِ عِزَّةٍ وَمَهَابَةٍ
تَبْقَى المَآثِرُ شَاهِداً طُولَ المَدَى`,
  },
  {
    msgId: 5344,
    title: 'نور الهداية واليقين',
    poet: 'منظومة روحانية (نموذج معاينة)',
    category: 'مناسبات',
    durationSec: 45,
    fileSizeBytes: 6_720_000,
    daysAgo: 9,
    playCount: 34200,
    lyrics: `بِاسْمِ الإِلَهِ نَبْتَدِي كُلَّ الكَلَامْ
وَنَصِلُ المَسِيرَ فِي خَيْرِ نِظَامْ
نُورُ اليَقِينِ فِي القُلُوبِ سَكِينَةٌ
يَجْلُو الهُمُومَ وَيَمْنَحُ النَّفْسَ السَّلَامْ
يَا رَبِّ بَارِكْ خَطْوَنَا وَدِيَارَنَا
وَاجْعَلْ لَنَا فِي كُلِّ خَيْرٍ مُسْتَقَامْ`,
  },
  {
    msgId: 5329,
    title: 'مواكب النور والبشائر',
    poet: 'قصائد المناسبات (نموذج معاينة)',
    category: 'أناشيد',
    durationSec: 39,
    fileSizeBytes: 5_290_000,
    daysAgo: 12,
    playCount: 22600,
    lyrics: `أَقْبَلَتْ بَشَائِرُ الخَيْرِ الكَبِيرْ
وَتَلَأْلَأَ الأُفُقُ البَهِيجُ المُسْتَنِيرْ
مَوْكِبٌ يَمْضِي بِعَزْمٍ صَادِقٍ
نَحْوَ الغَدِ الزَّاهِي وَنَحْوَ المُسْتَطِيرْ
فَابْشِرْ فَإِنَّ الصَّبْرَ مِفْتَاحُ المُنَى
وَالفَجْرُ آتٍ بَعْدَ لَيْلٍ مُسْتَدِيرْ`,
  },
  {
    msgId: 5310,
    title: 'صوت القوافي اليعربية',
    poet: 'شعر فصيح (نموذج معاينة)',
    category: 'قصائد',
    durationSec: 41,
    fileSizeBytes: 5_650_000,
    daysAgo: 16,
    playCount: 41300,
    lyrics: `سَكَبَ القَصِيدُ جَمَالَهُ فِي مَسْمَعِي
فَاهْتَزَّ وَجْدُ القَلْبِ بَيْنَ الأَضْلُعِ
لُغَةُ البَيَانِ إِذَا تَغَنَّى صَوْتُهَا
سَحَرَتْ عُقُولَ السَّامِعِينَ بِمَطْلَعِ
تَبْقَى القَوَافِي فِي الزَّمَانِ رِسَالَةً
تَصِلُ القُلُوبَ بِكُلِّ مَعْنًى مُبْدِعِ`,
  },
];

export function buildPreviewCatalog(): Track[] {
  const now = Date.now();
  return PREVIEW_SEEDS.map((item) => {
    const publishedAt = new Date(now - item.daysAgo * 86_400_000 - 3_600_000).toISOString();
    return {
      id: `preview_${item.msgId}`,
      sourceChannel: 'IssaAllaith',
      sourceMessageId: item.msgId,
      title: item.title,
      titleNormalized: normalizeArabic(item.title),
      poet: item.poet,
      category: item.category,
      durationSec: item.durationSec,
      fileSizeBytes: item.fileSizeBytes,
      mimeType: 'audio/mpeg',
      storageProvider: 'preview',
      coverUrl: null,
      palette: getDeterministicPalette(item.msgId),
      publishedAt,
      updatedAt: publishedAt,
      hasLyrics: true,
      lyrics: item.lyrics,
      lyricsNormalized: normalizeArabic(item.lyrics),
      playCount: item.playCount,
      isDeleted: false,
      isDemoPreview: true,
    };
  });
}

