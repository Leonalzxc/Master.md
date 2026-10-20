// Read-only HTTP smoke. No cookies, SMS, files, user values or writes.
const base = new URL(process.argv[2] ?? 'http://127.0.0.1:3004');
if (!['https:', 'http:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
  throw Error('Use a plain site origin without credentials/query/fragment');
}
const routes = ['','/jobs','/workers','/auth','/support','/pricing','/legal/privacy','/legal/terms','/legal/moderation'];
const checks = ['ru','ro'].flatMap(locale => routes.map(route => ({ path:`/${locale}${route}`, expected:200 })));
checks.push({path:'/robots.txt',expected:200},{path:'/sitemap.xml',expected:200},
  {path:'/ru/workers/00000000-0000-4000-8000-000000000000',expected:404},
  {path:'/ru/jobs/00000000-0000-4000-8000-000000000000',expected:404},
  {path:'/ru/jobs?page=abc',expected:200});
for(const locale of ['ru','ro']) checks.push({path:`/${locale}/account/profile`,expected:200,destination:`/${locale}/auth`});
let failed=0;
for(const check of checks) {
  try {
    const response=await fetch(new URL(check.path,base),{redirect:'follow',signal:AbortSignal.timeout(15000)});
    const body=await response.text();
    const renderError=/An error occurred in the Server Components render|NEXT_HTTP_ERROR_FALLBACK;500|"digest":"\d{4,}"/.test(body);
    const destination=new URL(response.url).pathname;
    const ok=response.status===check.expected && !renderError && (!check.destination || destination===check.destination);
    if(!ok)failed++;
    console.log(JSON.stringify({path:check.path,status:response.status,expected:check.expected,destination,renderError,result:ok?'PASS':'FAIL'}));
  }catch{failed++;console.log(JSON.stringify({path:check.path,result:'FAIL',reason:'request_unavailable'}));}
}
console.log(JSON.stringify({checks:checks.length,passed:checks.length-failed,failed,scope:'guest HTTP only; authenticated workflow, SMS and writes not tested'}));
process.exitCode=failed?1:0;
