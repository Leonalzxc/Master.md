'use client';

import { useRef, useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface Props {
  urls: string[];
  onChange: (urls: string[]) => void;
  locale: string;
  maxFiles?: number;
}

const MAX_FILES = 5;
const MAX_SIZE_MB = 5;

export default function PhotoUpload({ urls, onChange, locale, maxFiles = MAX_FILES }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFiles(files: FileList) {
    setError(null);
    const remaining = maxFiles - urls.length;
    if (remaining <= 0) return;

    const picked = Array.from(files).slice(0, remaining);

    const oversized = picked.find((f) => f.size > MAX_SIZE_MB * 1024 * 1024);
    if (oversized) {
      setError(locale === 'ru'
        ? `Файл слишком большой. Максимум ${MAX_SIZE_MB} МБ.`
        : `Fișier prea mare. Maximum ${MAX_SIZE_MB} MB.`);
      return;
    }

    setUploading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('not authenticated');

      const uploaded: string[] = [];
      for (const file of picked) {
        const ext = file.name.split('.').pop() ?? 'jpg';
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage
          .from('job-photos')
          .upload(path, file, { upsert: false });
        if (uploadErr) throw uploadErr;

        const { data } = supabase.storage.from('job-photos').getPublicUrl(path);
        uploaded.push(data.publicUrl);
      }
      onChange([...urls, ...uploaded]);
    } catch {
      setError(locale === 'ru' ? 'Ошибка загрузки. Попробуйте снова.' : 'Eroare la încărcare. Reîncercați.');
    } finally {
      setUploading(false);
    }
  }

  async function remove(url: string) {
    const supabase = createClient();
    // Extract storage path from public URL
    const match = url.match(/job-photos\/(.+)$/);
    if (match) {
      await supabase.storage.from('job-photos').remove([match[1]]);
    }
    onChange(urls.filter((u) => u !== url));
  }

  const canAdd = urls.length < maxFiles;

  return (
    <div className="flex flex-col gap-3">
      {/* Thumbnails */}
      {urls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {urls.map((url) => (
            <div
              key={url}
              style={{ position: 'relative', width: 80, height: 80, borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1.5px solid var(--glass-border)' }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              <button
                type="button"
                onClick={() => remove(url)}
                style={{
                  position: 'absolute', top: 3, right: 3,
                  width: 20, height: 20,
                  background: 'rgba(15,23,42,.7)',
                  border: 'none', borderRadius: '50%',
                  color: '#fff', fontSize: 12,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  cursor: 'pointer', lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>
          ))}

          {/* Add more slot */}
          {canAdd && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              style={{
                width: 80, height: 80,
                borderRadius: 'var(--radius-sm)',
                border: '1.5px dashed var(--glass-border-strong)',
                background: 'var(--surface-2)',
                cursor: uploading ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 22, color: 'var(--text-muted)',
                transition: 'border-color 150ms',
              }}
            >
              {uploading ? '⏳' : '+'}
            </button>
          )}
        </div>
      )}

      {/* Initial upload area (no photos yet) */}
      {urls.length === 0 && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          style={{
            width: '100%',
            padding: '20px 0',
            border: '1.5px dashed var(--glass-border-strong)',
            borderRadius: 'var(--radius-md)',
            background: uploading ? 'var(--surface-subtle)' : 'var(--surface-2)',
            cursor: uploading ? 'not-allowed' : 'pointer',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', gap: 6,
            transition: 'border-color 150ms, background 150ms',
          }}
          onMouseEnter={(e) => { if (!uploading) (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--glass-border-strong)'; }}
        >
          <span style={{ fontSize: 28 }}>{uploading ? '⏳' : '📷'}</span>
          <span style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 500 }}>
            {uploading
              ? (locale === 'ru' ? 'Загрузка…' : 'Se încarcă…')
              : (locale === 'ru' ? 'Добавить фото (необязательно)' : 'Adaugă foto (opțional)')}
          </span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
            {locale === 'ru' ? `до ${maxFiles} фото, до ${MAX_SIZE_MB} МБ каждое` : `până la ${maxFiles} poze, ${MAX_SIZE_MB} MB fiecare`}
          </span>
        </button>
      )}

      {error && (
        <p style={{ fontSize: 12.5, color: 'var(--danger)', marginTop: -4 }}>{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ''; }}
      />
    </div>
  );
}
