'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { createBid } from '@/app/actions/createBid';
import type { BidError } from '@/lib/bids';

type AuthState = 'loading' | 'guest' | 'not_worker' | 'ready' | 'already_bid' | 'no_credits' | 'unavailable';

interface Props { jobId: string; locale: string; expired?: boolean }

export default function BidForm({ jobId, locale, expired = false }: Props) {
  const [checkVersion, setCheckVersion] = useState(0);
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [bidCredits, setBidCredits] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ price: '', comment: '', startDate: '' });
  const [errors, setErrors] = useState<{ price?: string; comment?: string }>({});
  const [serverError, setServerError] = useState('');
  const t = (ru: string, ro: string) => locale === 'ru' ? ru : ro;

  useEffect(() => {
    const supabase = createClient();
    let active = true;
    async function check() {
      setAuthState('loading');
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) { setAuthState('guest'); return; }
      if (authError) { setAuthState('unavailable'); return; }
      const [profileResult, existingResult, workerResult] = await Promise.all([
        supabase.from('profiles').select('role,blocked_at').eq('id', user.id).maybeSingle(),
        supabase.from('bids').select('id').eq('job_id', jobId).eq('worker_id', user.id).maybeSingle(),
        supabase.from('profiles_worker').select('bid_credits').eq('id', user.id).maybeSingle(),
      ]);
      if (!active) return;
      if (profileResult.error || existingResult.error || workerResult.error) {
        setAuthState('unavailable'); return;
      }
      const profile = profileResult.data as { role: string; blocked_at: string | null } | null;
      const worker = workerResult.data as { bid_credits: number } | null;
      if (profile?.blocked_at) { setAuthState('unavailable'); return; }
      if (existingResult.data) { setAuthState('already_bid'); return; }
      if (profile?.role !== 'worker' || !worker) { setAuthState('not_worker'); return; }
      setBidCredits(worker.bid_credits);
      setAuthState(worker.bid_credits < 1 ? 'no_credits' : 'ready');
    }
    check().catch(() => { if (active) setAuthState('unavailable'); });
    return () => { active = false; };
  }, [jobId, checkVersion]);

  function errorText(code: BidError) {
    const messages: Record<BidError, [string, string]> = {
      not_authenticated: ['Войдите в аккаунт', 'Autentificați-vă'],
      not_worker: ['Заполните профиль мастера', 'Completați profilul de meșter'],
      account_blocked: ['Аккаунт заблокирован. Обратитесь в поддержку.', 'Contul este blocat. Contactați asistența.'],
      own_job: ['Нельзя откликнуться на свою заявку', 'Nu puteți oferta propria cerere'],
      job_unavailable: ['Заявка уже закрыта или срок истёк', 'Cererea este închisă sau a expirat'],
      no_credits: ['Недостаточно кредитов', 'Credite insuficiente'],
      invalid_input: ['Проверьте цену, комментарий и дату начала', 'Verificați prețul, comentariul și data'],
      temporarily_unavailable: ['Отклики временно недоступны. Попробуйте позже.', 'Ofertele sunt temporar indisponibile. Reîncercați mai târziu.'],
    };
    return t(...messages[code]);
  }

  function validate() {
    const e: typeof errors = {};
    const n = Number(form.price);
    if (!form.price || !Number.isFinite(n) || n <= 0 || n > 1_000_000_000) e.price = t('Укажите цену', 'Indicați prețul');
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
      const result = await createBid({ jobId, price: Number(form.price), comment: form.comment, startDate: form.startDate, locale: locale === 'ro' ? 'ro' : 'ru' });
      if (result.ok) {
        setBidCredits(result.creditsRemaining);
        setSent(true);
      } else {
        if (result.error === 'not_authenticated') setAuthState('guest');
        else if (result.error === 'not_worker') setAuthState('not_worker');
        else if (result.error === 'no_credits') setAuthState('no_credits');
        else setServerError(errorText(result.error));
      }
    } catch {
      // A lost response may follow a committed bid; retrying is idempotent.
      setServerError(t('Не удалось получить ответ. Можно повторить — повторный отклик не спишет ещё один кредит.', 'Nu am primit răspunsul. Puteți reîncerca fără o a doua debitare.'));
    } finally {
      setLoading(false);
    }
  }

  if (authState === 'loading') {
    return <div style={{ height: 48 }} />;
  }

  // Job expired — no bidding allowed
  if (expired) {
    return (
      <div className="rounded-xl p-4 text-sm text-center" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
        ⏰ {t('Срок подачи откликов истёк', 'Termenul de ofertare a expirat')}
      </div>
    );
  }

  if (authState === 'unavailable') {
    return <div className="flex flex-col gap-3 text-sm">
      <p>{t('Не удалось проверить доступ к откликам. Проверьте соединение или обратитесь в поддержку.', 'Nu am putut verifica accesul. Verificați conexiunea sau contactați asistența.')}</p>
      <button type="button" className="btn-secondary" onClick={() => setCheckVersion((v) => v + 1)}>
        {t('Повторить проверку', 'Reîncearcă')}
      </button>
    </div>;
  }

  if (authState === 'no_credits') {
    return (
      <div className="rounded-xl p-4 flex flex-col gap-3 text-sm" style={{ background: 'rgba(239,68,68,.06)', border: '1px solid rgba(239,68,68,.2)' }}>
        <div className="flex items-center gap-2">
          <span className="text-xl">💳</span>
          <p className="font-semibold" style={{ color: 'var(--danger)' }}>
            {t('Нет кредитов для отклика', 'Nu aveți credite pentru ofertă')}
          </p>
        </div>
        <p style={{ color: 'var(--text-muted)' }}>
          {t('Пополните баланс в личном кабинете', 'Reîncărcați soldul în contul personal')}
        </p>
        <Link href={`/${locale}/credits`} className="btn-primary text-center" style={{ fontSize: 13, height: 36, textDecoration: 'none' }}>
          💳 {t('Купить кредиты →', 'Cumpără credite →')}
        </Link>
      </div>
    );
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
        <p>{t('Выберите режим мастера в профиле, чтобы откликаться', 'Selectați modul meșter în profil pentru a trimite oferte')}</p>
        <Link href={`/${locale}/account/profile`} className="btn-secondary" style={{ fontSize: 13, height: 34 }}>
          {t('Настроить профиль', 'Configurează profilul')}
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
      <div className="flex flex-col gap-2">
        <button onClick={() => setOpen(true)} className="btn-primary w-full" style={{ justifyContent: 'center', fontSize: 15, height: 48 }}>
          {t('Откликнуться на заявку', 'Trimite oferta')}
        </button>
        {bidCredits !== null && (
          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            💳 {t(`Баланс: ${bidCredits} кредит${bidCredits === 1 ? '' : bidCredits < 5 ? 'а' : 'ов'}`, `Credite: ${bidCredits}`)}
            {' · '}{t('Отклик стоит 1 кредит', 'O ofertă costă 1 credit')}
          </p>
        )}
      </div>
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
            type="number" min="0.01" step="0.01" max="1000000000"
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
          maxLength={2000}
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
