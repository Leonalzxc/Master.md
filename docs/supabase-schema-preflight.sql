-- Read-only, no profile values, phones, precise locations or secrets.
SELECT table_name, string_agg(column_name || ':' || data_type, ', ' ORDER BY ordinal_position) AS columns
FROM information_schema.columns
WHERE table_schema='public' AND table_name IN ('profiles','profiles_worker','jobs','bids','reviews','notifications')
GROUP BY table_name ORDER BY table_name;

SELECT tablename,policyname,roles,cmd,qual,with_check
FROM pg_policies WHERE schemaname='public' ORDER BY tablename,policyname;

SELECT c.relname AS table_name,t.tgname,pg_get_triggerdef(t.oid) AS definition
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND NOT t.tgisinternal ORDER BY c.relname,t.tgname;

SELECT p.proname,pg_get_function_identity_arguments(p.oid) AS args,p.prosecdef AS security_definer,
       p.proconfig AS settings
FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public' ORDER BY p.proname;

-- Storage metadata only. No object names, photographs or signed URLs.
SELECT id,public,file_size_limit,allowed_mime_types FROM storage.buckets WHERE id='job-photos';
SELECT policyname,roles,cmd,permissive,qual,with_check
FROM pg_policies WHERE schemaname='storage' AND tablename='objects' ORDER BY policyname;
SELECT relrowsecurity FROM pg_class WHERE oid=to_regclass('storage.objects');
