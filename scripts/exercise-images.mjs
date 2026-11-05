import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(root, 'design/exercise-images/manifest.json');
const args = process.argv.slice(2);
const publish = args[0] === '--publish';
if (!(args.length === 1 && args[0] === '--check') && !(publish && args.length === 2)) {
  console.error('Uso: node scripts/exercise-images.mjs --check | --publish <slug>');
  process.exit(1);
}

async function main() {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  const statuses = new Set(['pending', 'generated', 'ready', 'published']);
  const slugs = new Set();
  const ids = new Set();
  const files = new Map();
  const errors = [];
  for (const item of manifest.exercises) {
    if (!/^[a-z0-9-]+$/.test(item.slug) || slugs.has(item.slug)) errors.push(`Slug inválido/repetido: ${item.slug}`);
    slugs.add(item.slug);
    if (!statuses.has(item.imageStatus)) errors.push(`Status inválido: ${item.slug}`);
    if (item.catalogExerciseId) {
      if (!/^[a-f0-9-]{36}$/.test(item.catalogExerciseId) || ids.has(item.catalogExerciseId)) errors.push(`ID inválido/repetido: ${item.slug}`);
      ids.add(item.catalogExerciseId);
    }
    const path = resolve(root, item.imagePath);
    const within = relative(resolve(root, 'design/exercise-images/images'), path);
    if (!within || within === '..' || within.startsWith(`..${sep}`) || within.startsWith(sep)) {
      errors.push(`Caminho fora da coleção: ${item.slug}`);
      continue;
    }
    let exists = false;
    try { exists = (await stat(path)).isFile(); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    files.set(item.slug, exists);
    if (item.imageStatus !== 'pending' && !exists) errors.push(`Imagem ausente: ${item.slug}`);
    if (['ready', 'published'].includes(item.imageStatus) && !item.catalogExerciseId) errors.push(`Exercício sem vínculo: ${item.slug}`);
    if (item.imageStatus === 'published' && (!item.imageUrl || !item.publishedSha256)) errors.push(`Publicação sem recibo: ${item.slug}`);
  }
  if (errors.length) throw new Error(errors.join('\n'));

  if (publish) {
    const item = manifest.exercises.find(row => row.slug === args[1]);
    if (!item || !['ready', 'published'].includes(item.imageStatus)) throw new Error('Selecione um exercício revisado com imageStatus="ready".');
    const api = new URL(process.env.ORAMI_API_URL || 'http://localhost:3000');
    if (api.protocol !== 'https:' && !(api.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(api.hostname))) throw new Error('Use HTTPS fora do ambiente local.');
    if (api.username || api.password || api.search || api.hash) throw new Error('URL da API inválida.');
    const token = process.env.ORAMI_ADMIN_TOKEN;
    if (!token) throw new Error('Defina ORAMI_ADMIN_TOKEN com uma sessão administrativa; não salve o token no manifesto.');
    const request = async (path, options = {}) => {
      const response = await fetch(`${api.href.replace(/\/$/, '')}${path}`, {
        ...options, redirect: 'error', signal: AbortSignal.timeout(30_000),
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      });
      if (!response.ok) throw new Error(`API retornou HTTP ${response.status}; manifesto não atualizado. Confira o portal antes de repetir.`);
      return response.json();
    };
    const bytes = await readFile(resolve(root, item.imagePath));
    if (bytes.length > 8 * 1024 * 1024) throw new Error('A imagem excede o limite de 8 MB.');
    const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[/\.[^.]+$/.exec(item.imagePath)?.[0]?.toLowerCase()];
    if (!mime) throw new Error('Use PNG, JPEG ou WebP.');
    const hash = createHash('sha256').update(bytes).digest('hex');
    const content = await request(`/portal/content/${item.catalogExerciseId}`);
    if (content.kind !== 'exercise' || content.scope !== 'global' || content.name !== item.catalogName) throw new Error('ID/nome/escopo divergem do catálogo; revise o vínculo neste ambiente.');
    if (item.imageStatus === 'published' && item.publishedSha256 === hash && content.data?.imageUrl === item.imageUrl) {
      console.log('A imagem já está publicada e o vínculo foi confirmado.');
    } else {
      if (content.data?.imageUrl) throw new Error('O exercício já tem imagem. Substituições devem ser revisadas pelo portal administrativo.');
      const result = await request(`/portal/content/${item.catalogExerciseId}/image`, {
        method: 'PUT', body: JSON.stringify({ imageDataUrl: `data:${mime};base64,${bytes.toString('base64')}` }),
      });
      if (!/^\/media\/exercises\/[a-f0-9-]{36}\.webp$/.test(result.imageUrl)) throw new Error('Resposta de publicação inesperada; confira o portal antes de repetir.');
      item.imageUrl = result.imageUrl;
      item.imageStatus = 'published';
      item.publishedSha256 = hash;
      await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
      console.log(`Imagem publicada: ${item.name}`);
    }
  }

  const labels = { pending: 'Pendente', generated: 'Gerada; revisar', ready: 'Revisada; pronta para publicar', published: 'Publicada' };
  const lines = ['# Imagens dos exercícios — Orami', '',
    'Checklist gerada por `node scripts/exercise-images.mjs --check`. Edite `manifest.json` e regenere este arquivo.', '',
    `Catálogo consultado: ${manifest.catalogCheckedAt}. ${manifest.catalogSource}`, '',
    'Os IDs abaixo já foram conferidos no banco consultado. Isso não significa que as imagens foram publicadas.', '',
    'O check indica publicação pela API. Arquivos locais disponíveis ficam clicáveis; caminhos sem arquivo são destinos planejados.', ''];
  for (const group of new Set(manifest.exercises.map(item => item.group))) {
    lines.push(`## ${group}`, '');
    for (const item of manifest.exercises.filter(item => item.group === group)) {
      const localPath = relative(dirname(manifestPath), resolve(root, item.imagePath));
      lines.push(`- [${item.imageStatus === 'published' ? 'x' : ' '}] **${item.name}** — ${labels[item.imageStatus]}`);
      lines.push(`  - Catálogo: ${item.catalogName || 'Vínculo pendente'}; ID: ${item.catalogExerciseId ? `\`${item.catalogExerciseId}\`` : '—'}.`);
      lines.push(`  - Imagem: ${files.get(item.slug) ? `[abrir arquivo](${localPath})` : `\`${item.imagePath}\` (a gerar)`}.`);
      if (item.mappingNote) lines.push(`  - ${item.mappingNote}`);
      if (item.imageUrl) lines.push(`  - URL publicada: \`${item.imageUrl}\`.`);
    }
    lines.push('');
  }
  await writeFile(resolve(dirname(manifestPath), 'CHECKLIST.md'), `${lines.join('\n')}\n`);
  console.log(`${manifest.exercises.length} exercícios; ${ids.size} vínculos; ${[...files.values()].filter(Boolean).length} arquivos; ${manifest.exercises.filter(item => item.imageStatus === 'published').length} publicados.`);
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
