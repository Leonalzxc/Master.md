'use client';

import { useState } from 'react';
import { submitReview } from '@/app/actions/submitReview';

interface Props {
  jobId: string;
  workerName: string;
  locale: string;
}

export default function ReviewForm({ jobId, workerName, locale }: Props) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const t = (ru: string, ro: string) => locale === 'ru' ? ru : ro;

  async function handle() {
    if (rating === 0) { setError(t('Выберите оценку', 'Selectați o notă')); return; }
    setLoading(true);
    setError('');
    try {
      await submitReview(jobId, rating, text, locale);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'already_reviewed') {
        setError(t('Вы уже оставили отзыв', 'Ați lăsat deja o recenzie'));
      } else {
        setError(t('Ошибка. Попробуйте ещё раз.', 'Eroare. Încercați din nou.'));
      }
      setLoading(false);
    }
  }

  const active = hovered || rating;

  return (
    <div className="flex flex-col gap-5">
      {/* Worker name */}
      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        {t('Оцените работу мастера', 'Evaluați munca meșterului')}{' '}
        <strong style={{ color: 'var(--text)' }}>{workerName}</strong>
      </p>

      {/* Stars */}
      <div>
        <div className="flex gap-2" onMouseLeave={() => setHovered(0)}>
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              onMouseEnter={() => setHovered(star)}
              style={{
                fontSize: 36,
                lineHeight: 1,
                cursor: 'pointer',
                background: 'none',
                border: 'none',
                padding: '2px 4px',
                transition: 'transform 150ms',
                transform: star <= active ? 'scale(1.15)' : 'scale(1)',
                filter: star <= active ? 'none' : 'grayscale(1) opacity(0.4)',
              }}
              aria-label={`${star} ${t('звёзд', 'stele')}`}
            >
              ⭐
            </button>
          ))}
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', minHeight: 18 }}>
          {active > 0 && RATING_LABELS[locale === 'ru' ? 'ru' : 'ro'][active - 1]}
        </p>
      </div>

      {/* Comment */}
      <div>
        <label className="field-label">
          {t('Комментарий', 'Comentariu')}{' '}
          <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>
            ({t('необязательно', 'opțional')})
          </span>
        </label>
        <textarea
          className="field-input"
          rows={4}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t(
            'Расскажите о качестве работы, пунктуальности, общении…',
            'Spuneți despre calitatea muncii, punctualitate, comunicare…',
          )}
          maxLength={1000}
          disabled={loading}
        />
      </div>

      {error && (
        <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
      )}

      <button
        type="button"
        onClick={handle}
        disabled={loading || rating === 0}
        className="btn-primary"
        style={{ fontSize: 15, height: 48 }}
      >
        {loading
          ? t('Отправляем…', 'Se trimite…')
          : t('Отправить отзыв и завершить заявку', 'Trimite recenzia și finalizează cererea')}
      </button>
    </div>
  );
}

const RATING_LABELS = {
  ru: ['Очень плохо', 'Плохо', 'Нормально', 'Хорошо', 'Отлично!'],
  ro: ['Foarte rău', 'Rău', 'Normal', 'Bine', 'Excelent!'],
};
