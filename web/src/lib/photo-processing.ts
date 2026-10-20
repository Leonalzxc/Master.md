import sharp from 'sharp';

export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;
export const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export class PhotoError extends Error {
  constructor(public code: 'invalid_photo' | 'photo_too_large', public status = 422) { super(code); }
}

/** Decode the actual image and re-encode pixels only; never keep source metadata. */
export async function sanitizePhoto(bytes: Buffer): Promise<Buffer> {
  if (!bytes.length) throw new PhotoError('invalid_photo');
  if (bytes.length > MAX_PHOTO_BYTES) throw new PhotoError('photo_too_large', 413);
  try {
    const image = sharp(bytes, { limitInputPixels: 16_000_000, failOn: 'warning' });
    const meta = await image.metadata();
    if (!['jpeg', 'png', 'webp'].includes(meta.format ?? '') || (meta.pages ?? 1) !== 1) {
      throw new PhotoError('invalid_photo');
    }
    // Rotate the pixels before removing EXIF orientation; transparent areas become white.
    const output = await image.rotate().resize(2048, 2048, { fit: 'inside', withoutEnlargement: true })
      .flatten({ background: '#ffffff' }).jpeg({ quality: 85 }).timeout({ seconds: 5 }).toBuffer();
    if (output.length > MAX_PHOTO_BYTES) throw new PhotoError('photo_too_large', 413);
    return output;
  } catch (error) {
    if (error instanceof PhotoError) throw error;
    throw new PhotoError('invalid_photo');
  }
}

/** Bound memory even when Content-Length is absent or dishonest. */
export async function readPhotoForm(request: Request): Promise<File> {
  const type = request.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('multipart/form-data;')) throw new PhotoError('invalid_photo', 400);
  const limit = MAX_PHOTO_BYTES + 64 * 1024;
  if (Number(request.headers.get('content-length')) > limit) throw new PhotoError('photo_too_large', 413);
  const reader = request.body?.getReader();
  if (!reader) throw new PhotoError('invalid_photo', 400);
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) {
        await reader.cancel().catch(() => {});
        throw new PhotoError('photo_too_large', 413);
      }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  let form: FormData;
  try { form = await new Response(Buffer.concat(chunks), { headers: { 'content-type': type } }).formData(); }
  catch { throw new PhotoError('invalid_photo', 400); }
  const entries = [...form.entries()];
  const file = form.get('file');
  if (entries.length !== 1 || !(file instanceof File) || !PHOTO_TYPES.includes(file.type) || !file.size) {
    throw new PhotoError('invalid_photo', 422);
  }
  if (file.size > MAX_PHOTO_BYTES) throw new PhotoError('photo_too_large', 413);
  return file;
}
