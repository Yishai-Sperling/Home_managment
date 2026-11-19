import { useColorScheme } from 'react-native';

const palette = {
  light: {
    bg: '#F6F7F9', surface: '#FFFFFF', surfaceAlt: '#EEF0F4', border: '#E3E6EC',
    text: '#14171F', textMuted: '#6B7280', primary: '#4F46E5', primaryText: '#FFFFFF',
    primarySoft: '#EEF0FF', success: '#16A34A', warning: '#D97706', danger: '#DC2626',
    dangerSoft: '#FEE2E2', successSoft: '#DCFCE7', warningSoft: '#FEF3C7',
  },
  dark: {
    bg: '#0E1015', surface: '#171A22', surfaceAlt: '#1F2430', border: '#2A3040',
    text: '#F3F4F8', textMuted: '#9AA3B2', primary: '#818CF8', primaryText: '#0E1015',
    primarySoft: '#242650', success: '#4ADE80', warning: '#FBBF24', danger: '#F87171',
    dangerSoft: '#3B1D1F', successSoft: '#143222', warningSoft: '#3A2D10',
  },
};

export type Colors = typeof palette.light;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 8, md: 12, lg: 18, pill: 999 } as const;
export const font = {
  title: { fontSize: 26, fontWeight: '700' as const },
  heading: { fontSize: 18, fontWeight: '600' as const },
  body: { fontSize: 16, fontWeight: '400' as const },
  small: { fontSize: 13, fontWeight: '400' as const },
  label: { fontSize: 14, fontWeight: '600' as const },
};

export function useTheme() {
  const scheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { colors: palette[scheme] as Colors, scheme, spacing, radius, font };
}
