import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { FONTS, RADIUS, type ThemePalette } from '../theme/tokens';
import type { ToastMessage } from '../store/useAppStore';

interface ToastBannerProps {
  toast: ToastMessage | null;
  theme: ThemePalette;
}

export const ToastBanner: React.FC<ToastBannerProps> = ({ toast, theme }) => {
  if (!toast) return null;

  const borderColor =
    toast.tone === 'success'
      ? theme.emerald
      : toast.tone === 'error'
        ? theme.danger
        : theme.accent;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View
        style={[
          styles.pill,
          {
            backgroundColor: theme.surfaceGlass,
            borderColor,
          },
        ]}
      >
        <View style={[styles.dot, { backgroundColor: borderColor }]} />
        <Text style={[styles.text, { color: theme.textPrimary }]} numberOfLines={2}>
          {toast.text}
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 12,
    left: 14,
    right: 14,
    zIndex: 90,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    maxWidth: '100%',
    backdropFilter: 'blur(14px)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    flexShrink: 0,
  },
  text: {
    fontFamily: FONTS.ui,
    fontSize: 12.5,
    fontWeight: '600',
    flexShrink: 1,
  },
});

