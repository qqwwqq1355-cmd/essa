import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FONTS, RADIUS, type ThemePalette } from '../theme/tokens';
import { Icon } from './Icon';

interface WebDeviceFrameProps {
  theme: ThemePalette;
  connectionMode: 'live' | 'offline';
  onToggleTheme: () => void;
  children: React.ReactNode;
}

type ViewportPreset = 'compact' | 'standard' | 'large' | 'full';

const PRESETS: Record<ViewportPreset, { label: string; width: number; height: number }> = {
  compact: { label: 'Android 7 (360px)', width: 360, height: 740 },
  standard: { label: 'قياسي (392px)', width: 392, height: 830 },
  large: { label: 'كبير (430px)', width: 430, height: 880 },
  full: { label: 'ملء الشاشة', width: 0, height: 0 },
};

/**
 * غلاف محاكي متصفح Chrome الذكي:
 * - على شاشات سطح المكتب (> 540px): يعرض التطبيق داخل إطار هاتف أنيق مع أزرار تبديل المقاس (من Android 7 الاقتصادي إلى الشاشات الكبيرة)
 * - عند فتح Chrome DevTools Mobile Emulator أو شاشة هاتف حقيقية (<= 540px): يختفي الإطار تلقائياً ويملأ التطبيق الشاشة 100%
 */
export const WebDeviceFrame: React.FC<WebDeviceFrameProps> = ({
  theme,
  connectionMode,
  onToggleTheme,
  children,
}) => {
  const [winWidth, setWinWidth] = useState(
    typeof window !== 'undefined' ? window.innerWidth : 1280
  );
  const [preset, setPreset] = useState<ViewportPreset>('standard');

  useEffect(() => {
    const onResize = () => setWinWidth(window.innerWidth);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isNativeViewport = winWidth <= 540 || preset === 'full';

  if (isNativeViewport) {
    return (
      <View style={[styles.fullRoot, { backgroundColor: theme.bg }]}>
        {preset === 'full' && winWidth > 540 && (
          <Pressable
            onPress={() => setPreset('standard')}
            style={[styles.exitFullPill, { backgroundColor: theme.surfaceGlass, borderColor: theme.borderStrong }]}
          >
            <Icon name="phone" size={14} color={theme.accent} />
            <Text style={[styles.exitFullText, { color: theme.textPrimary }]}>إطار الهاتف</Text>
          </Pressable>
        )}
        {children}
      </View>
    );
  }

  const dims = PRESETS[preset];

  return (
    <View
      style={[
        styles.desktopCanvas,
        {
          backgroundColor: theme.mode === 'dark' ? '#05070B' : '#E7ECF3',
          backgroundImage:
            theme.mode === 'dark'
              ? 'radial-gradient(circle at 20% 20%, rgba(226,168,75,0.09), transparent 40%), radial-gradient(circle at 80% 80%, rgba(46,196,146,0.08), transparent 42%)'
              : 'radial-gradient(circle at 20% 20%, rgba(184,122,24,0.08), transparent 45%)',
        },
      ]}
    >
      {/* شريط أدوات محاكي Chrome العلوي */}
      <View
        style={[
          styles.simBar,
          {
            backgroundColor: theme.surfaceGlass,
            borderColor: theme.border,
          },
        ]}
      >
        <View style={styles.simLeft}>
          <Icon name="phone" size={16} color={theme.accent} />
          <Text style={[styles.simTitle, { color: theme.textPrimary }]}>
            محاكي React Native — مكتبة عيسى الليث
          </Text>
          <View
            style={[
              styles.modeBadge,
              {
                backgroundColor:
                  connectionMode === 'live' ? theme.emeraldSoft : theme.accentSoft,
              },
            ]}
          >
            <Text
              style={[
                styles.modeBadgeText,
                { color: connectionMode === 'live' ? theme.emerald : theme.danger },
              ]}
            >
              {connectionMode === 'live' ? 'متصل بـ @IssaAllaith' : 'وضع أوفلاين'}
            </Text>
          </View>
        </View>

        <View style={styles.simRight}>
          {(Object.keys(PRESETS) as ViewportPreset[]).map((key) => {
            const active = preset === key;
            return (
              <Pressable
                key={key}
                onPress={() => setPreset(key)}
                style={[
                  styles.presetBtn,
                  {
                    backgroundColor: active ? theme.accent : 'transparent',
                    borderColor: active ? theme.accent : theme.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.presetText,
                    { color: active ? theme.accentText : theme.textSecondary },
                  ]}
                >
                  {PRESETS[key].label}
                </Text>
              </Pressable>
            );
          })}

          <Pressable
            onPress={onToggleTheme}
            style={[styles.themeIconBtn, { borderColor: theme.border }]}
            accessibilityLabel="تبديل المظهر"
          >
            <Icon
              name={theme.mode === 'dark' ? 'sun' : 'moon'}
              size={15}
              color={theme.accent}
            />
          </Pressable>
        </View>
      </View>

      {/* إطار الهاتف */}
      <View
        style={[
          styles.phoneBezel,
          {
            width: dims.width,
            height: `min(${dims.height}px, calc(100vh - 82px))`,
            backgroundColor: theme.bg,
            borderColor: theme.mode === 'dark' ? 'rgba(255,255,255,0.14)' : 'rgba(15,23,42,0.16)',
          },
        ]}
      >
        {/* شريط حالة أندرويد علوي رمزي */}
        <View style={[styles.statusStrip, { backgroundColor: theme.bg }]}>
          <Text style={[styles.statusClock, { color: theme.textSecondary }]}>9:41</Text>
          <View style={[styles.cameraDot, { backgroundColor: theme.surfaceAlt }]} />
          <View style={styles.statusIcons}>
            <Text style={[styles.statusClock, { color: theme.emerald }]}>5G</Text>
            <Text style={[styles.statusClock, { color: theme.textSecondary }]}>100%</Text>
          </View>
        </View>

        <View style={styles.screenInner}>{children}</View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  fullRoot: {
    flex: 1,
    width: '100%',
    height: '100%',
    position: 'relative',
  },
  exitFullPill: {
    position: 'fixed',
    top: 10,
    left: 10,
    zIndex: 100,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  exitFullText: {
    fontFamily: FONTS.ui,
    fontSize: 11.5,
    fontWeight: '600',
  },
  desktopCanvas: {
    flex: 1,
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingTop: 10,
    paddingBottom: 14,
    paddingHorizontal: 14,
    gap: 12,
  },
  simBar: {
    width: '100%',
    maxWidth: 960,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    backdropFilter: 'blur(12px)',
  },
  simLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  simTitle: {
    fontFamily: FONTS.ui,
    fontSize: 12.5,
    fontWeight: '700',
  },
  modeBadge: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  modeBadgeText: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    fontWeight: '700',
  },
  simRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  presetBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  presetText: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    fontWeight: '600',
  },
  themeIconBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  phoneBezel: {
    borderRadius: 34,
    borderWidth: 5,
    overflow: 'hidden',
    flexDirection: 'column',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 22 },
    shadowOpacity: 0.55,
    shadowRadius: 44,
  },
  statusStrip: {
    height: 26,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusClock: {
    fontFamily: FONTS.ui,
    fontSize: 11,
    fontWeight: '600',
  },
  cameraDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  statusIcons: {
    flexDirection: 'row',
    gap: 6,
  },
  screenInner: {
    flex: 1,
    minHeight: 0,
    position: 'relative',
    overflow: 'hidden',
  },
});

