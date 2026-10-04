import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const require=createRequire(import.meta.url),ts=require('typescript');
const source=readFileSync(new URL('../src/lib/auth-path.ts',import.meta.url),'utf8');
const mod={exports:{}};
vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:mod,exports:mod.exports,URL,decodeURIComponent});
const {safeAuthNext}=mod.exports;
test('auth destination accepts local product pages and preserves query/fragment',()=>{
  assert.equal(safeAuthNext('/ru/jobs/123?city=Balti#bids','ru'),'/ru/jobs/123?city=Balti#bids');
  assert.equal(safeAuthNext('/ro/account/profile','ru'),'/ro/account/profile');
});
test('auth redirects reject external, encoded slash/backslash and login loops',()=>{
  for(const value of [undefined,'https://evil.test','//evil.test','/\\evil.test','/ru/account\n','/%2f%2fevil.test',
    '/ru/jobs/%5cfoo','/ru/jobs/%255cfoo','/ru/jobs/%2525252ffoo','/ru/account/../../../evil','/ru/auth','/ro/onboarding','/api/telegram/webhook','/ru/jobs/%zz']) {
    assert.equal(safeAuthNext(value,'ro'),'/ro/account',String(value));
  }
});
