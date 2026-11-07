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
const stars = (n, seed, y1 = 200, w = W) => Array.from({ length: n }, (_, i) => { const r = Math.abs(Math.sin(seed + i * 12.9898) * 43758.5453) % 1, q = Math.abs(Math.sin(seed + i * 78.233) * 12345.678) % 1; return `<circle cx="${(r * w).toFixed(0)}" cy="${(q * y1).toFixed(0)}" r="${(1 + (r * 7 % 1.8)).toFixed(1)}" fill="#FFFFFF" opacity="${(.35 + q * .5).toFixed(2)}"/>`; }).join('');

// Pictogramas de pessoas: traço grosso arredondado, sem traços faciais.
const runner = (x, y, s, c) => `<g transform="translate(${x} ${y}) scale(${s})"><circle cx="52" cy="-150" r="20" fill="${c}"/><g ${stroke(c, 22)}><path d="M40 -118L22 -46"/><path d="M38 -110L72 -84L100 -100"/><path d="M38 -110L6 -92L-14 -62"/><path d="M22 -46L56 -16L44 34"/><path d="M22 -46L-6 -8L-46 -18"/></g></g>`;
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
  workout: `<defs>${sky('s', [[0, '#102D3A'], [1, '#07596C']])}${glow('g', '#2DD4BF', .35)}${veil(.6)}<linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#D1FAF5"/><stop offset=".5" stop-color="#55B9BA"/><stop offset="1" stop-color="#147589"/></linearGradient></defs>
    <rect width="${W}" height="${H}" fill="url(#s)"/><circle cx="1030" cy="80" r="430" fill="url(#g)"/>
    <g fill="none" stroke="#67E8F9" opacity=".1" stroke-width="2"><circle cx="1010" cy="260" r="210"/><circle cx="1010" cy="260" r="250"/><path d="M620 0L1200 520M770 0L1200 370"/></g>
    <g transform="translate(940 285) rotate(-28)"><ellipse cy="135" rx="210" ry="24" fill="#071D29" opacity=".35"/><rect x="-190" y="-16" width="380" height="32" rx="16" fill="url(#metal)"/>
    <g fill="#123746" stroke="#5DB8BA" stroke-width="3"><rect x="-165" y="-94" width="48" height="188" rx="16"/><rect x="-115" y="-72" width="32" height="144" rx="10"/><rect x="117" y="-94" width="48" height="188" rx="16"/><rect x="83" y="-72" width="32" height="144" rx="10"/></g><path d="M-150 -74V68M132 -74V68" stroke="#A6ECE0" stroke-width="5" opacity=".6"/></g>
    <rect width="${W}" height="${H}" fill="url(#veil)"/>`,
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
  pulse: `<defs>${sky('s', [[0, '#102D3A'], [1, '#07596C']])}${glow('g', '#2DD4BF', .3)}</defs>
    <rect width="${W}" height="${H}" fill="url(#s)"/><circle cx="1170" cy="30" r="500" fill="url(#g)"/>
    <g fill="none" stroke="#73DAD4" opacity=".1" stroke-width="2"><circle cx="1250" cy="330" r="280"/><circle cx="1250" cy="330" r="320"/><circle cx="1250" cy="330" r="360"/></g>
    <path d="M700 520L1200 20M820 520L1200 140" stroke="#67E8F9" stroke-width="2" opacity=".07"/>`,
};

