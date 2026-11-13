import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm, symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import { execFileSync } from 'node:child_process';
import { backupCollection } from '../backup-exercise-images.mjs';
import { acceptedPublication, apiConfig, catalogItem, json, manifestFile, publishItem, selectCandidates, sha256, verifyBackup, withCollectionLock, writeJson } from '../lib/exercise-images.mjs';

async function fixture(t) {
  const base = await mkdtemp(resolve(tmpdir(), 'orami-images-'));
  t.after(() => rm(base, { recursive: true, force: true }));
  const root = resolve(base, 'repo');
  await mkdir(resolve(root, 'design/exercise-images/images'), { recursive: true });
  const bytes = Buffer.from('original de teste');
  const item = { slug: 'agachamento-livre', name: 'Agachamento livre', catalogName: 'Agachamento livre', catalogExerciseId: '00000000-0000-4000-8000-000000000001', imagePath: 'design/exercise-images/images/agachamento-livre.png', imageStatus: 'ready', review: { result: 'approved', sha256: sha256(bytes), reviewer: 'assistant', reviewedAt: new Date().toISOString(), notes: 'Inspeção simulada exclusivamente para teste.' } };
  const manifest = { exercises: [item] };
  await writeFile(resolve(root, item.imagePath), bytes);
  await writeFile(resolve(root, 'design/exercise-images/images/agachamento-livre.prompt.txt'), 'prompt específico');
  await writeJson(manifestFile(root), manifest);
  return { base, root, item, manifest, bytes };
}

async function backup(f) {
  const directory = await backupCollection(f.root);
  Object.assign(f.item, (await json(manifestFile(f.root))).exercises[0]);
  return directory;
}

async function server(t, item, options = {}) {
  let imageUrl = options.existing || null;
  let uploads = 0;
  let mediaToken;
  const media = '/media/exercises/00000000-0000-4000-8000-000000000099.webp';
  const webp = Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA', 'base64');
  const http = createServer(async (req, res) => {
    req.resume();
    if (req.url.startsWith('/media/')) {
      mediaToken = req.headers.authorization;
      res.writeHead(options.mediaFailure ? 404 : 200, { 'content-type': 'image/webp' });
      res.end(webp);
      return;
    }
    if (req.method === 'PUT') {
      uploads++;
      imageUrl = media;
      if (options.lostResponse) { req.socket.destroy(); return; }
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ imageUrl }));
      return;
    }
    if (!req.url.startsWith('/portal/content?')) { res.writeHead(404); res.end(); return; }
    res.setHeader('content-type', 'application/json');
    const row = { id: item.catalogExerciseId, kind: 'exercise', scope: 'global', archived: false, name: options.name || item.catalogName, data: { imageUrl } };
    res.end(JSON.stringify(options.listFailure ? {} : [row]));
  });
  await new Promise(done => http.listen(0, '127.0.0.1', done));
  t.after(() => new Promise(done => { http.close(done); http.closeAllConnections(); }));
  const config = { apiUrl: `http://127.0.0.1:${http.address().port}`, environment: 'local', token: 'somente-teste' };
  return { config, uploads: () => uploads, mediaToken: () => mediaToken };
}

test('backup externo independe do banco, arquiva coleção e confere hashes', async t => {
  const f = await fixture(t);
  await assert.rejects(verifyBackup(f.root, f.item, sha256(f.bytes)), /Backup ausente/);
  const directory = await backup(f);
  await verifyBackup(f.root, f.item, sha256(f.bytes));
  const listing = execFileSync('tar', ['-tzf', `${directory}.tar.gz`], { encoding: 'utf8' });
  assert.match(listing, /RESTORE.md/);
  assert.match(listing, /receipt.json/);
  const receipt = await json(resolve(directory, 'receipt.json'));
  assert.equal(receipt.items[0].review.sha256, sha256(f.bytes));
  await writeFile(resolve(directory, receipt.items[0].imageFile), 'corrompido');
  await assert.rejects(verifyBackup(f.root, f.item, sha256(f.bytes)), /corrompido/);
});

test('recusa backup interno, inclusive através de symlink', async t => {
  const f = await fixture(t);
  await assert.rejects(backupCollection(f.root, { destination: resolve(f.root, 'backups') }), /fora do repositório/);
  const alias = resolve(f.base, 'alias');
  await symlink(f.root, alias);
  await assert.rejects(backupCollection(f.root, { destination: resolve(alias, 'backups') }), /fora do repositório/);
});

test('preserva imagem legada sem prompt, mas bloqueia sua publicação', async t => {
  const f = await fixture(t);
  await rm(resolve(f.root, 'design/exercise-images/images/agachamento-livre.prompt.txt'));
  const directory = await backup(f);
  const receipt = await json(resolve(directory, 'receipt.json'));
  assert.equal(receipt.items[0].promptFile, null);
  await assert.rejects(verifyBackup(f.root, f.item, sha256(f.bytes)), /Prompt ausente/);
});

