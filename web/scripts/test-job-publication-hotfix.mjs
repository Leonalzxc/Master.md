import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import vm from 'node:vm';
const ts = createRequire(import.meta.url)('typescript');
function compile(file, dependencies) {
  const mod = { exports: {} };
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText, { module: mod, exports: mod.exports, require: name => {
    assert.ok(name in dependencies, `Unexpected dependency ${name}`); return dependencies[name];
  }, console: { error() {} } });
  return mod.exports;
}
const input = { category: 'electric', description: 'Repair the wiring in a small apartment', city: 'Бельцы', area: 'Центр',
  lat: 47.76, lng: 27.93, budget: '100', urgent: false, needsQuote: false, photos: [], locale: 'ru' };
const cityData = { CITIES: ['Бельцы'], CATEGORY_LABELS_RU: { electric: 'Электрика' }, CATEGORY_ICONS: {} };
function action({ user = { id: 'test-user' }, failure = null } = {}) {
  const inserted = [], invalidated = [];
  const schema = readFileSync(new URL('../supabase/migrations/001_init_schema.sql', import.meta.url), 'utf8');
  const jobs = schema.match(/create table if not exists public\.jobs\s*\(([\s\S]*?)\n\);/i)[1];
  const columns = new Set([...jobs.matchAll(/^\s{2}(\w+)\s+/gm)].map(m => m[1]));
  columns.add('lat'); columns.add('lng'); // Migration 005_jobs_location.sql.
  const result = compile('../src/app/actions/createJob.ts', {
    '@/lib/mock/data': cityData, 'next/cache': { revalidatePath: path => invalidated.push(path) },
    '@/lib/supabase/server': { createClient: async () => ({
      auth: { getUser: async () => ({ data: { user } }) },
      from: table => { assert.equal(table, 'jobs'); return { insert: row => {
        for (const key of Object.keys(row)) assert.ok(columns.has(key), `Missing SQL column: ${key}`);
        inserted.push(row); return { select: field => { assert.equal(field, 'id'); return { single: async () => ({ data: failure ? null : { id: 'new-job' }, error: failure }) }; } };
      } }; },
    }) },
  });
  return { publish: result.createJob, inserted, invalidated };
}
test('production publication uses existing jobs columns and returns its ID without a redirect exception', async () => {
  const h = action(); const result = await h.publish(input);
  assert.equal(result.ok, true); assert.equal(result.jobId, 'new-job');
  assert.equal(h.inserted.length, 1); assert.equal(h.inserted[0].title, undefined);
  assert.equal(h.inserted[0].budget_min, 100); assert.equal(h.invalidated.length, 2);
});
test('schema/permission failures become safe result values instead of a masked Server Components exception', async () => {
  const h = action({ failure: { code: 'PGRST204', message: 'Private database diagnostic' } });
  const result = await h.publish(input); assert.equal(result.ok, false); assert.equal(result.error, 'temporarily_unavailable');
  assert.equal(JSON.stringify(result).includes('Private database'), false); assert.equal(h.invalidated.length, 0);
});
test('guests and malformed budgets/descriptions never insert a job', async () => {
  const guest = action({ user: null }); assert.equal((await guest.publish(input)).error, 'not_authenticated');
  assert.equal(guest.inserted.length, 0);
  const h = action();
  for (const budget of ['NaN', 'Infinity', '-1', '1.234', '1e3']) assert.equal((await h.publish({ ...input, budget })).error, 'invalid_input');
  assert.equal((await h.publish({ ...input, description: 'x' })).error, 'invalid_input'); assert.equal(h.inserted.length, 0);
});
function wizard(submit) {
  const states = [], navigations = []; let index = 0;
  const react = { useState: initial => { const i = index++; if (!(i in states)) states[i] = initial;
    return [states[i], v => states[i] = typeof v === 'function' ? v(states[i]) : v]; },
  useRef: initial => { const i = index++; if (!(i in states)) states[i] = { current: initial }; return states[i]; } };
  const jsx = (type, props) => ({ type, props });
  const Component = compile('../src/components/features/RequestWizard.tsx', {
    react, 'react/jsx-runtime': { jsx, jsxs: jsx }, '@/lib/mock/data': cityData,
    'next/navigation': { useRouter: () => ({ push: path => navigations.push(path), refresh() {} }) },
    '@/app/actions/createJob': { createJob: submit }, './LocationPicker': { default: 'map' }, './PhotoUpload': { default: 'photos' },
  }).default;
  const all = tree => Array.isArray(tree) ? tree.flatMap(all) : !tree || typeof tree !== 'object' ? [] : [tree, ...all(tree.props?.children)];
  const render = () => { index = 0; return all(Component({ locale: 'ru' })); };
  const part = name => render().find(n => typeof n.type === 'function' && n.type.name === name);
  part('Step1Categories').props.set('category', 'electric');
  render().find(n => n.type === 'button' && String(n.props.children).includes('Далее')).props.onClick();
  part('Step2Description').props.set('description', input.description);
  render().find(n => n.type === 'button' && String(n.props.children).includes('Далее')).props.onClick();
  return { render, navigations, click: () => render().find(n => n.type === 'button' && /Опубликовать заявку|Публикуем/.test(String(n.props.children))).props.onClick() };
}
test('actual wizard blocks double click, handles expected failures and preserves the draft for retry', async () => {
  let resolve; const calls = []; const h = wizard(data => { calls.push(data); return new Promise(r => resolve = r); });
  const first = h.click(); await h.click(); assert.equal(calls.length, 1);
  assert.equal(h.render().find(n => n.type === 'fieldset').props.disabled, true);
  resolve({ ok: false, error: 'temporarily_unavailable' }); await first;
  assert.ok(h.render().some(n => n.props?.role === 'alert'));
  assert.equal(h.render().find(n => n.type === 'fieldset').props.disabled, false);
  const retry = h.click(); assert.equal(calls[1].description, input.description);
  resolve({ ok: true, jobId: 'new-job' }); await retry; assert.deepEqual(h.navigations, ['/ru/jobs/new-job']);
});
test('actual wizard gives guests a new-tab login and does not display internal exception messages', async () => {
  let h = wizard(async () => ({ ok: false, error: 'not_authenticated' })); await h.click();
  assert.ok(h.render().some(n => n.type === 'a' && n.props.target === '_blank'));
  h = wizard(async () => { throw Error('Internal secret diagnostic'); }); await h.click();
  const alert = h.render().find(n => n.props?.role === 'alert'); assert.equal(alert.props.children.includes('secret'), false);
});
