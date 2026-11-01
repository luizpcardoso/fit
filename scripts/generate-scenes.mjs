import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Ilustrações das telas no estilo Orami Pulse. O lado esquerdo recebe um véu escuro para o texto branco do app ter contraste.
const W = 1200, H = 520;
const out = new URL('../apps/mobile/assets/images/scenes/', import.meta.url);
const src = new URL('../design/scenes/', import.meta.url);
const stroke = (c, w) => `fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"`;
const veil = (strength = .78) => `<linearGradient id="veil" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0B1E28" stop-opacity="${strength}"/><stop offset=".45" stop-color="#0B1E28" stop-opacity="${strength * .55}"/><stop offset=".72" stop-color="#0B1E28" stop-opacity="0"/></linearGradient>`;
const sky = (id, stops) => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">${stops.map(([o, c]) => `<stop offset="${o}" stop-color="${c}"/>`).join('')}</linearGradient>`;
const glow = (id, color, op = .9) => `<radialGradient id="${id}"><stop offset="0" stop-color="${color}" stop-opacity="${op}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
const wave = (y, amp, color, op = 1, phase = 0) => {
  let d = `M0 ${y}`;
  for (let x = 0; x <= W; x += 150) d += ` Q${x + 75} ${y + (((x / 150 + phase) % 2) ? amp : -amp)} ${x + 150} ${y}`;
  return `<path d="${d} V${H} H0Z" fill="${color}" opacity="${op}"/>`;
};
const pulse = (x, y, s, c, w, op = 1) => `<path transform="translate(${x} ${y}) scale(${s})" d="M0 0H70L95 -48L128 60L160 -36L182 0H300" ${stroke(c, w)} opacity="${op}"/>`;
const stars = (n, seed, y1 = 200) => Array.from({ length: n }, (_, i) => { const r = Math.abs(Math.sin(seed + i * 12.9898) * 43758.5453) % 1, q = Math.abs(Math.sin(seed + i * 78.233) * 12345.678) % 1; return `<circle cx="${(r * W).toFixed(0)}" cy="${(q * y1).toFixed(0)}" r="${(1 + (r * 7 % 1.8)).toFixed(1)}" fill="#FFFFFF" opacity="${(.35 + q * .5).toFixed(2)}"/>`; }).join('');

// Pictogramas de pessoas: traço grosso arredondado, sem traços faciais.
const runner = (x, y, s, c) => `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="52" cy="-150" r="20" fill="${c}"/><g ${stroke(c, 22)}><path d="M40 -118L22 -46"/><path d="M38 -110L72 -84L100 -100"/><path d="M38 -110L6 -92L-14 -62"/><path d="M22 -46L56 -16L44 34"/><path d="M22 -46L-6 -8L-46 -18"/></g></g>`;
const lifter = (x, y, s, c, bar) => `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="0" cy="-158" r="20" fill="${c}"/><g ${stroke(c, 22)}><path d="M0 -126V-50"/><path d="M0 -118L-40 -150L-44 -200"/><path d="M0 -118L40 -150L44 -200"/><path d="M0 -50L-34 -6L-30 40"/><path d="M0 -50L34 -6L30 40"/></g><path d="M-120 -204H120" ${stroke(bar, 12)}/><rect x="-128" y="-238" width="22" height="68" rx="8" fill="${bar}"/><rect x="106" y="-238" width="22" height="68" rx="8" fill="${bar}"/></g>`;
const meditate = (x, y, s, c) => `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="0" cy="-150" r="21" fill="${c}"/><g ${stroke(c, 22)}><path d="M0 -118V-46"/><path d="M0 -108C-26 -96 -44 -70 -50 -40"/><path d="M0 -108C26 -96 44 -70 50 -40"/><path d="M-78 -18C-40 -38 40 -38 78 -18"/></g><circle cx="-52" cy="-38" r="9" fill="${c}"/><circle cx="52" cy="-38" r="9" fill="${c}"/></g>`;
const person = (x, y, s, c) => `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="0" cy="-92" r="30" fill="${c}"/><path d="M-56 0C-56 -38 -30 -54 0 -54S56 -38 56 0Z" fill="${c}"/></g>`;

const scenes = {
  // Início/autenticação: amanhecer no mar com corredor na orla, como no conceito da marca.
  sunrise: `<defs>${sky('s', [[0, '#0E5F78'], [.45, '#2BA8C4'], [.78, '#9EE6EF'], [1, '#FCE7B7']])}${glow('g', '#FFE9B0')}${veil(.7)}</defs>
    <rect width="${W}" height="${H}" fill="url(#s)"/><circle cx="930" cy="330" r="260" fill="url(#g)"/><circle cx="930" cy="330" r="62" fill="#FFF4D6"/>
    ${pulse(80, 160, 1.6, '#FFFFFF', 5, .25)}
    <rect y="330" width="${W}" height="${H - 330}" fill="#3FBACB"/>${wave(350, 8, '#67E8F9', .55)}${wave(380, 10, '#14B8A6', .5, 1)}
    <path d="M520 430C700 395 900 400 ${W} 420V${H}H520Z" fill="#F3E3C3"/><path d="M0 470C300 430 600 445 ${W} 470V${H}H0Z" fill="#0E7490" opacity=".9"/>
    ${runner(900, 452, .78, '#16404B')}<rect width="${W}" height="${H}" fill="url(#veil)"/>`,
  // Fitness: pista em direção às montanhas e pessoa levantando a barra.
  workout: `<defs>${sky('s', [[0, '#0B3F52'], [.55, '#0E7490'], [1, '#5BD4E4']])}${glow('g', '#67E8F9', .7)}${veil(.75)}</defs>
    <rect width="${W}" height="${H}" fill="url(#s)"/><circle cx="880" cy="250" r="280" fill="url(#g)"/><circle cx="880" cy="250" r="70" fill="#D7F6FA" opacity=".9"/>
    <path d="M0 330L180 230L330 300L520 170L720 300L880 210L1050 290L${W} 240V${H}H0Z" fill="#0F5F73"/>
    <path d="M0 380L240 310L460 360L700 290L960 350L${W} 320V${H}H0Z" fill="#14808F"/>
    <path d="M300 ${H}C560 430 760 400 ${W} 395V${H}Z" fill="#14B8A6" opacity=".85"/>
    <g ${stroke('#D7F6FA', 4)} opacity=".6"><path d="M420 ${H}C640 450 860 425 ${W} 420"/><path d="M560 ${H}C740 470 940 450 ${W} 448"/></g>
    ${lifter(900, 470, .82, '#0B2A35', '#0B2A35')}${pulse(60, 120, 1.3, '#67E8F9', 5, .35)}<rect width="${W}" height="${H}" fill="url(#veil)"/>`,
  // Mente: lago calmo ao anoitecer, lua e pessoa meditando.
  mind: `<defs>${sky('s', [[0, '#132A45'], [.55, '#2B5C7E'], [1, '#7CC9D8']])}${glow('g', '#B9E9F1', .6)}${veil(.65)}</defs>
    <rect width="${W}" height="${H}" fill="url(#s)"/>${stars(46, 3)}<circle cx="920" cy="150" r="190" fill="url(#g)"/><circle cx="920" cy="150" r="52" fill="#EAF6F9"/>
    <path d="M0 320C200 260 380 290 560 250S900 260 ${W} 230V${H}H0Z" fill="#1F4E66"/>
    <rect y="350" width="${W}" height="${H - 350}" fill="#2D7D93"/>
    <g opacity=".5">${[0, 1, 2, 3].map(i => `<rect x="${880 - i * 18}" y="${372 + i * 22}" width="${80 + i * 36}" height="5" rx="3" fill="#EAF6F9"/>`).join('')}</g>
    ${wave(430, 6, '#67E8F9', .25)}<path d="M640 380C760 360 900 360 1040 380L1060 400H620Z" fill="#163B4E"/>
    ${meditate(840, 378, .8, '#0E2433')}<rect width="${W}" height="${H}" fill="url(#veil)"/>`,
  // Nutrição: tigela com folhas e frutas sobre fundo menta.
  nutrition: `<defs>${sky('s', [[0, '#0E6F80'], [1, '#2BB5A8']])}${glow('g', '#D7F6FA', .55)}${veil(.72)}</defs>
    <rect width="${W}" height="${H}" fill="url(#s)"/><circle cx="880" cy="260" r="300" fill="url(#g)"/>
    <g transform="translate(860 300)"><ellipse cx="0" cy="150" rx="250" ry="26" fill="#0B4B57" opacity=".35"/>
      <path d="M-120 -70C-160 -170 -60 -210 -20 -140C-40 -100 -80 -80 -120 -70Z" fill="#2E9E6A"/><path d="M-30 -80C-10 -200 110 -190 100 -110C60 -80 10 -70 -30 -80Z" fill="#3DBB7E"/>
      <circle cx="-150" cy="-40" r="58" fill="#F7B24A"/><circle cx="-150" cy="-40" r="46" fill="#FFD27A"/><g ${stroke('#F7B24A', 4)}><path d="M-150 -86V6M-196 -40H-104M-182 -72L-118 -8M-182 -8L-118 -72"/></g>
      <circle cx="130" cy="-60" r="54" fill="#E85D5D"/><circle cx="60" cy="-40" r="34" fill="#9BE36C"/>
      <path d="M-230 -20H230C230 90 130 140 0 140S-230 90 -230 -20Z" fill="#FFFFFF"/><path d="M-230 -20H230C226 10 210 34 186 54H-186C-210 34 -226 10 -230 -20Z" fill="#E8FBFD"/>
      <path d="M-200 30C-100 50 100 50 200 30" ${stroke('#67E8F9', 8)}/></g>
    <g fill="#67E8F9" opacity=".5"><circle cx="560" cy="90" r="10"/><circle cx="1120" cy="80" r="14"/><circle cx="640" cy="440" r="8"/></g>
    <rect width="${W}" height="${H}" fill="url(#veil)"/>`,
  // Saúde: coração com pulso sobre ondas.
  health: `<defs>${sky('s', [[0, '#0B4F64'], [1, '#0891B2']])}${glow('g', '#67E8F9', .55)}${veil(.72)}<linearGradient id="h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF"/><stop offset="1" stop-color="#B9E9F1"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#s)"/><circle cx="880" cy="230" r="300" fill="url(#g)"/>
    ${wave(380, 14, '#14B8A6', .55)}${wave(420, 12, '#67E8F9', .35, 1)}${wave(460, 10, '#0E7490', .9)}
    <path transform="translate(880 250) scale(1.25)" d="M0 110C-150 20 -170 -80 -100 -120C-55 -145 -15 -120 0 -90C15 -120 55 -145 100 -120C170 -80 150 20 0 110Z" fill="url(#h)"/>
    ${pulse(690, 250, 1.3, '#0891B2', 14)}<rect width="${W}" height="${H}" fill="url(#veil)"/>`,
  // Grupos: pessoas conectadas por uma rede.
  groups: `<defs>${sky('s', [[0, '#0E5F78'], [1, '#14B8A6']])}${glow('g', '#D7F6FA', .5)}${veil(.72)}</defs>
    <rect width="${W}" height="${H}" fill="url(#s)"/><circle cx="880" cy="260" r="300" fill="url(#g)"/>
    <path d="M0 400C300 360 600 380 ${W} 350V${H}H0Z" fill="#0E7490" opacity=".7"/>
    <g ${stroke('#D7F6FA', 6)} opacity=".8"><path d="M740 180L880 120L1030 190M740 180L800 330M1030 190L980 330M880 120L880 260"/></g>
    <g fill="#67E8F9"><circle cx="740" cy="180" r="18"/><circle cx="880" cy="120" r="18"/><circle cx="1030" cy="190" r="18"/><circle cx="880" cy="260" r="14"/></g>
    ${person(800, 460, 1.15, '#0B2A35')}${person(980, 460, 1.15, '#0B2A35')}${person(890, 480, 1.35, '#16404B')}
    <rect width="${W}" height="${H}" fill="url(#veil)"/>`,
  // Fundo discreto do cartão de meta semanal (Início): só textura, para não competir com os dados.
  pulse: `<defs>${sky('s', [[0, '#16404B'], [1, '#0B5B6E']])}${glow('g', '#14B8A6', .45)}</defs>
    <rect width="${W}" height="${H}" fill="url(#s)"/><circle cx="1080" cy="40" r="360" fill="url(#g)"/>
    ${pulse(820, 80, 1.15, '#67E8F9', 5, .1)}${wave(430, 14, '#14B8A6', .14)}${wave(470, 12, '#67E8F9', .08, 1)}`,
};

// Cada saída recorta a cena (viewBox) no formato do lugar onde é usada e exporta já na resolução de tela 3x,
// para o app não precisar ampliar a imagem ao preencher o cartão.
const exports = [
  ...['sunrise', 'workout', 'mind', 'nutrition', 'health', 'groups'].map(name => ({ name, scene: name, crop: [0, 0, W, H], width: 1500 })),
  { name: 'pulse-tall', scene: 'pulse', crop: [W - H * .8, 0, H * .8, H], width: 1080 },
  { name: 'workout-square', scene: 'workout', crop: [W - H * 1.15, 0, H * 1.15, H], width: 1200 },
];
await mkdir(out, { recursive: true }); await mkdir(src, { recursive: true });
for (const [name, body] of Object.entries(scenes)) await writeFile(fileURLToPath(new URL(`${name}.svg`, src)), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${body}</svg>`);
for (const { name, scene, crop, width } of exports) {
  const height = Math.round(width * crop[3] / crop[2]);
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${crop.join(' ')}" width="${width}" height="${height}" preserveAspectRatio="xMaxYMid slice">${scenes[scene]}</svg>`);
  await sharp(svg).webp({ quality: 90, smartSubsample: true }).toFile(fileURLToPath(new URL(`${name}.webp`, out)));
}
console.log(`Cenas geradas: ${exports.map(item => item.name).join(', ')}.`);
