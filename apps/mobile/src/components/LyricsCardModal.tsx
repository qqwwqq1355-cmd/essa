import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FONTS, RADIUS, type ThemePalette } from '../theme/tokens';
import { useAppStore } from '../store/useAppStore';
import { cleanLyricsLines } from '../utils/lyrics';
import { Icon } from './Icon';

interface LyricsCardModalProps {
  theme: ThemePalette;
}

const CARD_THEMES = [
  { id: 'obsidian', name: 'الذهبي الليلي', bg1: '#151B27', bg2: '#090C12', text: '#F5F7FA', accent: '#E2A84B' },
  { id: 'emerald', name: 'الزمردي', bg1: '#12332C', bg2: '#081815', text: '#F0FAF6', accent: '#3AD49F' },
  { id: 'desert', name: 'التراثي الدافئ', bg1: '#352216', bg2: '#170E09', text: '#FBF4EC', accent: '#F2B863' },
  { id: 'ivory', name: 'الكلاسيكي', bg1: '#FAF7F0', bg2: '#EAE2D2', text: '#1C1915', accent: '#A66F17' },
];

export const LyricsCardModal: React.FC<LyricsCardModalProps> = ({ theme }) => {
  const { lyricsShareTrackId, closeLyricsShare, tracks, showToast } = useAppStore();
  const [selectedStyleIdx, setSelectedStyleIdx] = useState(0);
  const [selectedIndices, setSelectedIndices] = useState<number[]>([0, 1, 2, 3]);

  const track = useMemo(
    () => tracks.find((t) => t.id === lyricsShareTrackId),
    [tracks, lyricsShareTrackId]
  );

  if (!lyricsShareTrackId || !track) return null;

  const lines = cleanLyricsLines(track.lyrics, track.title);

  const activeIndices = selectedIndices.filter((i) => i < lines.length);
  const chosenLines =
    activeIndices.length > 0
      ? activeIndices.sort((a, b) => a - b).map((i) => lines[i])
      : lines.slice(0, 4);

  const cardTheme = CARD_THEMES[selectedStyleIdx];

  const toggleLine = (idx: number) => {
    setSelectedIndices((prev) => {
      if (prev.includes(idx)) {
        return prev.length > 1 ? prev.filter((i) => i !== idx) : prev;
      }
      if (prev.length >= 6) {
        showToast('يمكنك اختيار حتى 6 أبيات كحد أقصى في البطاقة', 'info');
        return prev;
      }
      return [...prev, idx];
    });
  };

  /**
   * يرسم بطاقة شعرية فاخرة بدقة 1080×1350 ويحمّلها كملف PNG جاهز لواتساب وتليجرام
   */
  const handleExportPng = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 1080;
    canvas.height = 1350;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // الخلفية المتدرجة
    const grad = ctx.createLinearGradient(0, 0, 1080, 1350);
    grad.addColorStop(0, cardTheme.bg1);
    grad.addColorStop(1, cardTheme.bg2);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 1080, 1350);

    // إطار زخرفي ناعم
    ctx.strokeStyle = cardTheme.accent;
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 3;
    ctx.strokeRect(54, 54, 972, 1242);
    ctx.globalAlpha = 1;

    // علامة تنصيص زخرفية علوية
    ctx.fillStyle = cardTheme.accent;
    ctx.textAlign = 'center';
    ctx.font = 'bold 90px Amiri, serif';
    ctx.fillText('« »', 540, 210);

    // الأبيات المختارة
    ctx.fillStyle = cardTheme.text;
    ctx.direction = 'rtl';
    ctx.font = 'bold 50px Amiri, serif';
    const startY = 390;
    const lineGap = 112;
    chosenLines.forEach((line, i) => {
      ctx.fillText(line, 540, startY + i * lineGap, 900);
    });

    // خط فاصل ذهبي
    ctx.fillStyle = cardTheme.accent;
    ctx.fillRect(420, 1090, 240, 4);

    // التذييل (اسم المقطع + عيسى الليث)
    ctx.fillStyle = cardTheme.accent;
    ctx.font = 'bold 38px "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText(track.title, 540, 1165, 900);

    ctx.fillStyle = cardTheme.text;
    ctx.globalAlpha = 0.72;
    ctx.font = '500 28px "IBM Plex Sans Arabic", sans-serif';
    ctx.fillText('زوامل عيسى الليث', 540, 1222);

    const dataUrl = canvas.toDataURL('image/png');
    const fileName = `issa-allaith-${track.sourceMessageId}.png`;
    const androidBridge = (
      window as unknown as {
        AndroidBridge?: { saveBase64Png?: (url: string, name: string) => void };
      }
    ).AndroidBridge;

    if (androidBridge?.saveBase64Png) {
      androidBridge.saveBase64Png(dataUrl, fileName);
      showToast('تم حفظ بطاقة الأبيات في معرض الهاتف', 'success');
      return;
    }

    const link = document.createElement('a');
    link.download = fileName;
    link.href = dataUrl;
    link.click();
    showToast('تم حفظ بطاقة الأبيات بجودة عالية (PNG)', 'success');
  };

  return (
    <View style={[styles.backdrop, { backgroundColor: theme.overlay }]}>
      <View style={[styles.sheet, { backgroundColor: theme.bgElevated, borderColor: theme.borderStrong }]}>
        <View style={styles.header}>
          <Text style={[styles.headerTitle, { color: theme.textPrimary }]}>مولّد بطاقة الأبيات</Text>
          <Pressable onPress={closeLyricsShare} style={styles.closeBtn}>
            <Icon name="close" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollBody} showsVerticalScrollIndicator={false}>
          {/* معاينة البطاقة الفاخرة */}
          <View
            style={[
              styles.cardPreview,
              {
                backgroundColor: cardTheme.bg2,
                backgroundImage: `linear-gradient(155deg, ${cardTheme.bg1}, ${cardTheme.bg2})`,
                borderColor: cardTheme.accent,
              },
            ]}
          >
            <Text style={[styles.cardQuoteMark, { color: cardTheme.accent }]}>✦</Text>
            <View style={styles.cardVerses}>
              {chosenLines.map((line, i) => (
                <Text key={i} style={[styles.cardVerseText, { color: cardTheme.text }]}>
                  {line}
                </Text>
              ))}
            </View>
            <View style={[styles.cardDivider, { backgroundColor: cardTheme.accent }]} />
            <Text style={[styles.cardFooterTitle, { color: cardTheme.accent }]}>{track.title}</Text>
            <Text style={[styles.cardFooterSub, { color: cardTheme.text }]}>
              عيسى الليث • @IssaAllaith
            </Text>
          </View>

          {/* اختيار مظهر البطاقة */}
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>اختر تصميم البطاقة:</Text>
          <View style={styles.themeRow}>
            {CARD_THEMES.map((ct, idx) => (
              <Pressable
                key={ct.id}
                onPress={() => setSelectedStyleIdx(idx)}
                style={[
                  styles.themeChip,
                  {
                    backgroundColor: ct.bg1,
                    borderColor: selectedStyleIdx === idx ? ct.accent : theme.border,
                    borderWidth: selectedStyleIdx === idx ? 2 : 1,
                  },
                ]}
              >
                <Text style={[styles.themeChipText, { color: ct.text }]}>{ct.name}</Text>
              </Pressable>
            ))}
          </View>

          {/* اختيار الأبيات */}
          <Text style={[styles.sectionLabel, { color: theme.textSecondary }]}>
            حدّد الأبيات (حتى 6 أسطر):
          </Text>
          <View style={styles.linesPicker}>
            {lines.map((line, idx) => {
              const selected = activeIndices.includes(idx);
              return (
                <Pressable
                  key={idx}
                  onPress={() => toggleLine(idx)}
                  style={[
                    styles.pickLine,
                    {
                      backgroundColor: selected ? theme.accentSoft : theme.surface,
                      borderColor: selected ? theme.accent : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.pickLineText,
                      { color: selected ? theme.accent : theme.textPrimary },
                    ]}
                    numberOfLines={1}
                  >
                    {line}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>

        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <Pressable
            onPress={handleExportPng}
            style={[styles.exportBtn, { backgroundColor: theme.accent }]}
          >
            <Icon name="download" size={18} color={theme.accentText} />
            <Text style={[styles.exportBtnText, { color: theme.accentText }]}>
              حفظ البطاقة كصورة (PNG عالية الدقة)
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 60,
    justifyContent: 'flex-end',
    padding: 10,
  },
  sheet: {
    maxHeight: '92%',
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  headerTitle: {
    fontFamily: FONTS.ui,
    fontSize: 16,
    fontWeight: '700',
  },
  closeBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  scrollBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    gap: 12,
  },
  cardPreview: {
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    paddingHorizontal: 18,
    paddingVertical: 22,
    alignItems: 'center',
    gap: 10,
  },
  cardQuoteMark: {
    fontSize: 18,
  },
  cardVerses: {
    gap: 6,
    alignItems: 'center',
  },
  cardVerseText: {
    fontFamily: FONTS.lyrics,
    fontSize: 18,
    lineHeight: 32,
    textAlign: 'center',
    fontWeight: '700',
  },
  cardDivider: {
    width: 56,
    height: 2,
    borderRadius: 2,
    marginTop: 4,
  },
  cardFooterTitle: {
    fontFamily: FONTS.ui,
    fontSize: 13.5,
    fontWeight: '700',
  },
  cardFooterSub: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    opacity: 0.72,
  },
  sectionLabel: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 4,
  },
  themeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  themeChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
  },
  themeChipText: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: '600',
  },
  linesPicker: {
    gap: 6,
  },
  pickLine: {
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
  },
  pickLineText: {
    fontFamily: FONTS.lyrics,
    fontSize: 15,
  },
  footer: {
    padding: 14,
    borderTopWidth: 1,
  },
  exportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: RADIUS.md,
  },
  exportBtnText: {
    fontFamily: FONTS.ui,
    fontSize: 14,
    fontWeight: '700',
  },
});

