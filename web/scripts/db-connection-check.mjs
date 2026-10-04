// Read-only access check. The password comes from an ignored local env file.
// Never include credentials, connection URLs or raw DB error messages in logs.
import {readFileSync} from 'node:fs';
import {Client} from 'pg';
const {PGHOST,PGPORT,PGDATABASE,PGUSER,PGPASSWORD,PGSSLROOTCERT}=process.env;
if (!PGHOST || !PGDATABASE || !PGUSER || !PGPASSWORD || PGPASSWORD==='[YOUR-PASSWORD]') {
  console.error('Fill the local .env.db.local connection fields; do not send credentials in chat.');
  process.exit(1);
}
const ssl={rejectUnauthorized:true};
if (PGSSLROOTCERT) ssl.ca=readFileSync(PGSSLROOTCERT,'utf8');
const client=new Client({host:PGHOST,port:Number(PGPORT??5432),database:PGDATABASE,user:PGUSER,password:PGPASSWORD,
  ssl,connectionTimeoutMillis:10000,statement_timeout:10000});
try {
  await client.connect();
  await client.query('BEGIN READ ONLY');
  const {rows:[version]}=await client.query("select current_setting('server_version_num') as version");
  const {rows}=await client.query("select table_name,count(*)::int as columns from information_schema.columns where table_schema='public' and table_name in ('profiles','profiles_worker','jobs','bids','reviews','notifications') group by table_name order by table_name");
  console.log(JSON.stringify({connected:true,readOnly:true,serverVersion:version.version,tables:rows}));
  await client.query('ROLLBACK');
} catch (error) {
  const code=String(error.code??'CONNECTION_FAILED').replace(/[^A-Z0-9_]/g,'').slice(0,60);
  console.error(`Read-only DB access failed (${code}). Check credentials/network/CA; TLS verification remains enabled.`);
  process.exitCode=1;
} finally { await client.end().catch(()=>{}); }
