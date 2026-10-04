import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const ts=createRequire(import.meta.url)('typescript');
function profileForm(submit) {
 let index=0;const states=[],calls=[],refreshes=[];
 const react={useState:v=>{const i=index++;if(!(i in states))states[i]=v;return [states[i],v=>states[i]=typeof v==='function'?v(states[i]):v];},
  useRef:v=>{const i=index++;if(!(i in states))states[i]={current:v};return states[i];}};
 const jsx=(type,props)=>({type,props}),out={exports:{}};
 const deps={react,'react/jsx-runtime':{jsx,jsxs:jsx},'next/navigation':{useRouter:()=>({refresh:()=>refreshes.push(true)})},
  './TelegramConnection':{default:'telegram'},'@/components/features/PhotoUpload':{default:'photos'},
  '@/lib/mock/data':{CITIES:['Бельцы'],AREAS:{},CATEGORY_LABELS_RU:{electric:'Электрика'},CATEGORY_LABELS_RO:{},CATEGORY_ICONS:{}},
  '@/app/actions/updateProfile':{updateProfile:input=>{calls.push(input);return submit(input);}}};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/components/features/ProfileForm.tsx',import.meta.url),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
 }).outputText,{module:out,exports:out.exports,require:dep=>{assert.ok(dep in deps,dep);return deps[dep];},setTimeout:()=>1});
 const all=tree=>Array.isArray(tree)?tree.flatMap(all):!tree||typeof tree!=='object'?[]:[tree,...all(tree.props?.children)];
 const render=()=>{index=0;return all(out.exports.default({locale:'ru',profile:{name:'Test Worker',role:'worker',city:'Бельцы',phone:'+37360000000'},workerProfile:{categories:['electric'],photos:[]}}));};
 const save=()=>render().find(n=>n.type==='button'&&n.props.className==='btn-primary');
 return {render,save,calls,refreshes};
}
test('actual profile cannot save a pending photo through a stale handler and saves the completed upload',async()=>{
 const h=profileForm(async()=>{}),oldSave=h.save().props.onClick;
 const photo=h.render().find(n=>n.type==='photos');
 photo.props.onBusyChange(true);await oldSave();assert.equal(h.calls.length,0);
 assert.equal(h.save().props.disabled,true);
 photo.props.onChange(['https://example.test/sanitized.jpg']);photo.props.onBusyChange(false);
 await h.save().props.onClick();assert.deepEqual(Array.from(h.calls[0].portfolio_photos),['https://example.test/sanitized.jpg']);
 assert.equal(h.refreshes.length,1);
});
test('actual profile blocks double-save, disables editing, and releases the form for retry after failure',async()=>{
 let reject;const h=profileForm(()=>new Promise((_,r)=>reject=r));
 const click=h.save().props.onClick,pending=click();await click();assert.equal(h.calls.length,1);
 assert.equal(h.render().find(n=>n.type==='fieldset').props.disabled,true);
 reject(Error('offline'));await pending;
 assert.equal(h.render().find(n=>n.type==='fieldset').props.disabled,false);
 assert.ok(h.render().some(n=>n.props?.role==='alert'));
 const retry=h.save().props.onClick();assert.equal(h.calls.length,2);reject(Error('offline'));await retry;
});
