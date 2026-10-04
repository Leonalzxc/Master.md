'use client';

import { useEffect, useRef, useState } from 'react';

interface Props {
  urls: string[];
  onChange: (urls: string[]) => void;
  locale: string;
  maxFiles?: number;
}

const MAX_FILES = 5;
const MAX_SIZE_MB = 4;

export default function PhotoUpload({ urls, onChange, locale, maxFiles = MAX_FILES }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const currentUrls = useRef(urls);
  const changed = useRef(onChange);
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  useEffect(() => { currentUrls.current = urls; changed.current = onChange; }, [urls, onChange]);
  useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort(); }; }, []);

  async function handleFiles(files: FileList) {
    if (busy.current) return;
    setError(null);
    const remaining = maxFiles - currentUrls.current.length;
    if (remaining <= 0) return;

    const picked = Array.from(files).slice(0, remaining);

    const oversized = picked.find((f) => f.size > MAX_SIZE_MB * 1024 * 1024);
    if (oversized) {
      setError(locale === 'ru'
        ? `Файл слишком большой. Максимум ${MAX_SIZE_MB} МБ.`
        : `Fișier prea mare. Maximum ${MAX_SIZE_MB} MB.`);
      return;
    }

    busy.current = true;
    setUploading(true);
    try {
      for (const file of picked) {
        const form = new FormData();
        form.set('file', file);
        const abort = new AbortController();
        controller.current = abort;
        const timeout = setTimeout(() => abort.abort(), 30_000);
        try {
          const response = await fetch('/api/photos', { method: 'POST', body: form, signal: abort.signal });
          const data = await response.json();
          if (!response.ok || typeof data.url !== 'string') throw new Error(data.error ?? 'temporarily_unavailable');
          if (!alive.current) return;
          // Keep every successful upload if a later file in the batch fails.
          currentUrls.current = [...currentUrls.current, data.url];
          changed.current(currentUrls.current);
        } finally { clearTimeout(timeout); }
      }
    } catch (error) {
      if (!alive.current) return;
      const code = error instanceof Error ? error.message : '';
      const messages: Record<string, [string, string]> = {
        not_authenticated: ['Войдите снова, чтобы загрузить фото.', 'Autentificați-vă din nou pentru a încărca poze.'],
        not_authorized: ['Заполните профиль или обратитесь в поддержку.', 'Completați profilul sau contactați asistența.'],
        photo_rate_limit: ['Лимит: 15 загрузок за 10 минут, 30 за сутки. Повторите позже.', 'Limită: 15 încărcări în 10 minute, 30 pe zi. Reîncercați mai târziu.'],
        invalid_photo: ['Выберите обычное фото JPG, PNG или WebP.', 'Alegeți o poză JPG, PNG sau WebP.'],
        photo_too_large: ['Фото должно быть до 4 МБ.', 'Poza trebuie să aibă maximum 4 MB.'],
      };
      setError((messages[code] ?? ['Не удалось загрузить фото. Уже загруженные сохранены в форме.', 'Poza nu a putut fi încărcată. Cele încărcate sunt păstrate în formular.'])[locale === 'ro' ? 1 : 0]);
    } finally {
      busy.current = false;
      controller.current = null;
      if (alive.current) setUploading(false);
    }
  }

  function remove(url: string) {
    if (busy.current) return;
    currentUrls.current = currentUrls.current.filter((u) => u !== url);
    changed.current(currentUrls.current);
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
                disabled={uploading}
                aria-label={locale === 'ru' ? 'Убрать фото из формы' : 'Elimină poza din formular'}
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
              aria-label={locale === 'ru' ? 'Добавить фото' : 'Adaugă poză'}
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
        <p role="alert" style={{ fontSize: 12.5, color: 'var(--danger)', marginTop: -4 }}>{error}</p>
      )}
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        {locale === 'ru'
          ? 'Фото будут публичными. Не загружайте документы, телефоны и точный адрес. Метаданные новых фото удаляются перед публикацией.'
          : 'Pozele vor fi publice. Nu încărcați acte, numere de telefon sau adresa exactă. Metadatele pozelor noi sunt eliminate înainte de publicare.'}
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        style={{ display: 'none' }}
        onChange={(e) => { if (e.target.files?.length) handleFiles(e.target.files); e.target.value = ''; }}
      />
    </div>
  );
}
