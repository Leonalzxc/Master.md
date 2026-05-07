'use client';

import { useState } from 'react';

interface Props {
  jobId: string;
  locale: string;
}

export default function BidForm({ jobId, locale }: Props) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ price: '', comment: '', startDate: '' });
  const [errors, setErrors] = useState<{ price?: string; comment?: string }>({});

  function validate() {
    const e: typeof errors = {};
    if (!form.price || isNaN(Number(form.price)) || Number(form.price) <= 0)
      e.price = 'Укажите цену';
    if (form.comment.trim().length < 10)
      e.comment = 'Минимум 10 символов';
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    // TODO: replace with real Server Action
    await new Promise((r) => setTimeout(r, 900));
    setSent(true);
    setLoading(false);
  }

  if (sent) {
    return (
      <div
        className="rounded-2xl p-6 flex flex-col items-center gap-3 text-center"
        style={{ background: 'rgba(22,163,74,.07)', border: '1.5px solid rgba(22,163,74,.25)' }}
      >
        <span className="text-3xl">✅</span>
        <p className="font-semibold" style={{ color: 'var(--success)' }}>
          Отклик отправлен!
        </p>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Заказчик получит уведомление и свяжется с вами, если выберет вас.
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary w-full" style={{ justifyContent: 'center', fontSize: 15, height: 48 }}>
        Откликнуться на заявку
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <h3 className="font-semibold text-base" style={{ color: 'var(--text)' }}>
        Ваш отклик
      </h3>

      {/* Price */}
      <div>
        <label className="field-label">Ваша цена (MDL) *</label>
        <div className="relative">
          <input
            type="number"
            value={form.price}
            onChange={(e) => { setForm({ ...form, price: e.target.value }); setErrors({ ...errors, price: undefined }); }}
            placeholder="например 2500"
            className="field-input"
            style={{ paddingRight: 52 }}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }}>MDL</span>
        </div>
        {errors.price && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.price}</p>}
      </div>

      {/* Comment */}
      <div>
        <label className="field-label">Комментарий *</label>
        <textarea
          rows={3}
          value={form.comment}
          onChange={(e) => { setForm({ ...form, comment: e.target.value }); setErrors({ ...errors, comment: undefined }); }}
          placeholder="Коротко опишите свой подход, опыт, сроки выполнения..."
          className="field-input"
          style={{ resize: 'vertical' }}
        />
        {errors.comment && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.comment}</p>}
      </div>

      {/* Start date */}
      <div>
        <label className="field-label">Готов начать (необязательно)</label>
        <input
          type="date"
          value={form.startDate}
          onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          min={new Date().toISOString().split('T')[0]}
          className="field-input"
        />
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="btn-secondary flex-1"
          style={{ fontSize: 14 }}
        >
          Отмена
        </button>
        <button
          type="submit"
          disabled={loading}
          className="btn-primary flex-1"
          style={{ fontSize: 14, opacity: loading ? 0.7 : 1 }}
        >
          {loading ? 'Отправляем...' : 'Отправить отклик'}
        </button>
      </div>
    </form>
  );
}
