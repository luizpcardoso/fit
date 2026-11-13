import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Transparent line art, tinted with the current theme by HomeAccompanimentCard.
const drawings = {
  workout: '<g transform="rotate(-28 120 120)"><rect x="75" y="105" width="90" height="30" rx="8"/><rect x="53" y="76" width="23" height="88" rx="8"/><rect x="164" y="76" width="23" height="88" rx="8"/><path d="M42 101v38m156-38v38"/></g><path d="M38 190c54-20 96 28 162 2M50 210c54-20 96 28 142 4"/>',
  food: '<path d="M43 124h154c-7 49-33 72-77 72s-70-23-77-72ZM65 113c-8-31 9-54 37-51 4 27-7 43-22 51m36-10c-4-35 16-56 50-49 1 29-14 49-39 49M67 83l17 29m61-38-20 29M32 211h176"/><path d="M151 115c0-14 11-24 25-24s24 10 24 24"/>',
  balance: '<circle cx="120" cy="120" r="78"/><path d="M120 42a78 78 0 0 1 74 103" stroke-width="16"/><path d="m87 96-16 24 16 24m-16-24h63m19-24 16 24-16 24m16-24h-20M74 214c31-11 61-11 92 0"/>',
};
const sources = new URL('../design/scenes/', import.meta.url);
const images = new URL('../apps/mobile/assets/images/scenes/', import.meta.url);
await mkdir(sources, { recursive: true });
await mkdir(images, { recursive: true });
for (const [topic, drawing] of Object.entries(drawings)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240"><g fill="none" stroke="#000" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">${drawing}</g></svg>`;
  await writeFile(new URL(`home-${topic}.svg`, sources), svg);
  await sharp(Buffer.from(svg)).resize(480, 480).webp({ lossless: true }).toFile(fileURLToPath(new URL(`home-${topic}.webp`, images)));
}