// Cartões das áreas (FeatureCategoryGrid): formato quase quadrado, objeto reduzido no quarto superior direito e véu de
// baixo para cima, onde ficam título e descrição. O app alinha a imagem pelo topo, então cartões largos cortam só a base.
// Os objetos são desenhados em torno de (420, 210) e encolhidos por `objectFit`; `back` fica fora da redução.
const CW = 600, CH = 520;
const veilCard = (strength = .86) => `<linearGradient id="veil" x1="0" y1="0" x2="0" y2="1"><stop offset=".3" stop-color="#0B1E28" stop-opacity="0"/><stop offset=".56" stop-color="#0B1E28" stop-opacity="${(strength * .6).toFixed(2)}"/><stop offset="1" stop-color="#0B1E28" stop-opacity="${strength}"/></linearGradient>`;
const objectFit = 'translate(164 -26) scale(.71)';
// Guarda as partes de cada cartão para as miniaturas recomporem o mesmo desenho centralizado.
const cardParts = new Map();
const card = (stops, glowColor, body, glowOp = .5, back = '') => {
  const svg = `<defs>${sky('s', stops)}${glow('g', glowColor, glowOp)}${veilCard()}</defs>
    <rect width="${CW}" height="${CH}" fill="url(#s)"/><circle cx="470" cy="120" r="210" fill="url(#g)"/>${back}<g transform="${objectFit}">${body}</g>
    <rect width="${CW}" height="${CH}" fill="url(#veil)"/>`;
  cardParts.set(svg, { stops, glowColor, body, glowOp });
  return svg;
};
const shadow = (cx, cy, rx) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${Math.round(rx * .12)}" fill="#071D29" opacity=".3"/>`;
const capsule = (x, y, angle, left, right = '#FFFFFF', s = 1) => `<g transform="translate(${x} ${y}) rotate(${angle}) scale(${s})"><rect x="-60" y="-22" width="120" height="44" rx="22" fill="${right}"/><path d="M0 -22H-38A22 22 0 0 0 -38 22H0Z" fill="${left}"/></g>`;
const check = (x, y, s, c, w) => `<path transform="translate(${x} ${y}) scale(${s})" d="M-10 0L-3 8L11 -8" ${stroke(c, w)}/>`;
const clipboard = (rows) => `${shadow(420, 362, 130)}<rect x="320" y="92" width="200" height="252" rx="24" fill="#FFFFFF"/><rect x="336" y="108" width="168" height="220" rx="14" fill="#E8FBFD"/>
    <rect x="375" y="74" width="90" height="42" rx="14" fill="#0E7490"/><circle cx="420" cy="88" r="8" fill="#67E8F9"/>${rows}`;
