import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { before, beforeEach, after, test } from 'node:test';
import { createRequire } from 'node:module';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { setupBidDatabase,resetBidData,actor,workerId,otherId } from './fixtures/bid-database.mjs';
const db=new PGlite();
const sql=readFileSync(new URL('../supabase/migrations/202610040004_secure_telegram_links.sql',import.meta.url),'utf8');
const hash=token=>createHash('sha256').update(token).digest('hex');
const token='a'.repeat(64), token2='b'.repeat(64);
before(async()=>{await setupBidDatabase(db);await db.exec(sql);});
beforeEach(async()=>{await resetBidData(db);await db.exec('truncate telegram_processed_updates,telegram_chat_updates');});
after(()=>db.close());
const consume=(token,chat=100,update=1,stop=false)=>db.query('select * from consume_telegram_update($1,$2,$3,$4)',[token ? hash(token):null,chat,update,stop]);
test('only the authenticated owner issues a link; token contents and service consume are not public',async()=>{
  await actor(db);await db.query('select issue_telegram_link($1)',[hash(token)]);
  for(const q of ['select * from telegram_link_tokens','select * from telegram_processed_updates']) await assert.rejects(db.query(q),{code:'42501'});
  await assert.rejects(consume(token),{code:'42501'});
  await actor(db,null,'anon');await assert.rejects(db.query('select issue_telegram_link($1)',[hash(token)]),{code:'42501'});
});
test('valid token connects its owner, repeats are deduplicated and other updates cannot reuse it',async()=>{
  await actor(db);await db.query('select issue_telegram_link($1)',[hash(token)]);
  await actor(db,null,'service_role');
  assert.equal((await consume(token)).rows[0].result,'linked');
  assert.equal((await consume(token)).rows[0].result,'duplicate');
  assert.equal((await consume(token,101,2)).rows[0].result,'invalid');
  await db.exec('reset role');
  assert.equal((await db.query('select telegram_chat_id from profiles where id=$1',[workerId])).rows[0].telegram_chat_id,100);
  assert.equal((await db.query('select telegram_chat_id from profiles where id=$1',[otherId])).rows[0].telegram_chat_id,null);
});
test('expired, replaced and blocked links cannot connect',async()=>{
  await actor(db);await db.query('select issue_telegram_link($1)',[hash(token)]);await db.query('select issue_telegram_link($1)',[hash(token2)]);
  await actor(db,null,'service_role');assert.equal((await consume(token)).rows[0].result,'invalid');
  await db.exec('reset role');await db.query("update telegram_link_tokens set expires_at=now()-interval '1 second' where token_hash=$1",[hash(token2)]);
  await actor(db,null,'service_role');assert.equal((await consume(token2,100,2)).rows[0].result,'invalid');
  await actor(db);await db.query('select issue_telegram_link($1)',[hash('c'.repeat(64))]);
  await actor(db,null,'service_role');await db.query('update profiles set blocked_at=now() where id=$1',[workerId]);
  assert.equal((await consume('c'.repeat(64),100,3)).rows[0].result,'invalid');
});
test('one chat cannot bind to two accounts; issuance has a bounded rolling rate',async()=>{
  await actor(db);await db.query('select issue_telegram_link($1)',[hash(token)]);
  await actor(db,null,'service_role');await consume(token);
  await actor(db,otherId);await db.query('select issue_telegram_link($1)',[hash(token2)]);
  await actor(db,null,'service_role');assert.equal((await consume(token2,100,2)).rows[0].result,'invalid');
  await actor(db);for(const ch of ['c','d'])await db.query('select issue_telegram_link($1)',[hash(ch.repeat(64))]);
  await assert.rejects(db.query('select issue_telegram_link($1)',[hash('e'.repeat(64))]),{message:'link_rate_limit'});
});
test('delayed or repeated stop cannot remove a newer binding',async()=>{
  await actor(db);await db.query('select issue_telegram_link($1)',[hash(token)]);
  await actor(db,null,'service_role');await consume(token,100,10);
  assert.equal((await consume(null,100,9,true)).rows[0].result,'duplicate');
  assert.equal((await consume(null,100,11,true)).rows[0].result,'stopped');
  await actor(db);await db.query('select issue_telegram_link($1)',[hash(token2)]);
  await actor(db,null,'service_role');await consume(token2,100,12);
  assert.equal((await consume(null,100,11,true)).rows[0].result,'duplicate');
  await db.exec('reset role');assert.equal((await db.query('select telegram_chat_id from profiles where id=$1',[workerId])).rows[0].telegram_chat_id,100);
});
const require=createRequire(import.meta.url),ts=require('typescript'),mod={exports:{}};
vm.runInNewContext(ts.transpileModule(readFileSync(new URL('../src/lib/telegram-security.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{module:mod,exports:mod.exports,require,Buffer});
const {validWebhookSecret,parseTelegramCommand,escapeTelegramHtml}=mod.exports;
test('secret is mandatory and private commands must come from the chat owner with random token',()=>{
  assert.equal(validWebhookSecret(null,undefined),false);assert.equal(validWebhookSecret('abc','abcd'),false);assert.equal(validWebhookSecret('abcd','abcd'),true);
  const base={update_id:1,message:{chat:{id:100,type:'private'},from:{id:100},text:`/start ${token}`}};
  assert.equal(parseTelegramCommand(base).token,token);
  for(const body of [{...base,edited_message:base.message,message:null}, {...base,message:{...base.message,from:{id:200}}},
    {...base,message:{...base.message,chat:{id:100,type:'group'}}}, {...base,message:{...base.message,text:`/start ${workerId}`}}]) assert.equal(parseTelegramCommand(body),null);
  assert.equal(escapeTelegramHtml('<a href="x">&'),'&lt;a href=&quot;x&quot;&gt;&amp;');
});

function compile(file,imports,env={}) {
  const code=ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
  const output={exports:{}};
  vm.runInNewContext(code,{module:output,exports:output.exports,require:imports,Buffer,process:{env},console:{error(){}}});
  return output.exports;
}
test('actual webhook fails closed before accessing DB and deduplicates valid deliveries',async()=>{
  const calls={db:0,replies:0}, env={TELEGRAM_WEBHOOK_SECRET:'test-secret'};
  const route=compile('../src/app/api/telegram/webhook/route.ts',dep=>{
    if(dep==='next/server')return {NextResponse:{json:(body,{status=200}={})=>({body,status})}};
    if(dep==='@/lib/telegram-security')return mod.exports;
    if(dep==='@/lib/telegram')return {sendTelegramMessage:async()=>{calls.replies++;return true;}};
    if(dep==='@/lib/supabase/admin')return {createAdminClient:()=>{calls.db++;return {rpc:async(name,args)=>{
      assert.equal(name,'consume_telegram_update');
      const result=await db.query('select * from consume_telegram_update($1,$2,$3,$4)',[args.p_token_hash,args.p_chat_id,args.p_update_id,args.p_stop]);
      return {data:result.rows,error:null};
    }}}};
    throw Error('Unexpected dependency '+dep);
  },env);
  const req=(secret,body)=>({headers:{get:()=>secret},json:async()=>body});
  const body={update_id:4,message:{chat:{id:100,type:'private'},from:{id:100},text:`/start ${token}`}};
  assert.equal((await route.POST(req(null,body))).status,401);assert.equal(calls.db,0);
  delete env.TELEGRAM_WEBHOOK_SECRET;
  assert.equal((await route.POST(req(null,body))).status,503);assert.equal(calls.db,0);
  env.TELEGRAM_WEBHOOK_SECRET='test-secret';
  assert.equal((await route.POST(req('test-secret',{...body,message:{...body.message,text:`/start ${workerId}`}}))).status,200);assert.equal(calls.db,0);
  await actor(db);await db.query('select issue_telegram_link($1)',[hash(token)]);await actor(db,null,'service_role');
  assert.equal((await route.POST(req('test-secret',body))).status,200);
  assert.equal((await route.POST(req('test-secret',body))).status,200);assert.equal(calls.replies,1);
});
test('actual link action stores only a hash and returns a 64-character random deep link',async()=>{
  await actor(db);
  const action=compile('../src/app/actions/telegramLink.ts',dep=>{
    if(dep==='node:crypto')return require(dep);
    if(dep==='@/lib/telegram-security')return mod.exports;
    if(dep==='@/lib/supabase/server')return {createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:workerId}}})},rpc:async(name,args)=>{
      assert.equal(name,'issue_telegram_link'); assert.equal(Object.keys(args).length,1);
      await db.query('select issue_telegram_link($1)',[args.p_token_hash]);return {error:null};
    }})};
    throw Error('Unexpected dependency '+dep);
  },{NEXT_PUBLIC_TELEGRAM_BOT_USERNAME:'Master_MDbot'});
  const result=await action.createTelegramLink();assert.equal(result.ok,true);
  const raw=new URL(result.url).searchParams.get('start');assert.match(raw,/^[a-f0-9]{64}$/);assert.notEqual(raw,workerId);
  await db.exec('reset role');const row=(await db.query('select token_hash,user_id from telegram_link_tokens')).rows[0];
  assert.equal(row.token_hash,hash(raw));assert.notEqual(row.token_hash,raw);assert.equal(row.user_id,workerId);
});
