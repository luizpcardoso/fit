import { readFile, writeFile, rename, mkdir, realpath, open, unlink } from 'node:fs/promises';
import { resolve, relative, isAbsolute, dirname } from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export const json = async path => JSON.parse(await readFile(path, 'utf8'));
export const mediaPattern = /^\/media\/exercises\/[a-f0-9-]{36}\.webp$/;
export const manifestFile = root => resolve(root, 'design/exercise-images/manifest.json');

export async function writeJson(path, value) {
  const temporary = `${path}.${randomUUID()}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, path);
}

export function inside(parent, child) {
  const path = relative(parent, child);
  return path === '' || (!path.startsWith('..' + '/') && path !== '..' && !isAbsolute(path));
}

export async function externalPath(root, path) {
  const canonical = await realpath(path);
  if (inside(await realpath(root), canonical)) throw new Error('O backup deve ficar fora do repositório.');
  return canonical;
}

export async function collectionFile(root, path) {
  const base = await realpath(resolve(root, 'design/exercise-images'));
  const canonical = await realpath(resolve(root, path));
  if (!inside(base, canonical)) throw new Error('Arquivo fora da coleção.');
  return canonical;
}

export async function withCollectionLock(root, action) {
  const directory = resolve(root, 'artifacts/exercise-image-backups');
  await mkdir(directory, { recursive: true });
  const path = resolve(directory, 'collection.lock');
  let handle;
  try { handle = await open(path, 'wx', 0o600); }
  catch (error) {
    if (error.code === 'EEXIST') throw new Error('Outra operação está em andamento; se houve interrupção, confira os processos antes de remover collection.lock.');
    throw error;
  }
  try { return await action(); }
  finally { await handle.close(); await unlink(path); }
}

export function apiConfig(env = process.env) {
  if (!env.ORAMI_API_URL || !env.ORAMI_IMAGE_ENV) throw new Error('Defina ORAMI_API_URL e ORAMI_IMAGE_ENV explicitamente (production, local ou staging).');
  const api = new URL(env.ORAMI_API_URL);
  if (!['production', 'local', 'staging'].includes(env.ORAMI_IMAGE_ENV)) throw new Error('ORAMI_IMAGE_ENV inválido.');
  if (api.protocol !== 'https:' && !(api.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(api.hostname))) throw new Error('Use HTTPS fora do ambiente local.');
  if (api.username || api.password || api.search || api.hash || api.pathname !== '/') throw new Error('Use a origem da API, sem credenciais, caminho ou parâmetros.');
  if ((api.hostname === 'orami.com.br') !== (env.ORAMI_IMAGE_ENV === 'production')) throw new Error('O ambiente production corresponde exclusivamente a https://orami.com.br.');
  if (!env.ORAMI_ADMIN_TOKEN) throw new Error('Defina ORAMI_ADMIN_TOKEN com uma sessão administrativa, sem registrá-lo em arquivos.');
  return { apiUrl: api.origin, environment: env.ORAMI_IMAGE_ENV, token: env.ORAMI_ADMIN_TOKEN };
}

export function apiClient(config) {
  return async (path, options = {}) => {
    const response = await fetch(`${config.apiUrl}${path}`, {
      ...options, redirect: 'error', signal: AbortSignal.timeout(30_000),
      headers: { authorization: `Bearer ${config.token}`, 'content-type': 'application/json' },
    });
    if (!response.ok) throw new Error(`API retornou HTTP ${response.status}; confira o destino antes de repetir.`);
    return response.json();
  };
}

export async function catalogItem(request, id) {
  // O portal expõe listagem paginada, não GET /portal/content/:id.
  for (let offset = 0; ; offset += 200) {
    const page = await request(`/portal/content?kind=exercise&scope=global&offset=${offset}`);
    if (!Array.isArray(page)) throw new Error('Lista do portal inválida.');
    const item = page.find(row => row.id === id);
    if (item) return item;
    if (page.length < 200) throw new Error('Exercício inexistente no catálogo global deste ambiente.');
    await new Promise(done => setTimeout(done, 1_000));
  }
}

export async function fetchMedia(config, imageUrl) {
  if (!mediaPattern.test(imageUrl)) throw new Error('URL de mídia inesperada.');
  // Mídia pública: nunca encaminhar o token administrativo.
  const response = await fetch(`${config.apiUrl}${imageUrl}`, { redirect: 'error', signal: AbortSignal.timeout(30_000) });
  if (!response.ok || !response.headers.get('content-type')?.startsWith('image/webp')) throw new Error('WebP público indisponível ou inválido.');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 12 || bytes.toString('ascii', 0, 4) !== 'RIFF' || bytes.toString('ascii', 8, 12) !== 'WEBP') throw new Error('Conteúdo recebido não é WebP.');
  return bytes;
}

export async function verifyBackup(root, item, hash) {
  if (!item.backup?.receiptPath || item.backup.sha256 !== hash) throw new Error('Backup ausente ou divergente; execute backup-exercise-images.mjs.');
  const receiptPath = await externalPath(root, item.backup.receiptPath);
  if (receiptPath.split('/').some(part => part.endsWith('.partial'))) throw new Error('Backup incompleto (.partial).');
  const receipt = await json(receiptPath);
  const entry = receipt.items?.find(row => row.slug === item.slug && row.sha256 === hash);
  if (!entry) throw new Error('Recibo de backup não corresponde ao original.');
  if (!entry.promptFile || !entry.promptSha256) throw new Error('Prompt ausente no backup; novas publicações exigem o prompt real.');
  const imagePath = await externalPath(root, resolve(dirname(receiptPath), entry.imageFile));
  const promptPath = await externalPath(root, resolve(dirname(receiptPath), entry.promptFile));
  if (!inside(dirname(receiptPath), imagePath) || !inside(dirname(receiptPath), promptPath)) throw new Error('Arquivo fora do lote de backup.');
  if (sha256(await readFile(imagePath)) !== hash || sha256(await readFile(promptPath)) !== entry.promptSha256) throw new Error('Arquivo de backup alterado ou corrompido.');
}

export function acceptedPublication(receipt) {
  const acceptance = receipt.acceptance;
  return Boolean(receipt.verifiedAt && acceptance?.sha256 === receipt.sha256 && acceptance?.mediaSha256 === receipt.mediaSha256
    && acceptance?.reviewer === 'assistant' && Number.isFinite(Date.parse(acceptance?.reviewedAt))
    && acceptance?.notes?.trim() && Number.isFinite(Date.parse(acceptance?.appCheckedAt)) && acceptance?.appNotes?.trim());
}

export function assertReviewed(item, hash) {
  const review = item.review;
  if (review?.result !== 'approved' || review.sha256 !== hash || review.reviewer !== 'assistant' || !Number.isFinite(Date.parse(review.reviewedAt)) || !review.notes?.trim()) throw new Error('Registre a inspeção visual aprovada, datada e vinculada ao SHA-256 atual em review.');
}

export async function publishItem(root, manifest, item, config, request = apiClient(config)) {
  if (!item || !['ready', 'published'].includes(item.imageStatus) || !item.catalogExerciseId || !item.catalogName) throw new Error('Selecione um exercício identificado e revisado (ready).');
  const bytes = await readFile(await collectionFile(root, item.imagePath));
  const hash = sha256(bytes);
  assertReviewed(item, hash);
  await verifyBackup(root, item, hash);
  if (bytes.length > 8 * 1024 * 1024) throw new Error('A imagem excede 8 MB.');
  const mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' }[/\.[^.]+$/.exec(item.imagePath)?.[0]?.toLowerCase()];
  if (!mime) throw new Error('Use PNG, JPEG ou WebP.');
  item.publications ??= {};
  const receipt = item.publications[config.apiUrl];
  const content = await catalogItem(request, item.catalogExerciseId);
  if (content.id !== item.catalogExerciseId || content.kind !== 'exercise' || content.scope !== 'global' || content.archived || content.name !== item.catalogName) throw new Error('ID/nome/escopo divergem ou exercício arquivado; revise o vínculo no destino.');
  let publication = receipt;
  if (content.data?.imageUrl) {
    if (receipt?.sha256 !== hash || receipt.imageUrl !== content.data.imageUrl || receipt.environment !== config.environment) throw new Error('O exercício já tem imagem sem recibo correspondente. Reconcilie pelo portal; não haverá substituição automática.');
  } else {
    if (receipt) throw new Error('Recibo anterior existe, mas o vínculo remoto sumiu. Reconcilie antes de publicar.');
    // Persistir antes do PUT: uma resposta perdida nunca autoriza repetir o envio.
    item.publicationAttempts ??= {};
    if (item.publicationAttempts[config.apiUrl]?.state === 'uncertain') throw new Error('Tentativa anterior sem confirmação. Reconcilie pelo portal antes de repetir.');
    item.publicationAttempts[config.apiUrl] = { state: 'uncertain', sha256: hash, attemptedAt: new Date().toISOString(), environment: config.environment };
    await writeJson(manifestFile(root), manifest);
    const result = await request(`/portal/content/${item.catalogExerciseId}/image`, {
      method: 'PUT', body: JSON.stringify({ imageDataUrl: `data:${mime};base64,${bytes.toString('base64')}` }),
    });
    if (!mediaPattern.test(result.imageUrl)) throw new Error('Resposta inesperada; reconcilie pelo portal antes de repetir.');
    publication = item.publications[config.apiUrl] = { environment: config.environment, imageUrl: result.imageUrl, sha256: hash, publishedAt: new Date().toISOString() };
    item.publicationAttempts[config.apiUrl].state = 'confirmed';
    item.imageStatus = 'published';
    // Campos legados permanecem intactos. Novos recibos são por origem da API.
    await writeJson(manifestFile(root), manifest);
  }
  const confirmed = await catalogItem(request, item.catalogExerciseId);
  if (confirmed.id !== item.catalogExerciseId || confirmed.data?.imageUrl !== publication.imageUrl) throw new Error('Vínculo mudou após o envio. Confira o portal.');
  const webp = await fetchMedia(config, publication.imageUrl);
  publication.mediaSha256 = sha256(webp);
  publication.verifiedAt = new Date().toISOString();
  delete item.lastPublicationError;
  await writeJson(manifestFile(root), manifest);
  return publication;
}

export function selectCandidates(rows, commonNames, count) {
  if (!Number.isInteger(count) || count < 1) throw new Error('Quantidade deve ser um inteiro positivo.');
  const seen = new Set();
  const rank = name => { const index = commonNames.indexOf(name); return index < 0 ? Infinity : index; };
  return rows.filter(row => {
    if (!row.id || !row.name || seen.has(row.id) || row.imageKey || row.imageUrl || row.archived) return false;
    seen.add(row.id);
    if (!Number.isSafeInteger(Number(row.activePlanCount)) || Number(row.activePlanCount) < 0) throw new Error('Contagem agregada inválida.');
    return true;
  }).sort((a, b) => Number(b.activePlanCount) - Number(a.activePlanCount) || rank(a.name) - rank(b.name) || a.name.localeCompare(b.name, 'pt-BR')).slice(0, count);
}
