import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { iconSvg, markMonoSvg, markSvg, TAGLINE_WIDTH, taglineSvg, WORDMARK_WIDTH, wordmarkSvg } from '../design/brand/mark.mjs';

const design = new URL('../design/', import.meta.url);
const images = new URL('../apps/mobile/assets/images/', import.meta.url);
const output = (name, base = images) => fileURLToPath(new URL(name, base));
const svg = (w, h, body) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}">${body}</svg>`);
const at = (x, y, s, body) => `<g transform="translate(${x} ${y}) scale(${s})">${body}</g>`;

// Logo horizontal: símbolo de 120 e nome com corpo 102, centrado pela altura-x.
const H = 120, FS = 1.02, GAP = 26, logoW = H + GAP + WORDMARK_WIDTH * FS;
const lockup = (word, id) => `${markSvg({ id, size: H })}${at(H + GAP, H / 2 + 27.5, FS, wordmarkSvg(word))}`;
const logo = svg(logoW, H, lockup('#16404B', 'l'));
const logoWhite = svg(logoW, H, lockup('#FFFFFF', 'w'));
// Logo vertical com assinatura TRACK • TRAIN • THRIVE na largura do nome.
const TS = (WORDMARK_WIDTH * 1.6) / TAGLINE_WIDTH, stackW = WORDMARK_WIDTH * 1.6;
const logoStacked = svg(stackW, 380, `<g transform="translate(${stackW / 2 - 110} 0)">${markSvg({ id: 's', size: 220 })}</g>${at(0, 338, 1.6, wordmarkSvg())}${at(0, 378, TS, taglineSvg())}`);
const mark = svg(512, 512, markSvg());
// Zona segura do ícone adaptativo (66 de 108 dp): o pulso fica dentro do círculo central.
const foreground = svg(512, 512, iconSvg({ bg: false, scale: .94 }));

await Promise.all([
  writeFile(output('orami-mark.svg', design), mark),
  writeFile(output('orami-icon.svg', design), svg(512, 512, iconSvg({ rx: 116 }))),
  writeFile(output('orami-logo.svg', design), logo),
  writeFile(output('orami-logo-white.svg', design), logoWhite),
  writeFile(output('orami-logo-stacked.svg', design), logoStacked),
  writeFile(output('orami-mark-mono.svg', design), svg(512, 512, markMonoSvg('#16404B'))),
  // Ícone quadrado sem transparência: cada sistema aplica a própria máscara.
  sharp(svg(512, 512, iconSvg())).resize(1024, 1024).png().toFile(output('icon.png')),
  sharp(svg(512, 512, iconSvg({ rx: 112 }))).resize(48, 48).png().toFile(output('favicon.png')),
  sharp(svg(512, 512, iconSvg({ pulse: false }))).png().toFile(output('android-icon-background.png')),
  sharp(foreground).png().toFile(output('android-icon-foreground.png')),
  sharp(foreground).resize(432, 432).png().toFile(output('android-icon-monochrome.png')),
  sharp(mark).resize(288, 288).png().toFile(output('splash-icon.png')),
  sharp(mark).resize(192, 192).png().toFile(output('brand/orami-mark.png')),
  // Logos do app em 3x para até 48 de altura.
  sharp(logo).resize({ height: 144 }).png().toFile(output('brand/orami-logo.png')),
  sharp(logoWhite).resize({ height: 144 }).png().toFile(output('brand/orami-logo-white.png')),
]);
console.log('Assets da marca Orami gerados.');
