import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ActiveTab } from '../store/useAppStore';
import { FONTS, type ThemePalette } from '../theme/tokens';
import { Icon, type IconName } from './Icon';

interface BottomNavProps {
  activeTab: ActiveTab;
  theme: ThemePalette;
  onChange: (tab: ActiveTab) => void;
}

const TABS: Array<{ id: ActiveTab; label: string; icon: IconName }> = [
  { id: 'home', label: 'الرئيسية', icon: 'home' },
  { id: 'search', label: 'البحث', icon: 'search' },
  { id: 'offline', label: 'المحمّلة', icon: 'download' },
  { id: 'library', label: 'المكتبة', icon: 'library' },
  { id: 'settings', label: 'الإعدادات', icon: 'settings' },
];

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, theme, onChange }) => {
  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: theme.tabBarBg,
          borderTopColor: theme.border,
        },
      ]}
    >
      {TABS.map((tab) => {
        const active = activeTab === tab.id;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onChange(tab.id)}
            style={styles.item}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={tab.label}
          >
            <View
              style={[
                styles.pill,
                active && { backgroundColor: theme.accentSoft },
              ]}
            >
              <Icon
                name={tab.icon}
                size={20}
                color={active ? theme.accent : theme.textMuted}
                strokeWidth={active ? 2.2 : 1.8}
              />
            </View>
            <Text
              style={[
                styles.label,
                {
                  color: active ? theme.accent : theme.textMuted,
                  fontWeight: active ? '700' : '500',
                },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    borderTopWidth: 1,
    paddingTop: 7,
    paddingBottom: 9,
    paddingHorizontal: 6,
    backdropFilter: 'blur(16px)',
  },
  item: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    minHeight: 48,
  },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
  },
  label: {
    fontFamily: FONTS.ui,
    fontSize: 11,
  },
});

