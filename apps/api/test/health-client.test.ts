import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createApiClient } from '../../../packages/api-client/src/index.js';
import { dateInputToIso, formatDateInput, isoDateToInput } from '../../mobile/src/utils/date-input.js';
import { formatHealthTimeInput, isHealthIntakeLate, localDay } from '../../mobile/src/utils/health.js';
import { formatDecimalInput, formatPhoneInput, formatWeightInput, formatWeightValue } from '../../mobile/src/utils/input-format.js';

test('campo de horário insere os dois-pontos durante a digitação', () => {
  assert.equal(formatHealthTimeInput('2'), '2');
  assert.equal(formatHealthTimeInput('20'), '20');
  assert.equal(formatHealthTimeInput('203'), '20:3');
  assert.equal(formatHealthTimeInput('2035'), '20:35');
  assert.equal(formatHealthTimeInput('20:35'), '20:35');
  assert.equal(formatHealthTimeInput('203599'), '20:35');
  assert.equal(formatHealthTimeInput(''), '');
});

test('campos do app aplicam formatos brasileiros sem alterar o contrato da API', () => {
  assert.equal(formatDateInput('01012001'), '01/01/2001');
  assert.equal(dateInputToIso('01/01/2001'), '2001-01-01');
  assert.equal(isoDateToInput('2001-01-01'), '01/01/2001');
  assert.equal(dateInputToIso('31/02/2001'), null);
  assert.equal(formatHealthTimeInput('1123'), '11:23');
  assert.equal(formatWeightInput('8120'), '81,20');
  assert.equal(formatWeightValue(81.2), '81,20');
  assert.equal(formatDecimalInput('174'), '174');
  assert.equal(formatDecimalInput('82.5'), '82,5');
  assert.equal(formatPhoneInput('71999999999'), '(71) 99999-9999');
});

test('requisições paralelas renovam a sessão uma única vez e normalizam categorias', async () => {
  const original = globalThis.fetch;
  let tokens = { accessToken: 'expired', refreshToken: 'refresh' };
  let refreshes = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url).endsWith('/auth/refresh')) {
      refreshes++;
      await new Promise(resolve => setTimeout(resolve, 10));
      return Response.json({ accessToken: 'new', refreshToken: 'rotated' });
    }
    if ((init?.headers as Record<string, string>).authorization === 'Bearer expired') return Response.json({ code: 'UNAUTHORIZED', message: 'Expired' }, { status: 401 });
    const medication = String(url).includes('/medications/');
    return Response.json({ date: '2026-10-27', total: 1, consumed: 0, remaining: 1, items: [{ [medication ? 'medication' : 'supplement']: { id: medication ? 'med' : 'supp' }, slot: 0, time: '08:00', consumedAt: null }] });
  };
  try {
    const api = createApiClient({ baseUrl: 'http://test', getTokens: async () => tokens, saveTokens: async value => { assert.ok(value); tokens = value; } });
    const [supplements, medications] = await Promise.all([api.getHealthToday('supplement', '2026-10-27'), api.getHealthToday('medication', '2026-10-27')]);
    assert.equal(refreshes, 1);
    assert.equal(supplements.items[0].item.id, 'supp');
    assert.equal(medications.items[0].item.id, 'med');
  } finally { globalThis.fetch = original; }
});

test('alerta considera horário local, dia e tomadas concluídas', () => {
  const now = new Date(2026, 9, 27, 10, 0);
  assert.equal(localDay(now), '2026-10-27');
  assert.equal(isHealthIntakeLate({ time: '09:00', consumedAt: null }, localDay(now), now), true);
  assert.equal(isHealthIntakeLate({ time: '10:00', consumedAt: null }, localDay(now), now), false);
  assert.equal(isHealthIntakeLate({ time: '09:00', consumedAt: 'taken' }, localDay(now), now), false);
  assert.equal(isHealthIntakeLate({ time: '09:00', consumedAt: null }, '2026-10-28', now), false);
});
