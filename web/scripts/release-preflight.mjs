/** Read-only production access audit. Never retrieves profile values or performs writes. */
const url=process.env.NEXT_PUBLIC_SUPABASE_URL,key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if(!url||!key){console.error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY locally. Never paste keys into chat.');process.exit(2);}
const checks=[
  ['public job catalog','jobs','id,description,category,city,status',true],
  ['public worker catalog','profiles_worker','id,categories,bio,verified,rating_avg',true],
  ['profile phone private','profiles','phone',false],
  ['Telegram identifier private','profiles','telegram_chat_id',false],
  ['exact map pin private','jobs','lat,lng',false],
  ['worker messengers private','profiles_worker','viber,telegram,whatsapp',false],
  ['worker credit balance private','profiles_worker','bid_credits',false],
];
let passed=true;
for(const [name,table,columns,allow] of checks){
  try{
    const route=new URL(`/rest/v1/${table}`,url);route.searchParams.set('select',columns);route.searchParams.set('limit','0');
    const response=await fetch(route,{headers:{apikey:key},signal:AbortSignal.timeout(10000)});
    const ok=allow?response.ok:[401,403].includes(response.status);
    passed&&=ok;
    console.log(JSON.stringify({check:name,result:ok?'PASS':'FAIL',status:response.status}));
    // Intentionally do not print response bodies: a misconfigured API could contain private data.
  }catch{passed=false;console.log(JSON.stringify({check:name,result:'FAIL',reason:'request_unavailable'}));}
}
console.log(passed?'Public read/privacy gate passed. This does not replace authenticated workflow/SMS/backup checks.':'NO-GO: public access or privacy restrictions need correction before release.');
process.exitCode=passed?0:1;
