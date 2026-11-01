import { Image } from 'expo-image';

// Símbolo e logo Orami (opção "Onda") gerados de design/brand/mark.mjs por scripts/generate-brand-assets.mjs.
const mark = require('../../assets/images/brand/orami-mark.png');
const logo = { light: require('../../assets/images/brand/orami-logo.png'), dark: require('../../assets/images/brand/orami-logo-white.png') };
const LOGO_RATIO = 3.55;

export function BrandMark({ size = 56 }: { size?: number }) {
  return <Image aria-hidden accessible={false} source={mark} contentFit="contain" transition={0} style={{ width: size, height: size }} />;
}

/** Símbolo + nome "orami" como no logotipo. `onDark` usa o nome em branco (sobre ilustrações e cartões escuros). */
export function BrandLockup({ height = 40, onDark = false }: { height?: number; onDark?: boolean }) {
  return <Image accessible accessibilityLabel="Orami" source={logo[onDark ? 'dark' : 'light']} contentFit="contain" transition={0} style={{ width: height * LOGO_RATIO, height }} />;
}
