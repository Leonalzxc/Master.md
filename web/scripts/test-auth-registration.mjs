import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const ts=createRequire(import.meta.url)('typescript');
function moduleAt(path,deps){
  const mod={exports:{}};
  const code=ts.transpileModule(readFileSync(new URL(path,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
  vm.runInNewContext(code,{module:mod,exports:mod.exports,require:n=>{if(!(n in deps))throw Error(n);return deps[n];},setInterval:()=>1,clearInterval:()=>{},setTimeout:fn=>fn(),Date});
  return mod.exports;
}
const {normalizeMoldovaPhone}=moduleAt('../src/lib/auth-phone.ts',{});
test('pasted Moldova numbers normalize once; malformed and foreign numbers are rejected',()=>{
  for(const value of ['69 123 456','069123456','+373 (69) 123-456','37369123456','0037369123456'])assert.equal(normalizeMoldovaPhone(value),'+37369123456');
  for(const value of ['', '1234', '+40721234567','00000000','69123456789','69123456 ext 2'])assert.equal(normalizeMoldovaPhone(value),null);
});
function harness(auth){
  let index=0;const states=[];const setter=(i)=>(v)=>states[i]=typeof v==='function'?v(states[i]):v;
  const react={useState:v=>{const i=index++;if(!(i in states))states[i]=v;return [states[i],setter(i)];},useRef:v=>{const i=index++;if(!(i in states))states[i]={current:v};return states[i];},useEffect:()=>{}};
  const jsx=(type,props)=>({type,props});
  const {default:Form}=moduleAt('../src/components/features/AuthForm.tsx',{
    react,'react/jsx-runtime':{jsx,jsxs:jsx,Fragment:'fragment'},
    'next/navigation':{useRouter:()=>({push:()=>{},refresh:()=>{}})},
    '@/lib/auth-path':{safeAuthNext:()=>'/ru/account'},'@/lib/auth-phone':{normalizeMoldovaPhone},
    '@/app/actions/updateProfile':{updateProfile:()=>{throw Error('unexpected save');}},
    '@/lib/supabase/client':{createClient:()=>({auth})},
    '@/lib/mock/data':{CATEGORY_LABELS_RU:{},CATEGORY_LABELS_RO:{},CATEGORY_ICONS:{},CITIES:['Бельцы'],AREAS:{}},
  });
  const render=()=>{index=0;return Form({locale:'ru'});};
  const all=(tree)=>{if(Array.isArray(tree))return tree.flatMap(all);if(!tree||typeof tree!=='object')return[];return[tree,...all(tree.props?.children)];};
  return {render,nodes:()=>all(render())};
}
test('actual registration form releases loading after network failure and blocks duplicate requests',async()=>{
  let rejectRequest,calls=0;
  const h=harness({signInWithOtp:()=>{calls++;return new Promise((_,reject)=>rejectRequest=reject);}});
  h.nodes().find(n=>n.type==='input').props.onChange({target:{value:'69123456'}});
  const click=h.nodes().find(n=>n.type==='button').props.onClick;
  const pending=click();await click();assert.equal(calls,1);
  rejectRequest(Error('offline'));await pending;
  assert.equal(h.nodes().find(n=>n.type==='button').props.disabled,false);
  assert.ok(h.nodes().some(n=>n.type==='p'&&String(n.props.children).includes('Нет соединения')));
});
test('actual form enters OTP after successful delivery and enforces resend cooldown',async()=>{
  let calls=0;const h=harness({signInWithOtp:async()=>{calls++;return {error:null};}});
  h.nodes().find(n=>n.type==='input').props.onChange({target:{value:'37369123456'}});
  await h.nodes().find(n=>n.type==='button').props.onClick();
  const input=h.nodes().find(n=>n.type==='input');assert.equal(input.props.autoComplete,'one-time-code');
  const resend=h.nodes().find(n=>n.type==='button'&&String(n.props.children).includes('Повтор через'));
  assert.equal(resend.props.disabled,true);await resend.props.onClick();assert.equal(calls,1);
});
