import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { FONTS, RADIUS, type ThemePalette } from '../theme/tokens';
import { useAppStore } from '../store/useAppStore';
import { formatRelativeArabicDate } from '../utils/format';
import { Icon } from '../components/Icon';
import { InlineAdSlot } from '../components/InlineAdSlot';

interface SettingsScreenProps {
  theme: ThemePalette;
}

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ theme }) => {
  const {
    connectionMode,
    lastSyncAt,
    isSyncing,
    tracks,
    downloadedIds,
    lyricsFontSize,
    keepScreenAwake,
    notificationsEnabled,
    cacheLimitMb,
    toggleTheme,
    setLyricsFontSize,
    toggleKeepScreenAwake,
    toggleNotifications,
    setCacheLimitMb,
    syncWithTelegramApi,
    clearAllDownloads,
    showToast,
  } = useAppStore();

  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showSupportModal, setShowSupportModal] = useState(false);

  const handleOpenWhatsAppSupport = () => {
    const message = 'مرحبا\nلدي استفسار حول تطبيق زوامل عيسى الليث';
    const url = `https://wa.me/967777310606?text=${encodeURIComponent(message)}`;
    try {
      const opened = window.open(url, '_blank', 'noopener,noreferrer');
      if (!opened) {
        window.location.href = url;
      }
    } catch {
      window.location.href = url;
    }
  };

  const handleShareApp = async () => {
    const text =
      'تطبيق زوامل عيسى الليث — استماع فوري، كلمات القصائد، وحفظ للاستماع بدون إنترنت.\nتطوير م/ هاشم الجائفي';
    try {
      if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
        await navigator.share({ title: 'زوامل عيسى الليث', text });
        return;
      }
      await navigator.clipboard.writeText(text);
      showToast('تم نسخ رسالة مشاركة التطبيق', 'success');
    } catch {
      showToast('تم نسخ رسالة مشاركة التطبيق', 'info');
    }
  };

  const handleRateApp = () => {
    showToast('شكراً لدعمك! سيتم توجيهك لتقييم التطبيق على المتجر عند النشر', 'success');
  };

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
      >
      <Text style={[styles.heading, { color: theme.textPrimary }]}>الإعدادات</Text>

      <InlineAdSlot theme={theme} label="إعلان مموّل • Start.io" />

      {/* بطاقة تحديث المكتبة */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.cardHeadRow}>
          <View style={styles.rowGap}>
            <View style={[styles.badgeCircle, { backgroundColor: theme.accentSoft }]}>
              <Icon name="sync" size={18} color={theme.accent} />
            </View>
            <View>
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                تحديث المكتبة الصوتية
              </Text>
              <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                {tracks.length} زامل متوفر • آخر تحديث: {lastSyncAt ? formatRelativeArabicDate(lastSyncAt) : 'الآن'}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.statusChip,
              { backgroundColor: connectionMode === 'live' ? theme.emeraldSoft : theme.accentSoft },
            ]}
          >
            <Text
              style={[
                styles.statusChipText,
                { color: connectionMode === 'live' ? theme.emerald : theme.danger },
              ]}
            >
              {connectionMode === 'live' ? 'متصل' : 'أوفلاين'}
            </Text>
          </View>
        </View>

        <Pressable
          onPress={() => void syncWithTelegramApi()}
          disabled={isSyncing}
          style={[styles.primaryBtn, { backgroundColor: theme.accent, opacity: isSyncing ? 0.7 : 1 }]}
        >
          <Icon name="sync" size={16} color={theme.accentText} />
          <Text style={[styles.primaryBtnText, { color: theme.accentText }]}>
            {isSyncing ? 'جاري التحقق من الجديد...' : 'التحقق من وجود زوامل جديدة'}
          </Text>
        </Pressable>
      </View>

      {/* المظهر وقراءة الكلمات */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionHeading, { color: theme.accent }]}>المظهر وتجربة القراءة</Text>

        <Pressable onPress={toggleTheme} style={[styles.settingRow, { borderBottomColor: theme.border }]}>
          <View style={styles.settingMeta}>
            <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>المظهر الليلي (AMOLED Dark)</Text>
            <Text style={[styles.settingSub, { color: theme.textSecondary }]}>
              {theme.mode === 'dark' ? 'مفعّل — مريح للعين وموفّر للبطارية' : 'الوضع النهاري مفعّل'}
            </Text>
          </View>
          <View
            style={[
              styles.togglePill,
              { backgroundColor: theme.mode === 'dark' ? theme.accent : theme.borderStrong },
            ]}
          >
            <View
              style={[
                styles.toggleThumb,
                { alignSelf: theme.mode === 'dark' ? 'flex-start' : 'flex-end' },
              ]}
            />
          </View>
        </Pressable>

        <View style={[styles.settingRow, { borderBottomColor: theme.border }]}>
          <View style={styles.settingMeta}>
            <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>
              حجم خط الكلمات ({lyricsFontSize}px)
            </Text>
            <Text style={[styles.settingSub, { color: theme.textSecondary }]}>
              خط أميري عربي واضح لقراءة القصائد والأبيات
            </Text>
          </View>
          <View style={styles.stepper}>
            <Pressable
              onPress={() => setLyricsFontSize(lyricsFontSize - 2)}
              style={[styles.stepBtn, { backgroundColor: theme.surfaceAlt }]}
            >
              <Text style={[styles.stepBtnText, { color: theme.textPrimary }]}>-</Text>
            </Pressable>
            <Pressable
              onPress={() => setLyricsFontSize(lyricsFontSize + 2)}
              style={[styles.stepBtn, { backgroundColor: theme.surfaceAlt }]}
            >
              <Text style={[styles.stepBtnText, { color: theme.textPrimary }]}>+</Text>
            </Pressable>
          </View>
        </View>

        <Pressable onPress={toggleKeepScreenAwake} style={styles.settingRowLast}>
          <View style={styles.settingMeta}>
            <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>إبقاء الشاشة مضاءة مع الكلمات</Text>
            <Text style={[styles.settingSub, { color: theme.textSecondary }]}>
              يمنع إطفاء الشاشة تلقائياً أثناء قراءة القصيدة
            </Text>
          </View>
          <View
            style={[
              styles.togglePill,
              { backgroundColor: keepScreenAwake ? theme.emerald : theme.borderStrong },
            ]}
          >
            <View
              style={[
                styles.toggleThumb,
                { alignSelf: keepScreenAwake ? 'flex-start' : 'flex-end' },
              ]}
            />
          </View>
        </Pressable>
      </View>

      {/* التخزين والإشعارات */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionHeading, { color: theme.accent }]}>التخزين الأوفلاين والإشعارات</Text>

        <View style={[styles.settingRow, { borderBottomColor: theme.border, flexDirection: 'column', alignItems: 'stretch', gap: 8 }]}>
          <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>
            الحد الأقصى لذاكرة التخزين المؤقت (Offline Cache)
          </Text>
          <View style={styles.cacheChips}>
            {[250, 500, 1024].map((mb) => {
              const active = cacheLimitMb === mb;
              return (
                <Pressable
                  key={mb}
                  onPress={() => setCacheLimitMb(mb)}
                  style={[
                    styles.cacheChip,
                    {
                      backgroundColor: active ? theme.accent : theme.surfaceAlt,
                      borderColor: active ? theme.accent : theme.border,
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.cacheChipText,
                      { color: active ? theme.accentText : theme.textPrimary },
                    ]}
                  >
                    {mb === 1024 ? '1 GB' : `${mb} MB`}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable onPress={toggleNotifications} style={[styles.settingRow, { borderBottomColor: theme.border }]}>
          <View style={styles.settingMeta}>
            <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>
              إشعارات المقاطع الجديدة
            </Text>
            <Text style={[styles.settingSub, { color: theme.textSecondary }]}>
              تنبيه فوري عند توفر زامل جديد في المكتبة
            </Text>
          </View>
          <View
            style={[
              styles.togglePill,
              { backgroundColor: notificationsEnabled ? theme.emerald : theme.borderStrong },
            ]}
          >
            <View
              style={[
                styles.toggleThumb,
                { alignSelf: notificationsEnabled ? 'flex-start' : 'flex-end' },
              ]}
            />
          </View>
        </Pressable>

        <Pressable onPress={clearAllDownloads} style={styles.settingRowLast}>
          <View style={styles.settingMeta}>
            <Text style={[styles.settingTitle, { color: theme.danger }]}>
              تنظيف الملفات المحفوظة ({downloadedIds.length} ملف)
            </Text>
            <Text style={[styles.settingSub, { color: theme.textSecondary }]}>
              تحرير مساحة التخزين المحلية مع بقاء الفهرس والمفضلة
            </Text>
          </View>
          <Icon name="trash" size={18} color={theme.danger} />
        </Pressable>
      </View>

      {/* عن التطبيق والخصوصية */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionHeading, { color: theme.accent }]}>حول التطبيق والخصوصية</Text>

        <Pressable
          onPress={() => setShowPrivacyModal(true)}
          style={[styles.settingRow, { borderBottomColor: theme.border }]}
        >
          <View style={styles.settingMeta}>
            <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>سياسة الخصوصية</Text>
            <Text style={[styles.settingSub, { color: theme.textSecondary }]}>
              كيف يحافظ التطبيق على خصوصيتك وبياناتك المحلية
            </Text>
          </View>
          <Icon name="chevron-left" size={18} color={theme.textMuted} />
        </Pressable>

        <Pressable
          onPress={() => void handleShareApp()}
          style={[styles.settingRow, { borderBottomColor: theme.border }]}
        >
          <View style={styles.settingMeta}>
            <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>مشاركة التطبيق</Text>
            <Text style={[styles.settingSub, { color: theme.textSecondary }]}>
              شارك التطبيق مع أصدقائك ومحبي زوامل عيسى الليث
            </Text>
          </View>
          <Icon name="share" size={17} color={theme.accent} />
        </Pressable>

        <Pressable
          onPress={handleRateApp}
          style={[styles.settingRow, { borderBottomColor: theme.border }]}
        >
          <View style={styles.settingMeta}>
            <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>تقييم التطبيق</Text>
            <Text style={[styles.settingSub, { color: theme.textSecondary }]}>
              ادعمنا بتقييمك الإيجابي على متجر التطبيقات
            </Text>
          </View>
          <Icon name="sparkles" size={17} color={theme.accent} />
        </Pressable>

        <Pressable
          onPress={() => setShowSupportModal(true)}
          style={[styles.settingRow, { borderBottomColor: theme.border }]}
        >
          <View style={styles.settingMeta}>
            <Text style={[styles.settingTitle, { color: theme.textPrimary }]}>
              التواصل والإبلاغ عن مشكلة
            </Text>
            <Text style={[styles.settingSub, { color: theme.textSecondary }]}>
              أرسل ملاحظاتك أو تواصل مع فريق الدعم عبر واتساب
            </Text>
          </View>
          <Icon name="chevron-left" size={18} color={theme.textMuted} />
        </Pressable>

        <View style={{ gap: 4, paddingTop: 4 }}>
          <Text style={[styles.aboutLine, { color: theme.textSecondary }]}>
            زوامل عيسى الليث — استماع فوري، كلمات القصائد، وحفظ للاستماع بدون إنترنت.
          </Text>
          <Text style={[styles.aboutLine, { color: theme.textPrimary, fontWeight: '700' }]}>
            تطوير م/ هاشم الجائفي
          </Text>
          <Text style={[styles.aboutLine, { color: theme.textMuted }]}>
            الإصدار 1.0.0 • جميع الحقوق محفوظة © 2026
          </Text>
        </View>
      </View>
      </ScrollView>

      {/* نافذة سياسة الخصوصية المنبثقة وسط الشاشة */}
      {showPrivacyModal && (
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalDialog,
              {
                backgroundColor: theme.surface,
                borderColor: theme.borderStrong,
              },
            ]}
          >
            <View style={styles.cardHeadRow}>
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>سياسة الخصوصية</Text>
              <Pressable onPress={() => setShowPrivacyModal(false)} style={{ padding: 4 }}>
                <Icon name="close" size={18} color={theme.textSecondary} />
              </Pressable>
            </View>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              <Text style={[styles.aboutLine, { color: theme.textSecondary, lineHeight: 22 }]}>
                {`يحترم تطبيق "زوامل عيسى الليث" خصوصية المستخدمين بالكامل:\n\n` +
                  `1. لا يجمع التطبيق أي بيانات شخصية حساسة (مثل الاسم، البريد الإلكتروني، رقم الهاتف، أو الموقع الجغرافي).\n` +
                  `2. يتم حفظ المفضلة، قوائم التشغيل، سجل الاستماع، والملفات المحمّلة للاستماع أوفلاين محلياً على جهازك فقط.\n` +
                  `3. يتصل التطبيق بالخادم فقط لجلب قائمة الزوامل الجديدة وبث أو تحميل المقاطع الصوتية.\n` +
                  `4. يمكنك في أي وقت حذف جميع الملفات المحفوظة وسجل الاستماع من داخل التطبيق بضغطة زر.\n\n` +
                  `تطوير م/ هاشم الجائفي — جميع الحقوق محفوظة © 2026.`}
              </Text>
            </ScrollView>
            <Pressable
              onPress={() => setShowPrivacyModal(false)}
              style={[styles.modalBtn, { backgroundColor: theme.accent }]}
            >
              <Text style={[styles.primaryBtnText, { color: theme.accentText }]}>إغلاق</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* نافذة التواصل وفريق الدعم المنبثقة وسط الشاشة */}
      {showSupportModal && (
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.modalDialog,
              {
                backgroundColor: theme.surface,
                borderColor: theme.borderStrong,
              },
            ]}
          >
            <View style={styles.cardHeadRow}>
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                التواصل وفريق الدعم
              </Text>
              <Pressable onPress={() => setShowSupportModal(false)} style={{ padding: 4 }}>
                <Icon name="close" size={18} color={theme.textSecondary} />
              </Pressable>
            </View>

            <Text style={[styles.aboutLine, { color: theme.textSecondary, lineHeight: 22 }]}>
              هل لديك استفسار، اقتراح، أو واجهت أي مشكلة في تطبيق زوامل عيسى الليث؟ يمكنك مراسلة فريق الدعم مباشرة عبر واتساب.
            </Text>

            <Pressable
              onPress={handleOpenWhatsAppSupport}
              style={[styles.modalBtn, { backgroundColor: '#25D366' }]}
            >
              <Icon name="external" size={16} color="#FFFFFF" />
              <Text style={[styles.primaryBtnText, { color: '#FFFFFF' }]}>
                مراسلة فريق الدعم الآن (واتساب)
              </Text>
            </Pressable>

            <Pressable
              onPress={() => setShowSupportModal(false)}
              style={[
                styles.modalBtn,
                { backgroundColor: theme.surfaceAlt, borderColor: theme.border, borderWidth: 1 },
              ]}
            >
              <Text style={[styles.secondaryBtnText, { color: theme.textPrimary }]}>إغلاق</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
  },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 90,
    backgroundColor: 'rgba(0, 0, 0, 0.68)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  modalDialog: {
    width: '100%',
    maxWidth: 340,
    maxHeight: '80%',
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 18,
    gap: 12,
  },
  modalScroll: {
    maxHeight: 280,
  },
  modalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
    paddingVertical: 11,
    borderRadius: RADIUS.md,
    width: '100%',
  },
  scroll: {
    flex: 1,
    minHeight: 0,
  },
  container: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 28,
    gap: 14,
  },
  heading: {
    fontFamily: FONTS.ui,
    fontSize: 21,
    fontWeight: '700',
  },
  card: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 15,
    gap: 12,
  },
  cardHeadRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
  },
  rowGap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  badgeCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTitle: {
    fontFamily: FONTS.ui,
    fontSize: 14.5,
    fontWeight: '700',
  },
  cardSub: {
    fontFamily: FONTS.ui,
    fontSize: 11.5,
  },
  statusChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  statusChipText: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    fontWeight: '700',
  },
  helpText: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    lineHeight: 20,
  },
  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: '600',
  },
  urlInput: {
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 9,
    fontFamily: FONTS.ui,
    fontSize: 12.5,
    textAlign: 'left',
  },
  errorText: {
    fontFamily: FONTS.ui,
    fontSize: 12,
  },
  btnRow: {
    flexDirection: 'row',
    gap: 8,
  },
  primaryBtn: {
    flex: 1.4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
  },
  primaryBtnText: {
    fontFamily: FONTS.ui,
    fontSize: 13,
    fontWeight: '700',
  },
  secondaryBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
  },
  secondaryBtnText: {
    fontFamily: FONTS.ui,
    fontSize: 12.5,
    fontWeight: '600',
  },
  statsFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    paddingTop: 10,
  },
  statItem: {
    fontFamily: FONTS.ui,
    fontSize: 11.5,
  },
  sectionHeading: {
    fontFamily: FONTS.ui,
    fontSize: 12.5,
    fontWeight: '700',
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingBottom: 12,
    borderBottomWidth: 1,
    gap: 10,
  },
  settingRowLast: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  settingMeta: {
    flex: 1,
    gap: 2,
  },
  settingTitle: {
    fontFamily: FONTS.ui,
    fontSize: 13.5,
    fontWeight: '600',
  },
  settingSub: {
    fontFamily: FONTS.ui,
    fontSize: 11.5,
  },
  togglePill: {
    width: 44,
    height: 25,
    borderRadius: 13,
    padding: 3,
    justifyContent: 'center',
  },
  toggleThumb: {
    width: 19,
    height: 19,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  stepper: {
    flexDirection: 'row',
    gap: 6,
  },
  stepBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepBtnText: {
    fontSize: 17,
    fontWeight: '700',
  },
  cacheChips: {
    flexDirection: 'row',
    gap: 8,
  },
  cacheChip: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: RADIUS.sm,
    borderWidth: 1,
    alignItems: 'center',
  },
  cacheChipText: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: '700',
  },
  aboutLine: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    lineHeight: 20,
  },
});

