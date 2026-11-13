import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { RELEASE_VERSION } from '../../mobile/src/constants/release-version.js';

test('versões públicas e nativas usam o mesmo ciclo de instalação e permitem OTA posterior', async () => {
  const config = JSON.parse(await readFile(new URL('../../mobile/app.json', import.meta.url), 'utf8')).expo;
  assert.match(config.version, /^\d+\.\d+\.\d+$/);
  assert.match(config.extra.releaseName, /^\d+\.\d{2}\.\d{2}$/);
  assert.match(RELEASE_VERSION, /^\d+\.\d{2}\.\d{2}$/);
  const [major, installation, ota] = config.version.split('.').map(Number);
  assert.equal(config.extra.releaseName, `${major}.${String(installation).padStart(2, '0')}.${String(ota).padStart(2, '0')}`);
  const publicParts = RELEASE_VERSION.split('.').map(Number);
  assert.deepEqual(publicParts.slice(0, 2), [major, installation]);
  assert.ok(publicParts[2] >= ota, 'O bundle não pode anteceder a versão embutida no instalador');
  assert.ok(Number.isSafeInteger(config.android.versionCode) && config.android.versionCode > 0);
});