test('backup já salvo persiste se a coleta remota falhar', async t => {
  const f = await fixture(t);
  const s = await server(t, f.item, { listFailure: true });
  await assert.rejects(backupCollection(f.root, { publishedConfig: s.config }), /Lista do portal inválida/);
  const item = (await json(manifestFile(f.root))).exercises[0];
  await verifyBackup(f.root, item, sha256(f.bytes));
});

test('bloqueia publicação sem revisão atual e sem backup antes de acessar API', async t => {
  const f = await fixture(t);
  let called = false;
  const request = () => { called = true; throw new Error('Não deveria chamar'); };
  await assert.rejects(publishItem(f.root, f.manifest, f.item, {}, request), /Backup ausente/);
  await backup(f);
  f.item.review.sha256 = 'outro';
  await assert.rejects(publishItem(f.root, f.manifest, f.item, {}, request), /inspeção visual/);
  assert.equal(called, false);
});

test('publica, verifica mídia pública e retoma sem duplicar; preserva recibos legados', async t => {
  const f = await fixture(t);
  f.item.imageUrl = '/media/exercises/legado.webp';
  f.item.publishedSha256 = 'hash legado';
  await writeJson(manifestFile(f.root), f.manifest);
  await backup(f);
  const s = await server(t, f.item);
  const receipt = await publishItem(f.root, f.manifest, f.item, s.config);
  assert.equal(s.uploads(), 1);
  assert.equal(s.mediaToken(), undefined);
  assert.equal(receipt.environment, 'local');
  assert.ok(receipt.mediaSha256);
  assert.equal(f.item.imageUrl, '/media/exercises/legado.webp');
  assert.equal(f.item.publishedSha256, 'hash legado');
  await publishItem(f.root, f.manifest, f.item, s.config);
  assert.equal(s.uploads(), 1);
  assert.equal(acceptedPublication(receipt), false);
  receipt.acceptance = { sha256: receipt.sha256, mediaSha256: receipt.mediaSha256, reviewer: 'assistant', reviewedAt: new Date().toISOString(), notes: 'WebP conferido', appCheckedAt: new Date().toISOString(), appNotes: 'Conta de teste' };
  assert.equal(acceptedPublication(receipt), true);
  receipt.mediaSha256 = 'alterado';
  assert.equal(acceptedPublication(receipt), false);
  assert.equal(f.item.publications['https://orami.com.br'], undefined);
});

test('imagem já vinculada e nome divergente nunca são substituídos', async t => {
  const f = await fixture(t);
  await backup(f);
  const existing = await server(t, f.item, { existing: '/media/exercises/qualquer.webp' });
  await assert.rejects(publishItem(f.root, f.manifest, f.item, existing.config), /já tem imagem/);
  assert.equal(existing.uploads(), 0);
  const wrong = await server(t, f.item, { name: 'Outro exercício' });
  await assert.rejects(publishItem(f.root, f.manifest, f.item, wrong.config), /divergem/);
  assert.equal(wrong.uploads(), 0);
  await assert.rejects(publishItem(f.root, f.manifest, undefined, wrong.config), /identificado/);
});

test('resposta perdida exige reconciliação e não gera outro upload', async t => {
  const f = await fixture(t);
  await backup(f);
  const s = await server(t, f.item, { lostResponse: true });
  await assert.rejects(publishItem(f.root, f.manifest, f.item, s.config));
  const disk = await json(manifestFile(f.root));
  assert.equal(disk.exercises[0].publicationAttempts[s.config.apiUrl].state, 'uncertain');
  await assert.rejects(publishItem(f.root, disk, disk.exercises[0], s.config), /já tem imagem/);
  assert.equal(s.uploads(), 1);
});

test('falha após upload preserva recibo e permite só revalidar a mídia', async t => {
  const f = await fixture(t);
  await backup(f);
  const s = await server(t, f.item, { mediaFailure: true });
  await assert.rejects(publishItem(f.root, f.manifest, f.item, s.config), /WebP público/);
  assert.equal((await json(manifestFile(f.root))).exercises[0].publications[s.config.apiUrl].sha256, sha256(f.bytes));
  await assert.rejects(publishItem(f.root, f.manifest, f.item, s.config), /WebP público/);
  assert.equal(s.uploads(), 1);
});

test('ambientes explícitos e HTTPS obrigatório fora do computador local', async () => {
  assert.throws(() => apiConfig({}), /explicitamente/);
  assert.throws(() => apiConfig({ ORAMI_API_URL: 'https://orami.com.br', ORAMI_IMAGE_ENV: 'local', ORAMI_ADMIN_TOKEN: 'segredo' }), /exclusivamente/);
  assert.throws(() => apiConfig({ ORAMI_API_URL: 'http://example.com', ORAMI_IMAGE_ENV: 'staging' }), /HTTPS/);
  const local = apiConfig({ ORAMI_API_URL: 'http://localhost:3000/', ORAMI_IMAGE_ENV: 'local', ORAMI_ADMIN_TOKEN: 'teste' });
  assert.equal(local.apiUrl, 'http://localhost:3000');
});