const dots = (items) => `<g fill="#67E8F9" opacity=".45">${items.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;

const cards = {
  // Corpo e medidas: balança com fita métrica enrolada.
  'card-body': card([[0, '#0B4F64'], [1, '#0891B2']], '#67E8F9', `${shadow(430, 352, 140)}
    <rect x="310" y="110" width="240" height="230" rx="48" fill="#FFFFFF"/><rect x="326" y="126" width="208" height="198" rx="38" fill="#E8FBFD"/>
    <rect x="378" y="150" width="104" height="48" rx="14" fill="#0E7490"/><path d="M398 182A32 32 0 0 1 462 182" ${stroke('#67E8F9', 6)}/><path d="M430 182L446 166" ${stroke('#FFFFFF', 5)}/>
    <rect x="356" y="232" width="56" height="74" rx="22" fill="#B9E9F1"/><rect x="448" y="232" width="56" height="74" rx="22" fill="#B9E9F1"/>
    <rect x="262" y="318" width="236" height="26" rx="6" fill="#F7B24A"/><g ${stroke('#C98322', 3)}>${[300, 330, 360, 390, 420, 450, 480].map((x, i) => `<path d="M${x} 318V${i % 2 ? 328 : 334}"/>`).join('')}</g>
    <circle cx="262" cy="300" r="50" fill="#F7B24A"/><circle cx="262" cy="300" r="34" fill="none" stroke="#C98322" stroke-width="3" opacity=".6"/><circle cx="262" cy="300" r="16" fill="#C98322"/>
    ${dots([[110, 80, 9], [560, 70, 12], [200, 160, 6]])}`),
  // Medicamentos: cartela de comprimidos e cápsula.
  'card-medication': card([[0, '#123B5A'], [1, '#2B7FB8']], '#B9E9F1', `${shadow(420, 345, 150)}
    <g transform="translate(430 196) rotate(-12)"><rect x="-130" y="-92" width="260" height="184" rx="28" fill="#E8FBFD"/><rect x="-130" y="-92" width="260" height="184" rx="28" fill="none" stroke="#B9E9F1" stroke-width="4"/>
      ${[-78, -26, 26, 78].flatMap(x => [-40, 40].map(y => (x === 78 && y === 40) ? `<circle cx="${x}" cy="${y}" r="22" fill="#B9E9F1" opacity=".7"/>` : `<circle cx="${x}" cy="${y}" r="22" fill="#FFFFFF" stroke="#67E8F9" stroke-width="5"/>`)).join('')}</g>
    ${capsule(282, 312, 32, '#F7B24A', '#FFFFFF', 1.15)}
    ${dots([[120, 90, 10], [560, 60, 12], [210, 190, 6]])}`),
  // Suplementos: coqueteleira com shake, scoop cheio de pó e um montinho de pó ao lado.
  'card-supplement': card([[0, '#0E6F80'], [1, '#2BB5A8']], '#D7F6FA', `${shadow(420, 352, 160)}
    <path d="M378 156H502L490 336C489 344 482 350 474 350H406C398 350 391 344 390 336Z" fill="#FFFFFF"/>
    <path d="M384 238H496L490 336C489 344 482 350 474 350H406C398 350 391 344 390 336Z" fill="#E7C49A"/><path d="M384 238H496" ${stroke('#F2DCC0', 6)}/>
    <g ${stroke('#9FD8E2', 4)}><path d="M472 180H488M478 204H488M472 228H488"/></g><path d="M398 176V214" ${stroke('#E8FBFD', 10)}/>
    <rect x="368" y="122" width="144" height="40" rx="14" fill="#3DBB7E"/><path d="M372 150H508" ${stroke('#2E9E6A', 4)} opacity=".6"/>
    <rect x="398" y="94" width="44" height="34" rx="11" fill="#2E9E6A"/><circle cx="480" cy="108" r="16" ${stroke('#2E9E6A', 7)}/>
    <path d="M316 286L376 258" ${stroke('#FFFFFF', 14)}/>
    <path d="M214 284H322C322 318 298 340 268 340S214 318 214 284Z" fill="#FFFFFF"/><path d="M216 286C228 252 308 252 320 286Z" fill="#F4E6D3"/>
    <path d="M506 352C516 324 552 318 570 352Z" fill="#F4E6D3"/>
    <g fill="#F4E6D3"><circle cx="246" cy="250" r="5"/><circle cx="296" cy="244" r="4"/><circle cx="342" cy="330" r="5"/><circle cx="530" cy="318" r="4"/></g>
    ${dots([[110, 90, 9], [250, 150, 7], [570, 70, 12]])}`),
  // Injetáveis: caneta aplicadora na diagonal com janela de dose.
  'card-injectable': card([[0, '#0C4A5E'], [1, '#0E9AA7']], '#67E8F9', `${shadow(420, 350, 160)}
    <g transform="translate(400 214) rotate(-32)"><rect x="-176" y="-24" width="42" height="48" rx="12" fill="#67E8F9"/><rect x="-146" y="-32" width="262" height="64" rx="30" fill="#FFFFFF"/>
      <rect x="-70" y="-14" width="96" height="28" rx="10" fill="#B9E9F1"/><g ${stroke('#0E7490', 3)}><path d="M-56 -6V6M-36 -6V6M-16 -6V6M4 -6V6"/></g>
      <rect x="110" y="-28" width="86" height="56" rx="22" fill="#0891B2"/><path d="M196 0H226" ${stroke('#D7F6FA', 5)}/></g>
    ${dots([[110, 90, 9], [250, 330, 8], [565, 80, 12], [200, 170, 6]])}`),
  // Mente: céu noturno, lua e pictograma meditando.
  'card-mind': card([[0, '#132A45'], [.6, '#2B5C7E'], [1, '#7CC9D8']], '#B9E9F1', `<circle cx="520" cy="96" r="40" fill="#EAF6F9"/><circle cx="540" cy="84" r="36" fill="#1E3F5E" opacity=".55"/>
    <path d="M300 330C360 316 470 316 560 330" ${stroke('#1F4E66', 18)}/>${meditate(430, 330, .95, '#D7F6FA')}`, .55,
    `${stars(26, 5, 200, CW)}<path d="M0 250C140 225 300 235 440 218S560 226 ${CW} 216V${CH}H0Z" fill="#1F4E66"/>`),
  // Alimentação: prato com folhas e frutas, talheres ao lado (diferente da tigela do banner).
  'card-food': card([[0, '#0E6F80'], [1, '#3DBB7E']], '#D7F6FA', `${shadow(420, 352, 150)}
    <circle cx="420" cy="208" r="132" fill="#FFFFFF"/><circle cx="420" cy="208" r="100" fill="#E8FBFD"/>
    <path d="M360 200C340 140 400 120 420 170C410 196 390 206 360 200Z" fill="#2E9E6A"/><path d="M412 172C430 120 494 128 484 182C460 196 432 192 412 172Z" fill="#3DBB7E"/>
    <circle cx="452" cy="236" r="34" fill="#E85D5D"/><circle cx="384" cy="244" r="30" fill="#F7B24A"/><circle cx="384" cy="244" r="20" fill="#FFD27A"/><circle cx="420" cy="214" r="16" fill="#9BE36C"/>
    <g ${stroke('#FFFFFF', 12)}><path d="M246 96V320"/><path d="M228 96V150C228 166 264 166 264 150V96"/></g>
    <path d="M566 96C586 140 584 196 570 222V320" ${stroke('#FFFFFF', 14)}/>
    ${dots([[110, 80, 9], [160, 200, 6]])}`),
  // Minha dieta: prancheta com plano marcado e maçã.
  'card-diet': card([[0, '#0F5A5A'], [1, '#2BA88A']], '#D7F6FA', `${clipboard([150, 204, 258].map((y, i) => `<circle cx="368" cy="${y}" r="16" fill="${i < 2 ? '#3DBB7E' : '#FFFFFF'}" stroke="#3DBB7E" stroke-width="4"/>${i < 2 ? check(368, y, 1, '#FFFFFF', 5) : ''}<rect x="396" y="${y - 8}" width="${[90, 76, 84][i]}" height="16" rx="8" fill="#B9E9F1"/>`).join(''))}
    <circle cx="290" cy="300" r="48" fill="#9BE36C"/><circle cx="270" cy="286" r="12" fill="#D7F6FA" opacity=".55"/><path d="M290 254C288 240 292 230 300 224" ${stroke('#2E9E6A', 6)}/><path d="M298 238C312 220 336 222 342 232C326 246 310 246 298 238Z" fill="#2E9E6A"/>
    ${dots([[110, 90, 9], [570, 80, 12], [190, 180, 6]])}`),
  // Fichas: prancheta com divisões A/B/C e halter.
  'card-plans': card([[0, '#102D3A'], [1, '#07596C']], '#2DD4BF', `${clipboard(['A', 'B', 'C'].map((label, i) => { const y = 150 + i * 54; return `<rect x="352" y="${y - 18}" width="36" height="36" rx="10" fill="${i ? '#B9E9F1' : '#14B8A6'}"/><text x="370" y="${y + 7}" text-anchor="middle" font-family="Arial, sans-serif" font-size="20" font-weight="800" fill="${i ? '#0E7490' : '#FFFFFF'}">${label}</text><rect x="400" y="${y - 8}" width="${[88, 72, 80][i]}" height="16" rx="8" fill="#B9E9F1"/>`; }).join(''))}
    <g transform="translate(286 304) rotate(-28)"><rect x="-86" y="-8" width="172" height="16" rx="8" fill="#D1FAF5"/><g fill="#123746" stroke="#5DB8BA" stroke-width="3"><rect x="-84" y="-40" width="26" height="80" rx="9"/><rect x="58" y="-40" width="26" height="80" rx="9"/><rect x="-108" y="-28" width="22" height="56" rx="7"/><rect x="86" y="-28" width="22" height="56" rx="7"/></g></g>
    <g fill="none" stroke="#67E8F9" opacity=".12" stroke-width="2"><circle cx="430" cy="210" r="200"/><circle cx="430" cy="210" r="240"/></g>`, .35),
  // Histórico: calendário com dias concluídos.
  'card-history': card([[0, '#0E3A4A'], [1, '#0E7490']], '#67E8F9', `${shadow(426, 352, 140)}
    <rect x="300" y="104" width="252" height="236" rx="28" fill="#FFFFFF"/><path d="M300 160V132A28 28 0 0 1 328 104H524A28 28 0 0 1 552 132V160Z" fill="#14B8A6"/>
    <g ${stroke('#0E7490', 10)}><path d="M356 88V120M496 88V120"/></g>
    ${[0, 1, 2].flatMap(row => [0, 1, 2, 3].map(col => { const x = 336 + col * 52, y = 190 + row * 46, done = [0, 1, 3, 4, 6, 9].includes(row * 4 + col); return done ? `<circle cx="${x}" cy="${y}" r="17" fill="#14B8A6"/>${check(x, y, .9, '#FFFFFF', 5)}` : `<rect x="${x - 15}" y="${y - 15}" width="30" height="30" rx="9" fill="#E8FBFD"/>`; })).join('')}
    ${dots([[110, 90, 9], [570, 70, 12], [220, 200, 6]])}`),
  // Cardio: coração com pulso e cronômetro.
  'card-cardio': card([[0, '#102D3A'], [1, '#0B6E7A']], '#2DD4BF', `<defs><linearGradient id="h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FF8A80"/><stop offset="1" stop-color="#E85D5D"/></linearGradient></defs>${shadow(430, 352, 130)}
    <path transform="translate(420 200) scale(.9)" d="M0 110C-150 20 -170 -80 -100 -120C-55 -145 -15 -120 0 -90C15 -120 55 -145 100 -120C170 -80 150 20 0 110Z" fill="url(#h)"/>
    ${pulse(290, 200, .9, '#FFFFFF', 12)}
    <circle cx="270" cy="306" r="50" fill="#FFFFFF"/><circle cx="270" cy="306" r="38" fill="#E8FBFD"/><rect x="258" y="242" width="24" height="16" rx="6" fill="#FFFFFF"/><path d="M270 306V280M270 306L288 316" ${stroke('#0E7490', 6)}/>
    ${dots([[110, 90, 9], [570, 70, 12], [190, 180, 6]])}`, .3),
};

// Só viram miniatura (estados vazios de Grupos e Profissionais); não há cartão de área para eles.
const thumbOnly = {
  // Grupos: rede de pontos ligando três pictogramas.
  'card-groups': card([[0, '#0E5F78'], [1, '#14B8A6']], '#D7F6FA', `${shadow(420, 372, 170)}
    <g ${stroke('#D7F6FA', 7)} opacity=".8"><path d="M300 150L420 96L540 150M300 150L340 236M540 150L500 236M420 96V200"/></g>
    <g fill="#67E8F9"><circle cx="300" cy="150" r="18"/><circle cx="420" cy="96" r="18"/><circle cx="540" cy="150" r="18"/><circle cx="420" cy="200" r="14"/></g>
    ${person(330, 362, 1.05, '#B9E9F1')}${person(510, 362, 1.05, '#B9E9F1')}${person(420, 372, 1.3, '#FFFFFF')}`, .55),
  // Profissionais: pictograma com prancheta de plano e balão de conversa.
  'card-professional': card([[0, '#123B5A'], [1, '#0E7490']], '#B9E9F1', `${shadow(420, 352, 170)}
    ${person(350, 344, 1.5, '#E8FBFD')}
    <rect x="448" y="150" width="124" height="170" rx="18" fill="#FFFFFF"/><rect x="480" y="136" width="60" height="28" rx="10" fill="#0E7490"/>
    ${[196, 236, 276].map((y, i) => `<circle cx="476" cy="${y}" r="11" fill="${i < 2 ? '#3DBB7E' : '#E8FBFD'}"/>${i < 2 ? check(476, y, .7, '#FFFFFF', 5) : ''}<rect x="494" y="${y - 6}" width="${[60, 48, 54][i]}" height="12" rx="6" fill="#B9E9F1"/>`).join('')}
    <path d="M232 92H344A20 20 0 0 1 364 112V150A20 20 0 0 1 344 170H292L268 192V170H232A20 20 0 0 1 212 150V112A20 20 0 0 1 232 92Z" fill="#67E8F9"/>
    <g fill="#FFFFFF"><circle cx="258" cy="131" r="8"/><circle cx="288" cy="131" r="8"/><circle cx="318" cy="131" r="8"/></g>`, .55),
};

// Cada saída recorta a cena (viewBox) no formato do lugar onde é usada e exporta já na resolução de tela 3x,
// para o app não precisar ampliar a imagem ao preencher o cartão.
const exports = [
  ...['sunrise', 'workout', 'mind', 'nutrition', 'health', 'groups'].map(name => ({ name, scene: name, crop: [0, 0, W, H], width: 1500 })),
  { name: 'pulse-tall', scene: 'pulse', crop: [W - H * .8, 0, H * .8, H], width: 1080 },
  { name: 'workout-square', scene: 'workout', crop: [W - H * 1.15, 0, H * 1.15, H], width: 1200 },
];
for (const name of Object.keys(cards)) exports.push({ name, scene: name, crop: [0, 0, CW, CH], width: 720 });
const all = { ...scenes, ...cards };
const size = name => name in cards ? [CW, CH] : [W, H];
// --fitness-only regenera só as cenas de treino; --cards-only, só os cartões das áreas.
const shouldExport = scene => process.argv.includes('--fitness-only') ? ['workout', 'pulse'].includes(scene) : !process.argv.includes('--cards-only') || scene in cards;
const selectedExports = exports.filter(({ scene }) => shouldExport(scene));
await mkdir(out, { recursive: true }); await mkdir(src, { recursive: true });
for (const [name, body] of Object.entries(all).filter(([name]) => shouldExport(name))) { const [w, h] = size(name); await writeFile(fileURLToPath(new URL(`${name}.svg`, src)), `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}">${body}</svg>`); }
for (const { name, scene, crop, width } of selectedExports) {
  const height = Math.round(width * crop[3] / crop[2]);
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="${crop.join(' ')}" width="${width}" height="${height}" preserveAspectRatio="xMaxYMid slice">${all[scene]}</svg>`);
  await sharp(svg).webp({ quality: 90, smartSubsample: true }).toFile(fileURLToPath(new URL(`${name}.webp`, out)));
}
// Miniaturas (atalhos, folha Registrar, estados vazios): o desenho do cartão, sem os pontinhos decorativos, é medido
// pelos pixels e recentralizado num quadrado com brilho ao fundo, assim nenhum objeto fica deslocado ou encosta na borda.
const thumbs = ['mind', 'plans', 'food', 'cardio', 'body', 'medication', 'supplement', 'injectable', 'diet', 'groups', 'professional'];
const T = 300;
if (!process.argv.includes('--fitness-only')) for (const name of thumbs) {
  const { stops, glowColor, body, glowOp } = cardParts.get({ ...cards, ...thumbOnly }[`card-${name}`]);
  const objects = body.replace(/<g fill="#67E8F9" opacity="\.45">.*?<\/g>/s, '');
  const { info } = await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${CW} ${CH}" width="${CW}" height="${CH}">${objects}</svg>`)).trim().toBuffer({ resolveWithObject: true });
  const x = -info.trimOffsetLeft, y = -info.trimOffsetTop, k = T * .76 / Math.max(info.width, info.height);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${T} ${T}" width="264" height="264"><defs>${sky('s', stops)}${glow('g', glowColor, Math.min(glowOp + .2, .8))}</defs>
    <rect width="${T}" height="${T}" fill="url(#s)"/><circle cx="${T / 2}" cy="${T / 2}" r="${T * .5}" fill="url(#g)"/>
    <g transform="translate(${(T / 2 - k * (x + info.width / 2)).toFixed(1)} ${(T / 2 - k * (y + info.height / 2)).toFixed(1)}) scale(${k.toFixed(4)})">${objects}</g></svg>`;
  await sharp(Buffer.from(svg)).webp({ quality: 90, smartSubsample: true }).toFile(fileURLToPath(new URL(`thumb-${name}.webp`, out)));
}
console.log(`Cenas geradas: ${selectedExports.map(item => item.name).join(', ')}${process.argv.includes('--fitness-only') ? '' : `, ${thumbs.map(name => `thumb-${name}`).join(', ')}`}.`);
