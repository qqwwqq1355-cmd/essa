import React, { useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { FONTS, RADIUS, type ThemePalette } from '../theme/tokens';
import { useAppStore } from '../store/useAppStore';
import { formatRelativeArabicDate } from '../utils/format';
import { Icon } from '../components/Icon';

interface SettingsScreenProps {
  theme: ThemePalette;
}

const TELEGRAM_CHANNEL_URL =
  import.meta.env.VITE_TELEGRAM_CHANNEL_URL || 'https://t.me/IssaAllaith';

export const SettingsScreen: React.FC<SettingsScreenProps> = ({ theme }) => {
  const {
    apiBaseUrl,
    connectionMode,
    lastSyncAt,
    isSyncing,
    syncError,
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
    setApiBaseUrl,
    syncWithTelegramApi,
    clearAllDownloads,
  } = useAppStore();

  const [urlDraft, setUrlDraft] = useState(apiBaseUrl);

  const handleSaveAndSync = () => {
    setApiBaseUrl(urlDraft);
    void syncWithTelegramApi(urlDraft);
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[styles.heading, { color: theme.textPrimary }]}>الإعدادات والربط</Text>

      {/* بطاقة ربط قناة تليجرام الرسمية */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <View style={styles.cardHeadRow}>
          <View style={styles.rowGap}>
            <View style={[styles.badgeCircle, { backgroundColor: 'rgba(38,165,228,0.16)' }]}>
              <Icon name="telegram" size={18} color="#29A9EB" />
            </View>
            <View>
              <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>
                ربط قناة تليجرام الرسمية
              </Text>
              <Text style={[styles.cardSub, { color: theme.textSecondary }]}>
                https://t.me/IssaAllaith
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
                { color: connectionMode === 'live' ? theme.emerald : theme.accent },
              ]}
            >
              {connectionMode === 'live' ? 'متصل' : 'معاينة'}
            </Text>
          </View>
        </View>

        <Text style={[styles.helpText, { color: theme.textSecondary }]}>
          المزامنة التلقائية تسحب المقاطع والكلمات من القناة العامة عبر محرك الأتمتة وتبثها للتطبيق بأمان عبر Cloudflare Edge API دون تخزين أي مفاتيح سرية داخل التطبيق.
        </Text>

        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: theme.textSecondary }]}>
            رابط طبقة Edge API (Cloudflare Workers):
          </Text>
          <TextInput
            value={urlDraft}
            onChangeText={setUrlDraft}
            placeholder="https://essa-alleth-edge-api.your-name.workers.dev"
            placeholderTextColor={theme.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            style={[
              styles.urlInput,
              {
                backgroundColor: theme.bg,
                borderColor: theme.borderStrong,
                color: theme.textPrimary,
              },
            ]}
          />
        </View>

        {syncError && (
          <Text style={[styles.errorText, { color: theme.danger }]}>{syncError}</Text>
        )}

        <View style={styles.btnRow}>
          <Pressable
            onPress={handleSaveAndSync}
            disabled={isSyncing}
            style={[styles.primaryBtn, { backgroundColor: theme.accent, opacity: isSyncing ? 0.7 : 1 }]}
          >
            <Icon name="sync" size={16} color={theme.accentText} />
            <Text style={[styles.primaryBtnText, { color: theme.accentText }]}>
              {isSyncing ? 'جاري المزامنة...' : 'حفظ ومزامنة الآن'}
            </Text>
          </Pressable>

          <Pressable
            onPress={() => void Linking.openURL(TELEGRAM_CHANNEL_URL)}
            style={[styles.secondaryBtn, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}
          >
            <Icon name="external" size={15} color={theme.textPrimary} />
            <Text style={[styles.secondaryBtnText, { color: theme.textPrimary }]}>فتح القناة</Text>
          </Pressable>
        </View>

        <View style={[styles.statsFooter, { borderTopColor: theme.border }]}>
          <Text style={[styles.statItem, { color: theme.textMuted }]}>
            المقاطع المفهرسة: {tracks.length}
          </Text>
          <Text style={[styles.statItem, { color: theme.textMuted }]}>
            آخر مزامنة: {lastSyncAt ? formatRelativeArabicDate(lastSyncAt) : 'لم تتم بعد'}
          </Text>
        </View>
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
              تنبيه فوري عند نزول مقطع جديد في @IssaAllaith
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

      {/* بطاقة المواصفات الهندسية للتطبيق */}
      <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
        <Text style={[styles.sectionHeading, { color: theme.accent }]}>حول التطبيق والجاهزية</Text>
        <Text style={[styles.aboutLine, { color: theme.textSecondary }]}>
          • البنية: React Native (نقي بدون Expo) + React Native Web (Vite)
        </Text>
        <Text style={[styles.aboutLine, { color: theme.textSecondary }]}>
          • توافق أندرويد المستهدف: Android 7.0 (API 24) حتى Android 15+ (API 35)
        </Text>
        <Text style={[styles.aboutLine, { color: theme.textSecondary }]}>
          • الأمان: صفر مفاتيح سرية داخل التطبيق — بث محمي عبر Cloudflare Workers
        </Text>
        <Text style={[styles.aboutLine, { color: theme.textMuted }]}>الإصدار 1.0.0 — جاهز للربط التجاري</Text>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
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

