import assert from 'node:assert/strict';
import {before,beforeEach,after,test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import vm from 'node:vm';
import {PGlite} from '@electric-sql/pglite';
import {pilotRelease} from './pilot-release.mjs';
import {setupBidDatabase,resetBidData,actor,clientId,workerId,otherId} from './fixtures/bid-database.mjs';
const db=new PGlite();
before(async()=>{await setupBidDatabase(db);await db.exec(pilotRelease());});
beforeEach(async()=>{await resetBidData(db);await db.query("update profiles set city='Бельцы' where id=$1",[workerId]);
 await db.query("update profiles_worker set categories=array['electric'] where id=$1",[workerId]);await actor(db,clientId);});
after(()=>db.close());
const requestId='40000000-0000-4000-8000-000000000001';
const payload=(changes={})=>({description:'Repair the wiring in a small apartment',category:'electric',city:'Бельцы',area:'Центр',
 lat:47.76,lng:27.93,budget:100,urgent:false,needs_quote:false,photos:[],...changes});
const publish=async(input=payload(),key=requestId)=>(await db.query('select * from publish_pilot_job($1,$2)',[key,JSON.stringify(input)])).rows[0];
async function snapshot(){await db.exec('reset role');return (await db.query(`select
 (select count(*)::int from jobs) jobs,(select count(*)::int from job_publications) publications,
 (select count(*)::int from notifications where type='new_bid') notifications`)).rows[0];}
test('publication commits one job/notification/key; retry works at cap and after cancellation',async()=>{
 const first=await publish(),retry=await publish();assert.equal(first.created,true);assert.equal(retry.created,false);assert.equal(retry.job_id,first.job_id);
 assert.deepEqual(await snapshot(),{jobs:3,publications:1,notifications:1});await actor(db,clientId);
 for(let i=0;i<2;i++)await publish(payload(),randomUUID());
 await assert.rejects(publish(payload(),randomUUID()),{message:'job_daily_limit'});
 assert.equal((await publish()).created,false);await db.query('select cancel_job($1)',[first.job_id]);
 assert.equal((await publish()).job_id,first.job_id);assert.equal((await snapshot()).notifications,3);
});
test('changed body returns the owned existing job without replacing it or consuming another slot',async()=>{
 const first=await publish(),conflict=await publish(payload({description:'A different valid task to submit later'}));
 assert.deepEqual(conflict,{job_id:first.job_id,created:false,conflict:true});
 assert.deepEqual(await snapshot(),{jobs:3,publications:1,notifications:1});
 assert.equal((await db.query('select description from jobs where id=$1',[first.job_id])).rows[0].description,payload().description);
});
test('request key and publication metadata are private; identity cannot be supplied by the caller',async()=>{
 const first=await publish();
 await assert.rejects(db.query('select * from job_publications'),{code:'42501'});
 await assert.rejects(publish(payload({client_id:otherId}),randomUUID()),{message:'invalid_input'});
 await actor(db,otherId);const other=await publish();assert.notEqual(other.job_id,first.job_id);
 await actor(db,null,'anon');await assert.rejects(publish(),{code:'42501'});
 await actor(db,null,'service_role');await db.query('update profiles set blocked_at=now() where id=$1',[clientId]);await actor(db,clientId);
 await assert.rejects(publish(),{message:'not_authorized'});
});
test('raw REST insert and legacy column grants cannot forge dates/state or bypass publication',async()=>{
 await db.exec('reset role');await db.exec('grant insert(client_id,description,category,city,area) on jobs to authenticated');
 await db.exec(pilotRelease());await actor(db,clientId);
 await assert.rejects(db.query("insert into jobs(client_id,description,category,city,area) values ($1,'A valid description for this request','electric','Бельцы','Центр')",[clientId]),{code:'42501'});
 const published=await publish(payload({urgent:true}));await db.exec('reset role');
 const row=(await db.query('select created_at,expires_at,status,selected_worker_id from jobs where id=$1',[published.job_id])).rows[0];
 assert.equal(row.status,'active');assert.equal(row.selected_worker_id,null);
 assert.ok(Math.abs((new Date(row.expires_at)-new Date(row.created_at))/86400000-7)<0.0001);
 await actor(db,clientId);await assert.rejects(publish(payload({created_at:'2099-01-01'}),randomUUID()),{message:'invalid_input'});
});
test('database rejects malformed shapes, whitespace descriptions, budgets and locations without partial writes',async()=>{
 for(const body of [null,[],true,'bad',payload({description:'x'.repeat(19)}),payload({description:'\u00a0'.repeat(25)}),
  payload({description:'\u2000'.repeat(25)}),payload({description:'😀'.repeat(10)}),payload({description:'x'.repeat(5001)}),
  payload({area:'x'.repeat(101)}),payload({category:null}),payload({category:'invented'}),payload({budget:-1}),
  payload({budget:1_000_000_001}),payload({budget:1.234}),payload({budget:'NaN'}),payload({budget:'Infinity'}),
  payload({urgent:'false'}),payload({needs_quote:null}),payload({photos:{}}),payload({photos:[null]}),
  payload({city:'Кишинёв'}),payload({lat:0,lng:0}),payload({lat:'47.76'})]) {
  await assert.rejects(publish(body,randomUUID()));
 }
 assert.deepEqual(await snapshot(),{jobs:2,publications:0,notifications:0});
 await actor(db,clientId);assert.equal((await publish(payload({budget:0}))).created,true);
});
test('failure after job insert rolls back job, key and notification together',async()=>{
 await db.exec('reset role');await db.exec(`create function publication_failure() returns trigger language plpgsql as $$begin raise exception 'forced_failure';end;$$;
 create trigger publication_failure before insert on job_publications for each row execute function publication_failure();`);
 try {await actor(db,clientId);await assert.rejects(publish(),{message:'forced_failure'});
  assert.deepEqual(await snapshot(),{jobs:2,publications:0,notifications:0});
 }finally{await db.exec('reset role;drop trigger publication_failure on job_publications;drop function publication_failure()');}
 await actor(db,clientId);assert.equal((await publish()).created,true);
});

const require=createRequire(import.meta.url),ts=require('typescript');
function compile(file,deps,extra={}) {
 const out={exports:{}};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
 }).outputText,{module:out,exports:out.exports,require:deps,Number,Date,console:{error(){}},process:{env:{}},...extra});
 return out.exports;
}
const pilot=compile('../src/lib/pilot.ts',require);
const jobs=compile('../src/lib/jobs.ts',dep=>dep==='./pilot'?pilot:require(dep));
const actionInput=(extra={})=>({requestId,description:payload().description,category:'electric',city:'Бельцы',area:'Центр',
 lat:47.76,lng:27.93,budget:'100',urgent:false,needsQuote:false,photos:[],locale:'ru',...extra});
