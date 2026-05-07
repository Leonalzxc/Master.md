'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { createBid } from '@/app/actions/createBid';

type AuthState = 'loading' | 'guest' | 'not_worker' | 'ready' | 'already_bid';

interface Props { jobId: string; locale: string }

export default function BidForm({ jobId, locale }: Props) {
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ price: '', comment: '', startDate: '' });
  const [errors, setErrors] = useState<{ price?: string; comment?: string }>({});
  const [serverError, setServerError] = useState('');
  const t = (ru: string, ro: string) => locale === 'ru' ? ru : ro;

  useEffect(() => {
    const supabase = createClient();

    async function check() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setAuthState('guest'); return; }

      const [{ data: worker }, { data: existingBid }] = await Promise.all([
        supabase.from('profiles_worker').select('completed_at').eq('id', user.id).single(),
        supabase.from('bids').select('id').eq('job_id', jobId).eq('worker_id', user.id).maybeSingle(),
      ]);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (!(worker as any)?.completed_at) { setAuthState('not_worker'); return; }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if (existingBid as any) { setAuthState('already_bid'); return; }
      setAuthState('ready');
    }

    check();
  }, [jobId]);

  function validate() {
    const e: typeof errors = {};
    const n = Number(form.price);
    if (!form.price || isNaN(n) || n <= 0) e.price = t('Укажите цену', 'Indicați prețul');
    if (form.comment.trim().length < 10) e.comment = t('Минимум 10 символов', 'Minim 10 caractere');
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    setServerError('');
    try {
      await createBid({ jobId, price: Number(form.price), comment: form.comment, startDate: form.startDate, locale });
      setSent(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'not_authenticated') setAuthState('guest');
      else if (msg === 'already_bid') setAuthState('already_bid');
      else setServerError(t('Ошибка. Попробуйте снова.', 'Eroare. Încercați din nou.'));
    } finally {
      setLoading(false);
    }
  }

  if (authState === 'loading') {
    return <div style={{ height: 48 }} />;
  }

  if (authState === 'guest') {
    return (
      <div className="flex flex-col gap-3">
        <Link
          href={`/${locale}/auth?next=/${locale}/jobs/${jobId}`}
          className="btn-primary w-full text-center"
          style={{ justifyContent: 'center', fontSize: 15, height: 48 }}
        >
          {t('Войти и откликнуться', 'Autentifică-te și trimite oferta')}
        </Link>
        <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
          {t('Вход через SMS — без пароля', 'Autentificare prin SMS — fără parolă')}
        </p>
      </div>
    );
  }

  if (authState === 'not_worker') {
    return (
      <div
        className="rounded-xl p-4 text-sm text-center flex flex-col gap-2"
        style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}
      >
        <span className="text-2xl">👷</span>
        <p>{t('Зарегистрируйтесь как мастер, чтобы откликаться', 'Înregistrați-vă ca meșter pentru a trimite oferte')}</p>
        <Link href={`/${locale}/onboarding`} className="btn-secondary" style={{ fontSize: 13, height: 34 }}>
          {t('Пройти регистрацию', 'Înregistrare')}
        </Link>
      </div>
    );
  }

  if (authState === 'already_bid' || sent) {
    return (
      <div
        className="rounded-2xl p-5 flex flex-col items-center gap-2 text-center"
        style={{ background: 'rgba(22,163,74,.07)', border: '1.5px solid rgba(22,163,74,.25)' }}
      >
        <span className="text-2xl">✅</span>
        <p className="font-semibold text-sm" style={{ color: 'var(--success)' }}>
          {t('Отклик отправлен!', 'Oferta trimisă!')}
        </p>
        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
          {t('Заказчик получит уведомление и свяжется с вами при выборе.', 'Clientul vă va contacta dacă vă selectează.')}
        </p>
      </div>
    );
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn-primary w-full" style={{ justifyContent: 'center', fontSize: 15, height: 48 }}>
        {t('Откликнуться на заявку', 'Trimite oferta')}
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <h3 className="font-semibold text-base" style={{ color: 'var(--text)' }}>
        {t('Ваш отклик', 'Oferta dvs.')}
      </h3>

      <div>
        <label className="field-label">{t('Цена (MDL) *', 'Preț (MDL) *')}</label>
        <div className="relative">
          <input
            type="number" min="1"
            value={form.price}
            onChange={(e) => { setForm({ ...form, price: e.target.value }); setErrors({ ...errors, price: undefined }); }}
            placeholder="2500"
            className="field-input"
            style={{ paddingRight: 52 }}
            autoFocus
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }}>MDL</span>
        </div>
        {errors.price && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.price}</p>}
      </div>

      <div>
        <label className="field-label">{t('Комментарий *', 'Comentariu *')}</label>
        <textarea
          rows={3}
          value={form.comment}
          onChange={(e) => { setForm({ ...form, comment: e.target.value }); setErrors({ ...errors, comment: undefined }); }}
          placeholder={t('Опишите подход, опыт, сроки...', 'Descrieți abordarea, experiența, termenele...')}
          className="field-input"
          style={{ resize: 'vertical' }}
        />
        {errors.comment && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{errors.comment}</p>}
      </div>

      <div>
        <label className="field-label">{t('Готов начать', 'Pot începe')} ({t('необязательно', 'opțional')})</label>
        <input
          type="date"
          value={form.startDate}
          onChange={(e) => setForm({ ...form, startDate: e.target.value })}
          min={new Date().toISOString().split('T')[0]}
          className="field-input"
        />
      </div>

      {serverError && <p className="text-sm" style={{ color: 'var(--danger)' }}>{serverError}</p>}

      <div className="flex gap-3">
        <button type="button" onClick={() => setOpen(false)} className="btn-secondary flex-1" style={{ fontSize: 14 }}>
          {t('Отмена', 'Anulare')}
        </button>
        <button type="submit" disabled={loading} className="btn-primary flex-1" style={{ fontSize: 14, opacity: loading ? 0.7 : 1 }}>
          {loading ? '...' : t('Отправить', 'Trimite')}
        </button>
      </div>
    </form>
  );
}
