import { readFile, writeFile, stat } from 'node:fs/promises';
import { resolve, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { acceptedPublication, apiConfig, json, publishItem, selectCandidates, withCollectionLock, writeJson } from './lib/exercise-images.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const manifestPath = resolve(root, 'design/exercise-images/manifest.json');
const args = process.argv.slice(2);
const publish = args[0] === '--publish';
const select = args[0] === '--select';
if (!(args.length === 1 && args[0] === '--check') && !(publish && args.length >= 2) && !(select && args.length === 3)) {
  console.error('Uso: node scripts/exercise-images.mjs --check | --publish <slug...> | --select <consulta.json> <quantidade>');
  process.exit(1);
}

async function main() {
  if (select) {
    const input = await json(resolve(args[1]));
    if (input.environment !== 'production' || input.apiUrl !== 'https://orami.com.br' || !Number.isFinite(Date.parse(input.checkedAt)) || typeof input.usageAvailable !== 'boolean' || !Array.isArray(input.exercises)) throw new Error('Informe origem de produção, data da consulta, usageAvailable e exercises.');
    const guide = await readFile(resolve(root, 'design/exercise-images/STYLE_GUIDE.md'), 'utf8');
    const common = guide.split('<!-- priority:start -->')[1]?.split('<!-- priority:end -->')[0].split('\n').filter(line => /^\d+\. /.test(line)).map(line => line.replace(/^\d+\. /, '').trim());
    if (!common?.length) throw new Error('Lista de prioridades ausente do guia.');
    if (!input.usageAvailable) console.error('Sem contagens de uso: priorizando movimentos comuns.');
    const rows = input.usageAvailable ? input.exercises : input.exercises.map(row => ({ ...row, activePlanCount: 0 }));
    console.log(JSON.stringify(selectCandidates(rows, common, Number(args[2])), null, 2));
    return;
  }
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
    if (item.imageStatus === 'published' && !(item.imageUrl && item.publishedSha256) && !Object.values(item.publications ?? {}).some(receipt => receipt.imageUrl && receipt.sha256)) errors.push(`Publicação sem recibo: ${item.slug}`);
  }
  if (errors.length) throw new Error(errors.join('\n'));

  if (publish) {
    const config = apiConfig();
    let failures = 0;
    for (const [index, slug] of [...new Set(args.slice(1))].entries()) {
      // Até 10 uploads/minuto, abaixo do limite de 12/min da rota.
      if (index) await new Promise(done => setTimeout(done, 6_100));
      const item = manifest.exercises.find(row => row.slug === slug);
      try {
        const receipt = await publishItem(root, manifest, item, config);
        console.log(`${slug}: vínculo e WebP confirmados em ${receipt.environment}; revisão visual do WebP e conferência no app ainda devem ser registradas.`);
      } catch (error) {
        failures++;
        if (item) {
          item.lastPublicationError = { apiUrl: config.apiUrl, at: new Date().toISOString(), message: error.message };
          await writeJson(manifestPath, manifest);
        }
        console.error(`${slug}: ${error.message}`);
      }
    }
    if (failures) process.exitCode = 1;
  }

  const labels = { pending: 'Pendente', generated: 'Gerada; revisar', ready: 'Revisada; pronta para publicar', published: 'Publicada' };
  const lines = ['# Imagens dos exercícios — Orami', '',
    'Checklist gerada por `node scripts/exercise-images.mjs --check`. Edite `manifest.json` e regenere este arquivo.', '',
    `Catálogo consultado: ${manifest.catalogCheckedAt}. ${manifest.catalogSource}`, '',
    'Os IDs abaixo já foram conferidos no banco consultado. Isso não significa que as imagens foram publicadas.', '',
    'O check indica publicação registrada em algum ambiente; confira o destino e a aceitação de cada recibo. Registros legados não comprovam o estado remoto atual. Arquivos locais disponíveis ficam clicáveis; caminhos sem arquivo são destinos planejados.', ''];
  for (const group of new Set(manifest.exercises.map(item => item.group))) {
    lines.push(`## ${group}`, '');
    for (const item of manifest.exercises.filter(item => item.group === group)) {
      const localPath = relative(dirname(manifestPath), resolve(root, item.imagePath));
      lines.push(`- [${item.imageStatus === 'published' ? 'x' : ' '}] **${item.name}** — ${labels[item.imageStatus]}`);
      lines.push(`  - Catálogo: ${item.catalogName || 'Vínculo pendente'}; ID: ${item.catalogExerciseId ? `\`${item.catalogExerciseId}\`` : '—'}.`);
      lines.push(`  - Imagem: ${files.get(item.slug) ? `[abrir arquivo](${localPath})` : `\`${item.imagePath}\` (a gerar)`}.`);
      if (item.mappingNote) lines.push(`  - ${item.mappingNote}`);
      for (const [apiUrl, receipt] of Object.entries(item.publications ?? {})) {
        lines.push(`  - ${receipt.environment} (${apiUrl}): \`${receipt.imageUrl}\`; mídia ${receipt.verifiedAt ? 'verificada' : 'a verificar'}; aceite ${acceptedPublication(receipt) ? 'registrado' : 'pendente (visual/app)'}.`);
      }
      if (item.imageUrl) lines.push(`  - URL publicada: \`${item.imageUrl}\`.`);
    }
    lines.push('');
  }
  await writeFile(resolve(dirname(manifestPath), 'CHECKLIST.md'), `${lines.join('\n')}\n`);
  console.log(`${manifest.exercises.length} exercícios; ${ids.size} vínculos; ${[...files.values()].filter(Boolean).length} arquivos; ${manifest.exercises.filter(item => item.imageStatus === 'published').length} publicados.`);
}

withCollectionLock(root, main).catch(error => { console.error(error.message); process.exitCode = 1; });
