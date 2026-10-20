import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
const ts=createRequire(import.meta.url)('typescript');
function deferred(){let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};}
function harness(){
  let index=0,callback,unsubscribed=false;
  const states=[],effects=[],timers=[],queries=[],initial=deferred();
  const react={Suspense:'suspense',useState:v=>{const i=index++;if(!(i in states))states[i]=v;return [states[i],v=>states[i]=typeof v==='function'?v(states[i]):v];},
    useRef:v=>{const i=index++;if(!(i in states))states[i]={current:v};return states[i];},useEffect:fn=>effects.push(fn)};
  const supabase={auth:{getUser:()=>initial.promise,onAuthStateChange:fn=>{callback=fn;return {data:{subscription:{unsubscribe:()=>unsubscribed=true}}};}},
    from:()=>({select:()=>({eq:(_,id)=>({single:()=>{const request=deferred();queries.push({id,...request});return request.promise;}})})})};
  const deps={react,'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
    'next/link':{default:'a'},'next-intl':{useTranslations:()=>v=>v,useLocale:()=>'ru'},
    'next/navigation':{usePathname:()=>'/ru/account',useRouter:()=>({})},
    '@/lib/supabase/client':{createClient:()=>supabase},'./NotificationBell':{default:'bell'},
    './LanguageSwitch':{default:'language',LanguageLink:'language-link'}};
  const mod={exports:{}};
  vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/components/layout/Header.tsx',import.meta.url),'utf8'),{
    compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true},
  }).outputText,{module:mod,exports:mod.exports,require:n=>deps[n],setTimeout:fn=>timers.push(fn)});
  const render=()=>{index=0;effects.length=0;return mod.exports.default();};
  render();const cleanup=effects[0]();
  return {states,initial,queries,timers,cleanup,emit:user=>callback('changed',user?{user}:null),unsubscribed:()=>unsubscribed};
}
test('header ignores stale initial session after logout and performs profile queries outside auth callback',async()=>{
  const h=harness();
  h.emit({id:'old',phone:'+37369123456'});assert.equal(h.queries.length,0);
  const pending=h.timers.shift()();assert.equal(h.queries.length,1);
  h.emit(null);
  h.initial.resolve({data:{user:{id:'old'}}});await Promise.resolve();
  h.queries[0].resolve({data:{name:'Old User',role:'worker'}});await pending;
  assert.equal(h.states[2],null);assert.equal(h.states[3],null);
});
test('header ignores late profile after account switch or unmount and unsubscribes',async()=>{
  const h=harness();
  h.emit({id:'first'});const first=h.timers.shift()();
  h.emit({id:'second'});const second=h.timers.shift()();
  h.queries[1].resolve({data:{name:'Second',role:'client'}});await second;
  h.queries[0].resolve({data:{name:'First',role:'worker'}});await first;
  assert.equal(h.states[2].id,'second');assert.equal(h.states[3].name,'Second');
  h.emit({id:'third'});const third=h.timers.shift()();h.cleanup();
  h.queries[2].resolve({data:{name:'Third',role:'worker'}});await third;
  assert.equal(h.states[3],null);assert.equal(h.unsubscribed(),true);
});