test('backup remoto completo guarda só vínculos, origem e WebPs', async t => {
  const f = await fixture(t);
  const s = await server(t, f.item, { existing: '/media/exercises/00000000-0000-4000-8000-000000000099.webp' });
  const directory = await backupCollection(f.root, { publishedConfig: s.config });
  const environment = await json(resolve(directory, 'published/environment.json'));
  assert.equal(environment.environment, 'local');
  assert.equal(environment.apiUrl, s.config.apiUrl);
  assert.equal(JSON.stringify(environment).includes(s.config.token), false);
  const links = await json(resolve(directory, 'published/catalog-image-links.json'));
  assert.deepEqual(Object.keys(links[0]), ['id', 'name', 'imageUrl']);
  const hashes = await json(resolve(directory, 'files-sha256.json'));
  for (const [file, hash] of Object.entries(hashes)) assert.equal(sha256(await readFile(resolve(directory, file))), hash);
});

test('catálogo paginado encontra o ID exato e rejeita ID ausente', async () => {
  const pages = [];
  const request = async path => {
    pages.push(path);
    return path.endsWith('offset=0') ? Array.from({ length: 200 }, (_, id) => ({ id: String(id) })) : [{ id: 'alvo' }];
  };
  assert.equal((await catalogItem(request, 'alvo')).id, 'alvo');
  assert.equal(pages.length, 2);
  await assert.rejects(catalogItem(async () => [], 'ausente'), /inexistente/);
});

test('lock impede duas mutações simultâneas e é liberado após erro', async t => {
  const f = await fixture(t);
  await withCollectionLock(f.root, async () => {
    await assert.rejects(withCollectionLock(f.root, async () => {}), /Outra operação/);
  });
  await assert.rejects(withCollectionLock(f.root, async () => { throw new Error('simulado'); }), /simulado/);
  await withCollectionLock(f.root, async () => {});
});

test('seleção desempata por comuns/nome e exclui imagens/arquivados/duplicados', () => {
  const rows = [
    { id: '1', name: 'Agachamento livre', activePlanCount: 1 },
    { id: '2', name: 'Z', activePlanCount: '4' },
    { id: '3', name: 'A', activePlanCount: 1 },
    { id: '4', name: 'B', activePlanCount: 1 },
    { id: '5', name: 'Ilustrado', activePlanCount: 50, imageKey: 'existing.webp' },
    { id: '6', name: 'Arquivado', activePlanCount: 50, archived: true },
  ];
  assert.deepEqual(selectCandidates([...rows, rows[0]], ['Agachamento livre'], 10).map(row => row.id), ['2', '1', '3', '4']);
  assert.throws(() => selectCandidates(rows, [], 0), /positivo/);
});

test('SQL conta cada ficha uma vez e ignora vencidas, inativas e arquivadas', async () => {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
  const sql = await readFile(resolve(root, 'design/exercise-images/selection.sql'), 'utf8');
  // Executar a consulta real sobre tabelas isoladas; SQLite recebe a função UTC_TIMESTAMP.
  const python = `import sqlite3, json, sys
db=sqlite3.connect(':memory:')
db.row_factory=sqlite3.Row
db.create_function('UTC_TIMESTAMP',0,lambda:'2026-11-09 12:00:00')
db.executescript('''
CREATE TABLE exercises(id TEXT,name TEXT,image_url TEXT,source TEXT);
CREATE TABLE portal_content(id TEXT,kind TEXT,scope TEXT,archived INTEGER);
CREATE TABLE workout_plan_exercises(exercise_id TEXT,division_id TEXT,source TEXT);
CREATE TABLE workout_divisions(id TEXT,plan_id TEXT);
CREATE TABLE workout_plans(id TEXT,is_active INTEGER,status TEXT,valid_until TEXT);
INSERT INTO exercises VALUES ('a','Agachamento livre',NULL,'catalog'),('b','Sem uso',NULL,'catalog'),('c','Com imagem','x.webp','catalog'),('d','Arquivado',NULL,'catalog');
INSERT INTO portal_content VALUES ('a','exercise','global',0),('b','exercise','global',0),('c','exercise','global',0),('d','exercise','global',1);
INSERT INTO workout_plans VALUES ('p1',1,'available',NULL),('p2',1,'available','2026-12-01 00:00:00'),('old',1,'available','2026-11-09 12:00:00'),('off',0,'available',NULL),('arch',1,'archived',NULL);
INSERT INTO workout_divisions VALUES ('d1','p1'),('d2','p1'),('d3','p2'),('d4','old'),('d5','off'),('d6','arch');
INSERT INTO workout_plan_exercises VALUES ('a','d1','catalog'),('a','d1','catalog'),('a','d2','catalog'),('a','d3','catalog'),('a','d4','catalog'),('a','d5','catalog'),('a','d6','catalog');
''')
print(json.dumps([dict(row) for row in db.execute(sys.stdin.read())]))`;
  const rows = JSON.parse(execFileSync('python3', ['-c', python], { input: sql, encoding: 'utf8' }));
  assert.deepEqual(rows.map(row => [row.id, row.activePlanCount]), [['a', 2], ['b', 0]]);
});
