import { readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const palette = JSON.parse(await readFile(new URL('design/palette.json', root), 'utf8'));
const keys = Object.keys(palette.light);
if (Object.keys(palette.dark).length !== keys.length || keys.some(key => !(key in palette.dark))) throw new Error('As paletas clara e escura precisam dos mesmos tokens.');
for (const group of [palette.light, palette.dark, palette.brand]) {
  for (const [key, color] of Object.entries(group)) {
    if (!/^#[\da-f]{6}$/i.test(color)) throw new Error(`Cor inválida: ${key}`);
  }
}
// Guard the foreground/background pairs used by badges, initials and interface icons.
const luminance = hex => {
  const rgb = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
};
for (const mode of ['light', 'dark']) {
  for (const [foreground, background] of [['onPrimarySoft', 'primarySoft'], ['link', 'primarySoft'], ['link', 'surface'], ['link', 'surfaceSoft'], ['link', 'background'], ['onPrimary', 'primary']]) {
    const values = [luminance(palette[mode][foreground]), luminance(palette[mode][background])].sort((a, b) => a - b);
    const contrast = (values[1] + 0.05) / (values[0] + 0.05);
    if (contrast < 4.5) throw new Error(`Contraste insuficiente no tema ${mode}: ${foreground}/${background} (${contrast.toFixed(2)}:1).`);
  }
  // Field outlines are non-text UI components: WCAG 1.4.11 requires 3:1 against adjacent colors.
  for (const background of ['surface', 'surfaceSoft', 'background']) {
    const values = [luminance(palette[mode].fieldBorder), luminance(palette[mode][background])].sort((a, b) => a - b);
    const contrast = (values[1] + 0.05) / (values[0] + 0.05);
    if (contrast < 3) throw new Error(`Contraste insuficiente no tema ${mode}: fieldBorder/${background} (${contrast.toFixed(2)}:1).`);
  }
}
const banner = 'Gerado por npm run theme a partir de design/palette.json. Não editar manualmente.';
await writeFile(new URL('apps/mobile/src/constants/palette.generated.ts', root), `// ${banner}\nexport const LightPalette = ${JSON.stringify(palette.light, null, 2)} as const;\nexport const DarkPalette = ${JSON.stringify(palette.dark, null, 2)} as const;\n`);
const kebab = key => key.replace(/[A-Z]/g, c => `-${c.toLowerCase()}`);
const css = group => Object.entries(group).map(([key, color]) => `  --fit-${kebab(key)}: ${color};`).join('\n');
await writeFile(new URL('apps/web/theme.css', root), `/* ${banner} */\n:root {\n  color-scheme: light;\n${css(palette.light)}\n${Object.entries(palette.brand).map(([key,color])=>`  --brand-${kebab(key)}: ${color};`).join('\n')}\n}\n@media (prefers-color-scheme: dark) {\n  :root {\n    color-scheme: dark;\n${css(palette.dark)}\n  }\n}\n`);
const homePath = new URL('apps/web/home.html', root);
const home = await readFile(homePath, 'utf8');
await writeFile(homePath, home.replace(/(<meta name="theme-color" content=")[^"]+("[^>]*>)/, `$1${palette.brand.deep}$2`));
const configPath = new URL('apps/mobile/app.json', root);
const config = JSON.parse(await readFile(configPath, 'utf8'));
config.expo.android.adaptiveIcon.backgroundColor = palette.brand.deep;
const splash = config.expo.plugins.find(plugin => Array.isArray(plugin) && plugin[0] === 'expo-splash-screen');
if (splash) splash[1].backgroundColor = palette.brand.deep;
await writeFile(configPath, JSON.stringify(config, null, 2) + '\n');
console.log(`Tema ${palette.name} atualizado no app e no web.`);
