import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildApp } from '../src/app.js';

const account = { email: 'ana@example.com', password: 'senha-forte-123', phone: '(71) 99999-0000', firstName: 'Ana', lastName: 'Silva' };

test('cadastro, sessão, rota privada, renovação e logout', async () => {
  const app = await buildApp({ jwtSecret: 'test-secret-with-more-than-32-characters' });
  const created = await app.inject({ method: 'POST', url: '/auth/register', payload: account });
  assert.equal(created.statusCode, 201);
  const auth = created.json();
  assert.equal(auth.user.email, account.email);
  assert.equal(auth.user.password, undefined);

  const me = await app.inject({ method: 'GET', url: '/auth/me', headers: { authorization: `Bearer ${auth.accessToken}` } });
  assert.equal(me.statusCode, 200);
  assert.equal(me.json().firstName, 'Ana');

  const refreshed = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: auth.refreshToken } });
  assert.equal(refreshed.statusCode, 200);
  assert.notEqual(refreshed.json().refreshToken, auth.refreshToken);
  const reused = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: auth.refreshToken } });
  assert.equal(reused.statusCode, 401);

  const logout = await app.inject({ method: 'POST', url: '/auth/logout', payload: { refreshToken: refreshed.json().refreshToken } });
  assert.equal(logout.statusCode, 204);
  const afterLogout = await app.inject({ method: 'POST', url: '/auth/refresh', payload: { refreshToken: refreshed.json().refreshToken } });
  assert.equal(afterLogout.statusCode, 401);
  const revokedAccess = await app.inject({ method: 'GET', url: '/auth/me', headers: { authorization: `Bearer ${refreshed.json().accessToken}` } });
  assert.equal(revokedAccess.statusCode, 401);
  await app.close();
});

test('rejeita e-mail repetido, credenciais erradas e payload inválido', async () => {
  const app = await buildApp({ jwtSecret: 'test-secret-with-more-than-32-characters' });
  assert.equal((await app.inject({ method: 'POST', url: '/auth/register', payload: account })).statusCode, 201);
  const duplicate = await app.inject({ method: 'POST', url: '/auth/register', payload: { ...account, email: 'ANA@example.com' } });
  assert.equal(duplicate.statusCode, 409);
  assert.equal(duplicate.json().code, 'EMAIL_ALREADY_EXISTS');
  const wrong = await app.inject({ method: 'POST', url: '/auth/login', payload: { email: account.email, password: 'senha-errada' } });
  assert.equal(wrong.statusCode, 401);
  assert.equal(wrong.json().code, 'INVALID_CREDENTIALS');
  const invalid = await app.inject({ method: 'POST', url: '/auth/register', payload: { ...account, password: '123' } });
  assert.equal(invalid.statusCode, 400);
  const anonymous = await app.inject({ method: 'GET', url: '/auth/me' });
  assert.equal(anonymous.statusCode, 401);
  await app.close();
});

test('perfil separa gênero da base para estimativas e valida o valor', async () => {
  const app = await buildApp({ jwtSecret: 'test-secret-with-more-than-32-characters' });
  const auth = (await app.inject({ method: 'POST', url: '/auth/register', payload: { email: 'base@example.com', password: 'senha-forte-123', phone: '71999990000', firstName: 'Base', lastName: 'Teste' } })).json();
  const headers = { authorization: `Bearer ${auth.accessToken}` };
  assert.equal(auth.user.estimationSex, null);
  assert.equal((await app.inject({ method: 'PATCH', url: '/auth/me', payload: { estimationSex: 'female' } })).statusCode, 401);
  const updated = await app.inject({ method: 'PATCH', url: '/auth/me', headers, payload: { gender: 'non_binary', estimationSex: 'female' } });
  assert.equal(updated.statusCode, 200);
  assert.equal(updated.json().gender, 'non_binary');
  assert.equal(updated.json().estimationSex, 'female');
  assert.equal((await app.inject({ method: 'PATCH', url: '/auth/me', headers, payload: { estimationSex: 'non_binary' } })).statusCode, 400);
  const cleared = await app.inject({ method: 'PATCH', url: '/auth/me', headers, payload: { estimationSex: null } });
  assert.equal(cleared.json().estimationSex, null);
  await app.close();
});

test('login e cadastro limitam por IP mesmo com Bearer válido e não revelam e-mail pelo tempo', async () => {
  const app = await buildApp({ jwtSecret: 'test-secret-with-more-than-32-characters' });
  try {
    const created = await app.inject({ method: 'POST', url: '/auth/register', payload: account });
    const bearer = { authorization: `Bearer ${created.json().accessToken}` };
    const attempt = (headers = {}) => app.inject({ method: 'POST', url: '/auth/login', headers, payload: { email: account.email, password: 'senha-errada-123' } });
    for (let i = 0; i < 8; i++) assert.equal((await attempt()).statusCode, 401);
    assert.equal((await attempt()).statusCode, 429);
    assert.equal((await attempt(bearer)).statusCode, 429);
    for (let i = 0; i < 4; i++) await app.inject({ method: 'POST', url: '/auth/register', headers: bearer, payload: { ...account, email: `limite-${i}@example.com` } });
    assert.equal((await app.inject({ method: 'POST', url: '/auth/register', headers: bearer, payload: { ...account, email: 'limite-extra@example.com' } })).statusCode, 429);
  } finally { await app.close(); }

  const timing = await buildApp({ jwtSecret: 'test-secret-with-more-than-32-characters' });
  try {
    await timing.inject({ method: 'POST', url: '/auth/login', payload: { email: 'aquecimento@example.com', password: 'senha-errada-123' } });
    const started = performance.now();
    const unknown = await timing.inject({ method: 'POST', url: '/auth/login', payload: { email: 'ninguem@example.com', password: 'senha-errada-123' } });
    assert.equal(unknown.statusCode, 401);
    // Without the dummy comparison this answers in ~1 ms; bcrypt cost 12 takes well over 40 ms.
    assert.ok(performance.now() - started > 40);
  } finally { await timing.close(); }
});

test('@usuário padrão vem do primeiro nome, sem expor o e-mail na busca', async () => {
  const app = await buildApp({ jwtSecret: 'test-secret-with-more-than-32-characters' });
  try {
    const created = await app.inject({ method: 'POST', url: '/auth/register', payload: { ...account, email: 'segredo.pessoal@example.com', firstName: 'Ána Júlia' } });
    assert.equal(created.statusCode, 201);
    assert.match(created.json().user.username, /^anajulia\.[a-f0-9]{8}$/);
  } finally { await app.close(); }
});
