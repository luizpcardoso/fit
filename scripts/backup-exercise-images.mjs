import { mkdir, cp, readFile, writeFile, readdir, lstat, rename } from 'node:fs/promises';
import { resolve, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { apiConfig, apiClient, collectionFile, externalPath, fetchMedia, json, manifestFile, sha256, withCollectionLock, writeJson } from './lib/exercise-images.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

async function inventory(directory, base = directory, result = {}) {
  for (const entry of await readdir(directory)) {
    const path = resolve(directory, entry);
    const info = await lstat(path);
    if (info.isSymbolicLink()) throw new Error('Links simbólicos não são aceitos na coleção.');
    if (info.isDirectory()) await inventory(path, base, result);
    else if (info.isFile()) result[relative(base, path)] = sha256(await readFile(path));
  }
  return result;
}

export async function backupCollection(projectRoot, { destination, slug, publishedConfig } = {}) {
  const source = resolve(projectRoot, 'design/exercise-images');
  await inventory(source);
  const target = resolve(destination || resolve(projectRoot, '../exercise-image-backups'));
  await mkdir(target, { recursive: true, mode: 0o700 });
  await externalPath(projectRoot, target);
  const stamp = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
  const final = resolve(target, stamp);
  const staging = `${final}.partial`;
  await mkdir(staging, { mode: 0o700 });
  await cp(source, resolve(staging, 'collection'), { recursive: true, dereference: false });
  const manifest = await json(manifestFile(projectRoot));
  const candidates = slug ? manifest.exercises.filter(item => item.slug === slug) : manifest.exercises.filter(item => item.imageStatus !== 'pending');
  if (slug && !candidates.length) throw new Error('Exercício inexistente no manifesto.');
  const receipt = { schemaVersion: 1, createdAt: new Date().toISOString(), kind: 'originals', items: [] };
  for (const item of candidates) {
    const sourceImage = await collectionFile(projectRoot, item.imagePath);
    const stem = item.imagePath.replace(/\.[^.]+$/, '');
    const prompt = item.promptPath || (await lstat(resolve(projectRoot, `${stem}.prompt.txt`)).catch(() => null) ? `${stem}.prompt.txt`
      : await lstat(resolve(projectRoot, `${stem}-prompt.txt`)).catch(() => null) ? `${stem}-prompt.txt` : null);
    // Não inventar prompts de imagens legadas recebidas sem esse arquivo.
    const sourcePrompt = prompt ? await collectionFile(projectRoot, prompt) : null;
    const imageFile = `collection/${relative(source, sourceImage)}`;
    const promptFile = sourcePrompt ? `collection/${relative(source, sourcePrompt)}` : null;
    const hash = sha256(await readFile(sourceImage));
    if (sha256(await readFile(resolve(staging, imageFile))) !== hash) throw new Error('Cópia divergente; execute sem alterações simultâneas.');
    receipt.items.push({ slug: item.slug, sha256: hash, imageFile, promptFile, promptSha256: promptFile ? sha256(await readFile(resolve(staging, promptFile))) : null, review: item.review ?? null });
  }
  await writeJson(resolve(staging, 'receipt.json'), receipt);
  await writeFile(resolve(staging, 'RESTORE.md'), `# Restaurar imagens dos exercícios

Este lote guarda originais, prompts, revisão e controles em collection/. Confira files-sha256.json antes de restaurar. receipt.json relaciona exercícios aos hashes dos originais.

Copie a coleção para uma área de recuperação; compare com o repositório atual antes de substituir arquivos. Refaça os recibos de backup se o caminho externo mudar. Não restaure o manifesto inteiro sobre publicações mais recentes.

Se existir published/, environment.json identifica a origem consultada, catalog-image-links.json os vínculos e media/ os WebPs. Os hashes estão no inventário geral. Essa consulta reflete somente a API identificada, não outros ambientes. Confira IDs/nomes no destino e restaure pelo fluxo administrativo após backup do destino; não aplique valores nulos para apagar imagens posteriores. Não reescreva fichas nem históricos.

Sem credenciais, dados pessoais ou dump do banco. Backup no mesmo computador não protege contra perda do equipamento. Diretórios .partial representam operações incompletas e não autorizam publicação.
`);
  await writeJson(resolve(staging, 'files-sha256.json'), await inventory(staging));
  await rename(staging, final);
  execFileSync('tar', ['-czf', `${final}.tar.gz.partial`, '-C', target, stamp]);
  await rename(`${final}.tar.gz.partial`, `${final}.tar.gz`);
  for (const entry of receipt.items) {
    manifest.exercises.find(item => item.slug === entry.slug).backup = { receiptPath: resolve(final, 'receipt.json'), sha256: entry.sha256 };
  }
  await writeJson(manifestFile(projectRoot), manifest);

  // Originais já estão protegidos e registrados, mesmo se a API falhar agora.
  if (publishedConfig) {
    const mediaStage = resolve(final, 'published.partial');
    await mkdir(resolve(mediaStage, 'media'), { recursive: true });
    const request = apiClient(publishedConfig);
    const links = [];
    for (let offset = 0; ; offset += 200) {
      const page = await request(`/portal/content?kind=exercise&scope=global&offset=${offset}`);
      if (!Array.isArray(page)) throw new Error('Lista do portal inválida.');
      for (const row of page) {
        if (row.kind !== 'exercise' || row.scope !== 'global') throw new Error('Conteúdo fora do catálogo global.');
        const imageUrl = row.data?.imageUrl ?? null;
        links.push({ id: row.id, name: row.name, imageUrl });
        if (imageUrl) {
          const bytes = await fetchMedia(publishedConfig, imageUrl);
          await writeFile(resolve(mediaStage, 'media', imageUrl.split('/').at(-1)), bytes);
        }
      }
      if (page.length < 200) break;
      await new Promise(done => setTimeout(done, 1_000));
    }
    await writeJson(resolve(mediaStage, 'catalog-image-links.json'), links);
    await writeJson(resolve(mediaStage, 'environment.json'), { apiUrl: publishedConfig.apiUrl, environment: publishedConfig.environment, checkedAt: new Date().toISOString() });
    await rename(mediaStage, resolve(final, 'published'));
    const hashes = await inventory(final);
    delete hashes['files-sha256.json'];
    await writeJson(resolve(final, 'files-sha256.json'), hashes);
    execFileSync('tar', ['-czf', `${final}.tar.gz.partial`, '-C', target, stamp]);
    await rename(`${final}.tar.gz.partial`, `${final}.tar.gz`);
  }
  return final;
}

async function main() {
  const args = process.argv.slice(2);
  let slug;
  let published = false;
  for (let index = 0; index < args.length; index++) {
    if (args[index] === '--published' && !published) published = true;
    else if (args[index] === '--item' && !slug && args[index + 1]) slug = args[++index];
    else throw new Error('Uso: node scripts/backup-exercise-images.mjs [--item <slug>] [--published]');
  }
  const directory = await backupCollection(root, { destination: process.env.ORAMI_IMAGE_BACKUP_DIR, slug, publishedConfig: published ? apiConfig() : undefined });
  console.log(`Backup externo: ${directory}\nArquivo: ${directory}.tar.gz`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  withCollectionLock(root, main).catch(error => { console.error(error.message); process.exitCode = 1; });
}
