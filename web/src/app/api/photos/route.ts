import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { PhotoError, readPhotoForm, sanitizePhoto } from '@/lib/photo-processing';

export const runtime = 'nodejs';
export const maxDuration = 30;
const reply = (body: object, status = 200) => Response.json(body, { status, headers: { 'Cache-Control': 'no-store' } });

export async function POST(request: Request) {
  // Cookie-authenticated upload is same-origin only; no arbitrary cross-site writes.
  if (request.headers.get('origin') !== new URL(request.url).origin) return reply({ error: 'not_authorized' }, 403);
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return reply({ error: 'not_authenticated' }, 401);
    // Fail closed before processing a body when service credentials are unavailable.
    const admin = createAdminClient();
    const rpc = supabase as unknown as { rpc(name: string): PromiseLike<{ data: string | null; error: { message: string } | null }> };
    const { data: uploadId, error: reserveError } = await rpc.rpc('reserve_photo_upload');
    if (reserveError || !uploadId) {
      if (reserveError?.message === 'photo_rate_limit') return reply({ error: 'photo_rate_limit' }, 429);
      if (reserveError?.message === 'not_authorized') return reply({ error: 'not_authorized' }, 403);
      return reply({ error: 'temporarily_unavailable' }, 503);
    }
    if (!/^[0-9a-f-]{36}$/i.test(uploadId)) return reply({ error: 'temporarily_unavailable' }, 503);
    const file = await readPhotoForm(request);
    const pixels = await sanitizePhoto(Buffer.from(await file.arrayBuffer()));
    const path = `${user.id}/sanitized/${uploadId}.jpg`;
    const bucket = admin.storage.from('job-photos');
    const { error: uploadError } = await bucket.upload(path, pixels, { contentType: 'image/jpeg', upsert: false });
    if (uploadError) return reply({ error: 'temporarily_unavailable' }, 503);
    const url = bucket.getPublicUrl(path).data.publicUrl;
    const registry = admin as unknown as { from(name: string): {
      update(value: object): { eq(column: string, value: string): { eq(column: string, value: string): {
        select(column: string): { single(): PromiseLike<{ data: { id: string } | null; error: unknown }> }
      } } }
    } };
    let recorded = false;
    try {
      const result = await registry.from('photo_uploads').update({ url, uploaded_at: new Date().toISOString() })
        .eq('id', uploadId).eq('user_id', user.id).select('id').single();
      recorded = !result.error && !!result.data;
    } finally {
      // Only this newly created, unpublished file can be removed here.
      if (!recorded) await bucket.remove([path]).catch(() => {});
    }
    if (!recorded) return reply({ error: 'temporarily_unavailable' }, 503);
    return reply({ url }, 201);
  } catch (error) {
    if (error instanceof PhotoError) return reply({ error: error.code }, error.status);
    // Never log image bytes, filenames, credentials or raw provider errors.
    return reply({ error: 'temporarily_unavailable' }, 503);
  }
}
