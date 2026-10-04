import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {dirname} from 'node:path';
import {pathToFileURL} from 'node:url';
export const files=[
 '202609230001_profile_contact_privacy.sql',
 '202609240001_atomic_bid_submission.sql',
 '202610040001_job_workflow.sql',
 '202610040002_free_balti_pilot.sql',
 '202610040003_worker_location_privacy.sql',
 '202610040004_secure_telegram_links.sql',
 '202610040005_legacy_job_notifications.sql',
];
export function pilotRelease(){
 const entries=files.map(name=>{const sql=readFileSync(new URL(`../supabase/migrations/${name}`,import.meta.url),'utf8');return {name,sha256:createHash('sha256').update(sql).digest('hex'),sql};});
 const header=`-- Generated pilot release. Review schema and backup first. Deploy with matching frontend.\n-- All ${files.length} changes commit together; failure rolls back grants, functions and data.\n-- Existing rows/balances are retained; no initial seed is included.\nBEGIN;\nSET LOCAL lock_timeout = '10s';\nSET LOCAL statement_timeout = '60s';\n`;
 const guard=`DO $preflight$ BEGIN
 IF to_regprocedure('public.spend_bid_credit(uuid)') IS NULL
    OR to_regprocedure('public.is_admin(uuid)') IS NULL
    OR to_regprocedure('public.worker_has_bid_on_job(uuid,uuid)') IS NULL THEN
   RAISE EXCEPTION 'Missing legacy prerequisite functions: inspect schema; do not rerun seed';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='notifications' AND column_name='payload')
    OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles' AND column_name='telegram_chat_id')
    OR NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='profiles_worker' AND column_name='verification_submitted_at') THEN
   RAISE EXCEPTION 'Missing prerequisite columns: inspect schema before release';
 END IF;
END $preflight$;\n`;
 const body=entries.map(e=>`\n-- Source: ${e.name}; SHA256: ${e.sha256}\n${e.sql.replace(/^\s*(BEGIN|COMMIT);[ \t]*$/gmi,'')}`).join('\n');
 return header+guard+body+"\nNOTIFY pgrst, 'reload schema';\nCOMMIT;\n";
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const out=process.argv[2];if(!out)throw Error('Usage: node scripts/pilot-release.mjs <local-output.sql>; generates only, never executes');
 mkdirSync(dirname(out),{recursive:true});writeFileSync(out,pilotRelease());console.log(`Generated ${files.length} migrations as one transaction. Not applied to any database.`);
}
