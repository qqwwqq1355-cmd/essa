export type ThemeMode = 'dark' | 'light';

export interface ThemePalette {
  mode: ThemeMode;
  bg: string;
  bgElevated: string;
  surface: string;
  surfaceAlt: string;
  surfaceGlass: string;
  border: string;
  borderStrong: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentSoft: string;
  accentText: string;
  emerald: string;
  emeraldSoft: string;
  danger: string;
  dangerSoft: string;
  tabBarBg: string;
  miniPlayerBg: string;
  overlay: string;
}

export const DARK_THEME: ThemePalette = {
  mode: 'dark',
  bg: '#0A0C10',
  bgElevated: '#0F131B',
  surface: '#141924',
  surfaceAlt: '#1B2231',
  surfaceGlass: 'rgba(20, 25, 36, 0.86)',
  border: 'rgba(255, 255, 255, 0.075)',
  borderStrong: 'rgba(255, 255, 255, 0.14)',
  textPrimary: '#F4F6FA',
  textSecondary: '#A2ACC0',
  textMuted: '#68738A',
  accent: '#E2A84B',
  accentSoft: 'rgba(226, 168, 75, 0.14)',
  accentText: '#0D0F14',
  emerald: '#2EC492',
  emeraldSoft: 'rgba(46, 196, 146, 0.14)',
  danger: '#EF6461',
  dangerSoft: 'rgba(239, 100, 97, 0.15)',
  tabBarBg: 'rgba(13, 16, 23, 0.96)',
  miniPlayerBg: 'rgba(23, 29, 41, 0.96)',
  overlay: 'rgba(4, 6, 10, 0.78)',
};

export const LIGHT_THEME: ThemePalette = {
  mode: 'light',
  bg: '#F5F6FA',
  bgElevated: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceAlt: '#ECEFF5',
  surfaceGlass: 'rgba(255, 255, 255, 0.9)',
  border: 'rgba(15, 23, 42, 0.08)',
  borderStrong: 'rgba(15, 23, 42, 0.16)',
  textPrimary: '#111622',
  textSecondary: '#4E596E',
  textMuted: '#7F8AA0',
  accent: '#B87A18',
  accentSoft: 'rgba(184, 122, 24, 0.12)',
  accentText: '#FFFFFF',
  emerald: '#128C63',
  emeraldSoft: 'rgba(18, 140, 99, 0.12)',
  danger: '#D64545',
  dangerSoft: 'rgba(214, 69, 69, 0.12)',
  tabBarBg: 'rgba(255, 255, 255, 0.97)',
  miniPlayerBg: 'rgba(255, 255, 255, 0.98)',
  overlay: 'rgba(12, 16, 26, 0.56)',
};

export const FONTS = {
  ui: "'IBM Plex Sans Arabic', 'Segoe UI', Tahoma, sans-serif",
  lyrics: "'Amiri', 'IBM Plex Sans Arabic', Georgia, serif",
};

export const RADIUS = {
  sm: 10,
  md: 14,
  lg: 20,
  xl: 26,
  full: 999,
};