test('actual action uses the actor-bound RPC; retry/conflict never sends duplicate background notifications',async()=>{
 const background=[],calls=[];
 const action=compile('../src/app/actions/createJob.ts',dep=>{
  if(dep==='next/cache')return {revalidatePath(){}};
  if(dep==='next/server')return {after:fn=>background.push(fn)};
  if(dep==='@/lib/jobs')return jobs;
  if(dep==='@/lib/supabase/server')return {createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:clientId}}})},rpc:async(name,args)=>{
   assert.equal(name,'publish_pilot_job');assert.equal(args.p_input.client_id,undefined);calls.push(args);
   const result=await db.query('select * from publish_pilot_job($1,$2)',[args.p_request_id,JSON.stringify(args.p_input)]);return {data:result.rows,error:null};
  }})};
  if(dep==='@/lib/supabase/admin')return {createAdminClient:()=>{throw Error('External delivery forbidden in test');}};
  if(dep==='@/lib/telegram-security')return {escapeTelegramHtml:v=>v};
  if(dep==='@/lib/telegram')return {sendTelegramMessage:()=>{assert.fail('No external messages allowed');}};
  if(dep==='@/lib/mock/data')return {CATEGORY_LABELS_RU:{}};
  throw Error('Unexpected dependency '+dep);
 });
 const first=await action.createJob(actionInput()),retry=await action.createJob(actionInput());
 assert.equal(first.ok,true);assert.equal(retry.jobId,first.jobId);assert.equal(background.length,1);assert.equal(calls.length,2);
 const changed=await action.createJob(actionInput({description:'A different valid description for this task'}));
 assert.equal(changed.error,'publication_conflict');assert.equal(changed.jobId,first.jobId);assert.equal(background.length,1);
 await background[0]();assert.equal((await snapshot()).jobs,3);
});
test('app input validation accepts ordinary MDL decimals and rejects exotic/unsafe values and invalid request IDs',()=>{
 for(const budget of ['','0','100','100.25',' 100.25 '])assert.equal(jobs.jobInputSchema.safeParse(actionInput({budget})).success,true);
 for(const budget of ['0x10','1e3','NaN','Infinity','-1','1.234','1000000001'])assert.equal(jobs.jobInputSchema.safeParse(actionInput({budget})).success,false);
 assert.equal(jobs.jobInputSchema.safeParse(actionInput({requestId:'not-a-uuid'})).success,false);
 assert.equal(jobs.jobInputSchema.safeParse(actionInput({description:'😀'.repeat(10)})).success,false);
});
function wizardHarness(submit) {
 let index=0;const states=[],pushes=[];
 const react={useState:v=>{const i=index++;if(!(i in states))states[i]=v;return [states[i],v=>states[i]=typeof v==='function'?v(states[i]):v];},
  useRef:v=>{const i=index++;if(!(i in states))states[i]={current:v};return states[i];}};
 const jsx=(type,props)=>({type,props});
 const deps={react,'react/jsx-runtime':{jsx,jsxs:jsx},'next/navigation':{useRouter:()=>({push:p=>pushes.push(p),refresh(){}})},
  '@/lib/pilot':pilot,'@/lib/jobs':jobs,'@/lib/mock/data':{CITIES:['Бельцы'],CATEGORY_LABELS_RU:{electric:'Electric'},CATEGORY_LABELS_RO:{},CATEGORY_ICONS:{}},
  '@/app/actions/createJob':{createJob:submit},'./LocationPicker':{default:'map'},'./PhotoUpload':{default:'upload'}};
 const Form=compile('../src/components/features/RequestWizard.tsx',dep=>{assert.ok(dep in deps,dep);return deps[dep];},{crypto:{randomUUID}}).default;
 const all=tree=>Array.isArray(tree)?tree.flatMap(all):!tree||typeof tree!=='object'?[]:[tree,...all(tree.props?.children)];
 const render=()=>{index=0;return all(Form({locale:'ru',initialCategory:'electric'}));};
 render();states[0]=2;states[1]={...payload(),needsQuote:false,budget:'100'};
 return {render,pushes,setStep:step=>states[0]=step,step:()=>states[0],click:()=>render().find(n=>n.type==='button'&&String(n.props.children).includes('Опубликовать заявку')).props.onClick()};
}
test('actual wizard blocks same-tick double click and reuses its key after an uncertain network response',async()=>{
 let reject,calls=[];
 const h=wizardHarness(input=>{calls.push(input);return new Promise((_,r)=>reject=r);});
 const click=h.render().find(n=>n.type==='button'&&String(n.props.children).includes('Опубликовать заявку')).props.onClick;
 const pending=click();await click();assert.equal(calls.length,1);
 reject(Error('offline'));await pending;
 assert.ok(h.render().some(n=>n.props?.role==='alert'));
 const retry=h.click();assert.equal(calls.length,2);assert.equal(calls[0].requestId,calls[1].requestId);
 reject(Error('offline'));await retry;
});
test('actual wizard exposes the existing owned job after changed retry and remains busy on successful navigation',async()=>{
 let h=wizardHarness(async()=>({ok:false,error:'publication_conflict',jobId:'existing-job'}));
 await h.click();assert.ok(h.render().some(n=>n.type==='a'&&n.props.href==='/ru/jobs/existing-job'));
 h=wizardHarness(async()=>({ok:true,jobId:'new-job'}));await h.click();assert.deepEqual(h.pushes,['/ru/jobs/new-job']);
 assert.equal(h.render().find(n=>n.type==='fieldset').props.disabled,true);
});
test('actual wizard cannot leave the photo step while an upload is running, even through a stale handler',()=>{
 const h=wizardHarness(()=>assert.fail('No publication expected'));h.setStep(1);
 const oldNext=h.render().find(n=>n.type==='button'&&String(n.props.children).includes('Далее')).props.onClick;
 const body=h.render().find(n=>typeof n.type==='function'&&n.type.name==='Step2Description');
 body.props.onPhotoBusyChange(true);oldNext();assert.equal(h.step(),1);
 assert.equal(h.render().find(n=>n.type==='button'&&String(n.props.children).includes('Далее')).props.disabled,true);
 body.props.onPhotoBusyChange(false);oldNext();assert.equal(h.step(),2);
});
