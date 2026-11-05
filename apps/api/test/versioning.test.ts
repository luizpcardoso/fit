import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';

test('versão pública 1.07 corresponde ao SemVer e ao build Android crescente',async()=>{
  const config=JSON.parse(await readFile(new URL('../../mobile/app.json',import.meta.url),'utf8')).expo;
  assert.equal(config.extra.releaseName,'1.07');
  assert.equal(config.version,'1.0.7');
  assert.equal(config.android.versionCode,10);
});
