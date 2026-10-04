import assert from 'node:assert/strict';
import {test} from 'node:test';
import {readFileSync} from 'node:fs';
import {createRequire} from 'node:module';
import vm from 'node:vm';
import sharp from 'sharp';
import {PGlite} from '@electric-sql/pglite';
import {pilotRelease} from './pilot-release.mjs';
import {setupBidDatabase,resetBidData,actor,workerId,otherId,jobId} from './fixtures/bid-database.mjs';
const require=createRequire(import.meta.url),ts=require('typescript');
function compile(file,imports,extras={}) {
 const mod={exports:{}};
 vm.runInNewContext(ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true,target:ts.ScriptTarget.ES2022},
 }).outputText,{module:mod,exports:mod.exports,require:imports,Buffer,Request,Response,File,FormData,URL,...extras});
 return mod.exports;
}
const processing=compile('../src/lib/photo-processing.ts',name=>{assert.equal(name,'sharp');return require('sharp');});
const {sanitizePhoto,readPhotoForm,MAX_PHOTO_BYTES}=processing;
test('new photos contain pixels only; EXIF/GPS/XMP removed and orientation preserved',async()=>{
 const source=await sharp({create:{width:40,height:20,channels:3,background:'#ab3456'}})
  .withMetadata({orientation:6}).withExifMerge({IFD0:{Artist:'Synthetic Private Person'},IFD3:{GPSLatitudeRef:'N',GPSLatitude:'47/1 45/1 0/1',GPSLongitudeRef:'E',GPSLongitude:'27/1 55/1 0/1'}})
  .withXmp('<x:xmpmeta xmlns:x="adobe:ns:meta/"><private>synthetic-coordinate</private></x:xmpmeta>').jpeg().toBuffer();
 const before=await sharp(source).metadata();assert.ok(before.exif);assert.ok(before.xmp);assert.equal(before.orientation,6);
 const tiff=before.exif.subarray(6),little=tiff.toString('ascii',0,2)==='II';
 const u16=offset=>little?tiff.readUInt16LE(offset):tiff.readUInt16BE(offset);
 const u32=offset=>little?tiff.readUInt32LE(offset):tiff.readUInt32BE(offset);
 const ifd=u32(4),tags=Array.from({length:u16(ifd)},(_,i)=>u16(ifd+2+i*12));
 assert.ok(tags.includes(0x8825),'The input fixture must actually contain the GPS IFD');
 const output=await sanitizePhoto(source),after=await sharp(output).metadata();
 assert.equal(after.format,'jpeg');assert.equal(after.width,20);assert.equal(after.height,40);
 for(const key of ['exif','xmp','iptc','icc','orientation'])assert.equal(after[key],undefined);
 assert.equal(output.includes(Buffer.from('Synthetic Private Person')),false);
 assert.equal(output.includes(Buffer.from('synthetic-coordinate')),false);
});
test('decoder rejects invalid/vector/animated/bomb input and bounds output dimensions',async()=>{
 for(const bytes of [Buffer.from('not an image'),Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>')]) {
  await assert.rejects(sanitizePhoto(bytes),{code:'invalid_photo'});
 }
 await assert.rejects(sanitizePhoto(Buffer.alloc(MAX_PHOTO_BYTES+1)),{code:'photo_too_large'});
 const bomb=await sharp({create:{width:5000,height:4000,channels:3,background:'white'}}).png().toBuffer();
 await assert.rejects(sanitizePhoto(bomb),{code:'invalid_photo'});
 const frames=Buffer.concat([Buffer.alloc(12,20),Buffer.alloc(12,240)]);
 const animated=await sharp(frames,{raw:{width:2,height:4,channels:3,pageHeight:2}}).webp({loop:0,delay:[100,100]}).toBuffer();
 assert.equal((await sharp(animated).metadata()).pages,2);
 await assert.rejects(sanitizePhoto(animated),{code:'invalid_photo'});
 const large=await sharp({create:{width:3000,height:1000,channels:3,background:'blue'}}).png().toBuffer();
 const meta=await sharp(await sanitizePhoto(large)).metadata();assert.equal(meta.width,2048);assert.ok(meta.height<=2048);
});
function multipart(bytes=Buffer.from('data'),type='image/jpeg') {
 const form=new FormData();form.set('file',new File([bytes],'untrusted-name.jpg',{type}));
 return new Request('https://example.test/api/photos',{method:'POST',body:form,headers:{origin:'https://example.test'}});
}
test('multipart reader bounds streaming bytes without trusting length and accepts exactly one raster file',async()=>{
 assert.equal((await readPhotoForm(multipart())).size,4);
 for(const request of [multipart(Buffer.from('data'),'image/svg+xml'),new Request('https://example.test',{method:'POST',body:'{}',headers:{'content-type':'application/json'}})]) {
  await assert.rejects(readPhotoForm(request),{code:'invalid_photo'});
 }
 const form=new FormData();form.set('file',new File(['x'],'x.jpg',{type:'image/jpeg'}));form.set('user_id','someone-else');
 await assert.rejects(readPhotoForm(new Request('https://example.test',{method:'POST',body:form})),{code:'invalid_photo'});
 let cancelled=false;
 const stream=new ReadableStream({start(c){c.enqueue(new Uint8Array(MAX_PHOTO_BYTES+65537));},cancel(){cancelled=true;}});
 const request=new Request('https://example.test',{method:'POST',body:stream,duplex:'half',headers:{'content-type':'multipart/form-data; boundary=x','content-length':'10'}});
 await assert.rejects(readPhotoForm(request),{code:'photo_too_large'});assert.equal(cancelled,true);
});
function routeHarness({user={id:workerId},reserveError=null,recordFails=false}={}) {
 const calls={reserve:0,upload:[],remove:[],record:[]};
 const uploadId='30000000-0000-4000-8000-000000000001';
 const url=`https://example.supabase.co/storage/v1/object/public/job-photos/${workerId}/sanitized/${uploadId}.jpg`;
 const bucket={upload:async(path,bytes,options)=>{calls.upload.push({path,bytes,options});return {error:null};},
  getPublicUrl:()=>({data:{publicUrl:url}}),remove:async paths=>{calls.remove.push(paths);return {error:null};}};
 const mod=compile('../src/app/api/photos/route.ts',dep=>{
  if(dep==='@/lib/photo-processing')return processing;
  if(dep==='@/lib/supabase/server')return {createClient:async()=>({auth:{getUser:async()=>({data:{user},error:null})},rpc:async name=>{assert.equal(name,'reserve_photo_upload');calls.reserve++;return {data:reserveError?null:uploadId,error:reserveError?{message:reserveError}:null};}})};
  if(dep==='@/lib/supabase/admin')return {createAdminClient:()=>({
   storage:{from:name=>{assert.equal(name,'job-photos');return bucket;}},
   from:name=>{
    assert.equal(name,'photo_uploads');
    return {update:value=>{
     calls.record.push(value);
     return {eq:(key,id)=>{
      assert.equal(key,'id');assert.equal(id,uploadId);
      return {eq:(key,id)=>{
       assert.equal(key,'user_id');assert.equal(id,workerId);
       return {select:()=>({single:async()=>({data:recordFails?null:{id:uploadId},error:recordFails?{}:null})})};
      }};
     }};
    }};
   },
  })};
  throw Error('Unexpected dependency '+dep);
 });
 return {POST:mod.POST,calls,url};
}
test('actual route checks origin/auth/limits before reading or processing images',async()=>{
 let h=routeHarness();const cross= multipart();cross.headers.set('origin','https://evil.test');
 assert.equal((await h.POST(cross)).status,403);assert.equal(h.calls.reserve,0);
 h=routeHarness({user:null});assert.equal((await h.POST(multipart())).status,401);assert.equal(h.calls.reserve,0);
 for(const [reserveError,status] of [['photo_rate_limit',429],['not_authorized',403],['missing_rpc',503]]) {
  h=routeHarness({reserveError});assert.equal((await h.POST(multipart())).status,status);assert.equal(h.calls.upload.length,0);
 }
 h=routeHarness();assert.equal((await h.POST(multipart(Buffer.from('<svg/>'),'image/jpeg'))).status,422);assert.equal(h.calls.upload.length,0);
});
test('actual route publishes only re-encoded JPEG and removes only unpublished file when recording fails',async()=>{
 const bytes=await sharp({create:{width:20,height:20,channels:3,background:'red'}}).withMetadata().png().toBuffer();
 let h=routeHarness(),result=await h.POST(multipart(bytes,'image/png'));
 assert.equal(result.status,201);assert.equal(result.headers.get('cache-control'),'no-store');assert.equal((await result.json()).url,h.url);
 assert.match(h.calls.upload[0].path,new RegExp(`^${workerId}/sanitized/[a-f0-9-]+\\.jpg$`));
 const metadata=await sharp(h.calls.upload[0].bytes).metadata();assert.equal(metadata.format,'jpeg');assert.equal(metadata.exif,undefined);
 assert.equal(h.calls.upload[0].options.contentType,'image/jpeg');assert.equal(h.calls.remove.length,0);
 h=routeHarness({recordFails:true});result=await h.POST(multipart(bytes,'image/png'));
 assert.equal(result.status,503);assert.equal(h.calls.remove.length,1);
 assert.equal(h.calls.remove[0][0],h.calls.upload[0].path);
});
async function database() {const db=new PGlite();await setupBidDatabase(db);await resetBidData(db);return db;}
test('storage restrictions defeat old broad policies and preserve legacy files/references',async()=>{
 const db=await database();try {
  const old='https://old.test/old.jpg';
  await db.query('update profiles_worker set photos=array[$1] where id=$2',[old,workerId]);
  await db.exec("create policy legacy_broad_write on storage.objects for all to authenticated using(true) with check(true); insert into storage.objects(bucket_id,name) values ('job-photos','old-file.jpg');");
  await db.exec(pilotRelease());await db.exec(pilotRelease());
  await actor(db);await assert.rejects(db.query("insert into storage.objects(bucket_id,name) values ('job-photos',$1)",[`${workerId}/raw.jpg`]),{code:'42501'});
  assert.equal((await db.query("delete from storage.objects where name='old-file.jpg' returning id")).rows.length,0);
  assert.equal((await db.query("update storage.objects set name='overwrite.jpg' where name='old-file.jpg' returning id")).rows.length,0);
  await db.query("select save_my_profile($1)",[JSON.stringify({name:'Test Worker',role:'worker',city:'Бельцы',photos:[old]})]);
  await actor(db,null,'service_role');assert.equal((await db.query("select count(*)::int n from storage.objects")).rows[0].n,1);
  await db.exec("insert into storage.buckets(id,name) values ('unrelated','unrelated')");await actor(db);
  await db.query("insert into storage.objects(bucket_id,name) values('unrelated','still-allowed')");
 }finally{await db.close();}
});
test('upload reservation is private, actor-bound, blocked-aware and enforces rolling limits on attempts',async()=>{
 const db=await database();try {
  await db.exec(pilotRelease());await actor(db,null,'anon');
  await assert.rejects(db.query('select reserve_photo_upload()'),{code:'42501'});
  await actor(db);await assert.rejects(db.query('select * from photo_uploads'),{code:'42501'});
  for(let i=0;i<15;i++)await db.query('select reserve_photo_upload()');
  await assert.rejects(db.query('select reserve_photo_upload()'),{message:'photo_rate_limit'});
  await db.exec('reset role');await db.query("update photo_uploads set created_at=now()-interval '11 minutes'");await actor(db);
  for(let i=0;i<15;i++)await db.query('select reserve_photo_upload()');
  await db.exec('reset role');await db.query("update photo_uploads set created_at=now()-interval '11 minutes'");await actor(db);
  await assert.rejects(db.query('select reserve_photo_upload()'),{message:'photo_rate_limit'});
  await actor(db,otherId);await db.query('select reserve_photo_upload()');
  await db.exec('reset role');await db.query('update profiles set blocked_at=now() where id=$1',[otherId]);await actor(db,otherId);
  await assert.rejects(db.query('select reserve_photo_upload()'),{message:'not_authorized'});
 }finally{await db.close();}
});
test('new references require a finished upload belonging to the profile/job owner, even via direct RPC/REST',async()=>{
 const db=await database();try {
  await db.exec(pilotRelease());await actor(db);const id=(await db.query('select reserve_photo_upload() id')).rows[0].id;
  const url=`https://example.test/${id}.jpg`;
  const save=photos=>db.query('select save_my_profile($1)',[JSON.stringify({name:'Test Worker',role:'worker',city:'Бельцы',photos})]);
  await assert.rejects(save([url]),{message:'invalid_photo_reference'});
  await assert.rejects(save(['https://tracker.test/collect']),{message:'invalid_photo_reference'});
  await actor(db,null,'service_role');await db.query('update photo_uploads set url=$1,uploaded_at=now() where id=$2',[url,id]);
  await actor(db);await save([url]);
  await assert.rejects(save([url,url]),{message:'invalid_photo_reference'});
  await actor(db,otherId);await assert.rejects(save([url]),{message:'invalid_photo_reference'});
  await actor(db,null,'service_role');await assert.rejects(db.query('update jobs set photos=array[$1] where id=$2',[url,jobId]),{message:'invalid_photo_reference'});
 }finally{await db.close();}
});

function uploadForm(initial=[]) {
 let index=0,urls=initial;
 const states=[],effects=[],requests=[],timers=[];
 const react={useState:v=>{const i=index++;if(!(i in states))states[i]=v;return [states[i],v=>states[i]=v];},
  useRef:v=>{const i=index++;if(!(i in states))states[i]={current:v};return states[i];},useEffect:fn=>effects.push(fn)};
 const jsx=(type,props)=>({type,props});
 const Form=compile('../src/components/features/PhotoUpload.tsx',name=>{
  if(name==='react')return react;
  if(name==='react/jsx-runtime')return {jsx,jsxs:jsx};
  throw Error('Unexpected component dependency '+name);
 },{AbortController,setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout:()=>{},
  fetch:(url,options)=>{assert.equal(url,'/api/photos');return new Promise((resolve,reject)=>requests.push({resolve,reject,options}));}}).default;
 const all=tree=>Array.isArray(tree)?tree.flatMap(all):!tree||typeof tree!=='object'?[]:[tree,...all(tree.props?.children)];
 const render=()=>{index=0;effects.length=0;const nodes=all(Form({urls,onChange:v=>urls=v,locale:'ru'}));effects[0]();return nodes;};
 render();const cleanup=effects[1]();
 return {requests,render,cleanup,urls:()=>urls,pick:files=>render().find(n=>n.type==='input').props.onChange({target:{files,value:'x'}})};
}
const flush=()=>new Promise(resolve=>setImmediate(resolve));
test('actual photo form blocks re-entry, keeps partial successes and releases loading on failure',async()=>{
 const h=uploadForm(),file=new File(['image'],'x.jpg',{type:'image/jpeg'});
 h.pick([file,file]);h.pick([file]);assert.equal(h.requests.length,1);
 h.requests[0].resolve(Response.json({url:'https://example.test/first.jpg'},{status:201}));await flush();
 assert.deepEqual(Array.from(h.urls()),['https://example.test/first.jpg']);assert.equal(h.requests.length,2);
 h.requests[1].reject(Error('offline'));await flush();
 assert.deepEqual(Array.from(h.urls()),['https://example.test/first.jpg']);
 assert.ok(h.render().some(n=>n.props?.role==='alert'));
 assert.equal(h.render().find(n=>n.type==='button'&&n.props['aria-label']==='Добавить фото').props.disabled,false);
 h.cleanup();
});
test('actual photo removal changes only the draft and unmount cancels a pending upload',async()=>{
 const h=uploadForm(['https://example.test/published.jpg']);
 h.render().find(n=>n.type==='button'&&n.props['aria-label']==='Убрать фото из формы').props.onClick();
 assert.deepEqual(h.urls(),[]);assert.equal(h.requests.length,0);
 h.pick([new File(['x'],'x.jpg',{type:'image/jpeg'})]);h.cleanup();
 assert.equal(h.requests[0].options.signal.aborted,true);
 h.requests[0].reject(Error('aborted'));await flush();assert.deepEqual(h.urls(),[]);
});
