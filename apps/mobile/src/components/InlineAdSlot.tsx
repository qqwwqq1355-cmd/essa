import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FONTS, RADIUS, type ThemePalette } from '../theme/tokens';
import { triggerInlineAdAction } from '../services/ads/startIoAds';
import { Icon } from './Icon';

interface InlineAdSlotProps {
  theme: ThemePalette;
  label?: string;
}

/**
 * خانة إعلانية مدمجة أنيقة (بين كل 10 زوامل + تحت شريط المشغّل)
 * متوافقة مع Start.io Android SDK
 */
export const InlineAdSlot: React.FC<InlineAdSlotProps> = ({
  theme,
  label = 'إعلان مموّل',
}) => {
  return (
    <Pressable
      onPress={triggerInlineAdAction}
      style={[
        styles.slot,
        {
          backgroundColor: theme.surface,
          borderColor: theme.border,
        },
      ]}
      accessibilityLabel="إعلان"
    >
      <View style={[styles.badge, { backgroundColor: theme.accentSoft }]}>
        <Text style={[styles.badgeText, { color: theme.accent }]}>إعلان</Text>
      </View>
      <View style={styles.meta}>
        <Text style={[styles.title, { color: theme.textPrimary }]} numberOfLines={1}>
          ادعم استمرار مكتبة زوامل عيسى الليث المجانية
        </Text>
        <Text style={[styles.sub, { color: theme.textMuted }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
      <Icon name="sparkles" size={16} color={theme.accent} />
    </Pressable>
  );
};

const styles = StyleSheet.create({
  slot: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    marginVertical: 4,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.sm,
  },
  badgeText: {
    fontFamily: FONTS.ui,
    fontSize: 10,
    fontWeight: '700',
  },
  meta: {
    flex: 1,
    gap: 2,
  },
  title: {
    fontFamily: FONTS.ui,
    fontSize: 12,
    fontWeight: '600',
  },
  sub: {
    fontFamily: FONTS.ui,
    fontSize: 10.5,
  },
});

