import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FONTS, RADIUS, type ThemePalette } from '../theme/tokens';
import { Icon } from './Icon';

interface ExitConfirmModalProps {
  visible: boolean;
  theme: ThemePalette;
  onStay: () => void;
  onConfirmExit: () => void;
}

export const ExitConfirmModal: React.FC<ExitConfirmModalProps> = ({
  visible,
  theme,
  onStay,
  onConfirmExit,
}) => {
  if (!visible) return null;

  return (
    <View style={styles.backdrop}>
      <View
        style={[
          styles.dialog,
          {
            backgroundColor: theme.surface,
            borderColor: theme.borderStrong,
          },
        ]}
      >
        <View style={[styles.iconWrap, { backgroundColor: theme.accentSoft }]}>
          <Icon name="chevron-down" size={24} color={theme.accent} />
        </View>

        <Text style={[styles.title, { color: theme.textPrimary }]}>الخروج من التطبيق</Text>
        <Text style={[styles.message, { color: theme.textSecondary }]}>
          هل أنت متأكد من رغبتك في الخروج من زوامل عيسى الليث؟
        </Text>

        <View style={styles.actions}>
          <Pressable
            onPress={onStay}
            style={[styles.btn, { backgroundColor: theme.accent }]}
          >
            <Text style={[styles.btnText, { color: theme.accentText }]}>البقاء</Text>
          </Pressable>

          <Pressable
            onPress={onConfirmExit}
            style={[
              styles.btn,
              {
                backgroundColor: theme.surfaceAlt,
                borderWidth: 1,
                borderColor: theme.danger,
              },
            ]}
          >
            <Text style={[styles.btnText, { color: theme.danger }]}>خروج</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 90,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  dialog: {
    width: '100%',
    maxWidth: 320,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    padding: 20,
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 2,
  },
  title: {
    fontFamily: FONTS.ui,
    fontSize: 17,
    fontWeight: '700',
  },
  message: {
    fontFamily: FONTS.ui,
    fontSize: 13.5,
    textAlign: 'center',
    lineHeight: 21,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    width: '100%',
    marginTop: 8,
  },
  btn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: {
    fontFamily: FONTS.ui,
    fontSize: 13.5,
    fontWeight: '700',
  },
});

