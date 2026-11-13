import { mkdir, writeFile } from 'node:fs/promises';
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';
const source = new URL('../design/scenes/', import.meta.url);
const output = new URL('../apps/mobile/assets/images/scenes/', import.meta.url);
await mkdir(source, { recursive: true }); await mkdir(output, { recursive: true });
const vial = (label, color) => `<path d="M112 76H188V104Q188 119 207 132Q222 143 222 164V253Q222 270 202 270H98Q78 270 78 253V164Q78 143 93 132Q112 119 112 104Z" fill="#E8FBFD" stroke="#9FD8E2" stroke-width="4"/><path d="M91 178H209V249Q209 257 199 257H101Q91 257 91 249Z" fill="#FFFFFF" opacity=".75"/><path d="M100 149V241" stroke="#FFFFFF" stroke-width="8" stroke-linecap="round"/><rect x="103" y="55" width="94" height="45" rx="6" fill="#B9C9D0"/><path d="M110 82H190" stroke="#E8FBFD" stroke-width="9"/><rect x="99" y="43" width="102" height="25" rx="7" fill="${color}"/><rect x="79" y="164" width="142" height="72" rx="5" fill="#FFFFFF"/><rect x="79" y="164" width="142" height="10" fill="${color}"/>${label ? `<text x="150" y="213" text-anchor="middle" font-family="DejaVu Sans,sans-serif" font-weight="bold" font-size="${label.length > 4 ? 33 : 39}" fill="#163E4C">${label}</text>` : '<path d="M113 197H187M124 215H176" stroke="#9FD8E2" stroke-width="8" stroke-linecap="round"/>'}`;
const art = {
  syringe: '<g transform="rotate(35 150 150)"><path d="M150 30V84" stroke="#B9C9D0" stroke-width="5"/><rect x="126" y="81" width="48" height="129" rx="8" fill="#FFFFFF"/><rect x="132" y="140" width="36" height="61" fill="#67E8F9"/><path d="M138 102H155M138 121H150M138 141H155M138 161H150" stroke="#0E7490" stroke-width="4"/><path d="M111 211H189M150 214V252M125 256H175" stroke="#E8FBFD" stroke-width="12" stroke-linecap="round"/></g>',
  ampoule: '<path d="M135 37H165L162 88L169 113Q193 147 193 165V251Q193 268 177 268H123Q107 268 107 251V165Q107 147 131 113L138 88Z" fill="#E8FBFD" stroke="#9FD8E2" stroke-width="4"/><path d="M118 185H182V248Q182 256 174 256H126Q118 256 118 248Z" fill="#67E8F9"/><path d="M137 97H163" stroke="#F7B24A" stroke-width="8"/><path d="M122 161V237" stroke="#FFFFFF" stroke-width="7" stroke-linecap="round"/>',
  vial: vial('', '#163E4C'),
};
for (const [label, color] of [['Reta','#0E7490'],['Tirze','#16816A'],['Sema','#6866A8'],['Dura','#B47435'],['Enan','#326B91'],['Testo','#965D76'],['prop','#63784B'],['PEP','#436E75']]) art[`vial-${label.toLowerCase()}`] = vial(label, color);
for (const [name, body] of Object.entries(art)) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" viewBox="0 0 300 300"><defs><linearGradient id="bg" x2="0" y2="1"><stop stop-color="#0C4A5E"/><stop offset="1" stop-color="#0E9AA7"/></linearGradient><radialGradient id="glow"><stop stop-color="#67E8F9" stop-opacity=".5"/><stop offset="1" stop-color="#67E8F9" stop-opacity="0"/></radialGradient></defs><rect width="300" height="300" fill="url(#bg)"/><circle cx="150" cy="150" r="150" fill="url(#glow)"/><ellipse cx="150" cy="273" rx="88" ry="10" fill="#0B1E28" opacity=".18"/>${body}</svg>`;
  await writeFile(new URL(`injectable-${name}.svg`, source), svg);
  await sharp(Buffer.from(svg)).webp({ quality: 95 }).toFile(fileURLToPath(new URL(`injectable-${name}.webp`, output)));
}
console.log(`${Object.keys(art).length} ilustrações de injetáveis geradas.`);
