import '@/global.css';
import { Platform } from 'react-native';

// As cores são geradas de design/palette.json por npm run theme.
import { LightPalette, DarkPalette } from './palette.generated';
export const AppColors = LightPalette;
export type AppPalette = { [K in keyof typeof AppColors]: string };
export const DarkColors: AppPalette = DarkPalette;
export const Spacing = { half: 2, one: 4, two: 8, three: 16, four: 24, five: 32, six: 64 } as const;
/** Corner scale: controls 8–12, cards 16–20, sheets 24, pills/circles 999. */
export const Radius = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 28, pill: 999 } as const;
/** Type scale. 12 is the smallest size allowed for readable text (captions, badges, tab labels). */
export const Type = {
  caption: { fontSize: 12, lineHeight: 16 },
  label: { fontSize: 13, lineHeight: 18 },
  body: { fontSize: 15, lineHeight: 22 },
  bodyLarge: { fontSize: 17, lineHeight: 24 },
  title: { fontSize: 20, lineHeight: 26 },
  headline: { fontSize: 24, lineHeight: 30 },
  display: { fontSize: 30, lineHeight: 36 },
} as const;
/** Modal backdrop; works on both themes because it only dims what is behind. */
export const Scrim = 'rgba(0,0,0,.55)';
export const CardShadow = Platform.select({ ios: { shadowColor: AppColors.text, shadowOpacity: 0.08, shadowRadius: 16, shadowOffset: { width: 0, height: 6 } }, android: { elevation: 2 }, web: { boxShadow: `0 8px 28px ${AppColors.text}14` } }) ?? {};
export const BottomTabInset = Platform.select({ ios: 50, android: 80 }) ?? 0;
export const MaxContentWidth = 720;
