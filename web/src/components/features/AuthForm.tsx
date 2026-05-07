'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type Step = 'phone' | 'otp' | 'success';

export default function AuthForm({ locale, next }: { locale: string; next?: string }) {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();

  const fullPhone = phone.startsWith('+') ? phone : `+373${phone.replace(/^0+/, '')}`;

  async function sendOtp() {
    if (phone.replace(/\D/g, '').length < 8) {
      setError(locale === 'ru' ? 'Введите корректный номер телефона' : 'Introduceți un număr valid');
      return;
    }
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({ phone: fullPhone });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setStep('otp');
  }

  async function verifyOtp() {
    if (otp.length !== 6) {
      setError(locale === 'ru' ? 'Введите 6-значный код' : 'Introduceți codul de 6 cifre');
      return;
    }
    setError('');
    setLoading(true);
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.verifyOtp({ phone: fullPhone, token: otp, type: 'sms' });
    if (err) { setError(err.message); setLoading(false); return; }

    if (data.user) {
      // Check if profile exists and is complete (has name)
      const { data: existing } = await supabase
        .from('profiles').select('id, name').eq('id', data.user.id).single();

      if (!existing) {
        // New user — create minimal profile, redirect to onboarding
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('profiles') as any).insert({
          id: data.user.id,
          phone: data.user.phone ?? fullPhone,
          role: 'client',
        });
      }

      setStep('success');
      const isNewUser = !existing || !(existing as { name?: string }).name;
      setTimeout(() => {
        router.push(isNewUser ? `/${locale}/onboarding` : (next ?? `/${locale}/account`));
        router.refresh();
      }, 600);
    }
    setLoading(false);
  }

  // OTP digit input handler
  function handleOtpKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  }
  function handleOtpChange(i: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1);
    const arr = otp.split('');
    arr[i] = digit;
    const next6 = arr.join('').slice(0, 6);
    setOtp(next6);
    if (digit && i < 5) otpRefs.current[i + 1]?.focus();
  }
  function handleOtpPaste(e: React.ClipboardEvent) {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (digits.length === 6) { setOtp(digits); otpRefs.current[5]?.focus(); }
  }

  if (step === 'success') {
    return (
      <div className="text-center py-8 flex flex-col items-center gap-3">
        <div className="text-4xl">✅</div>
        <p className="font-semibold" style={{ color: 'var(--text)' }}>
          {locale === 'ru' ? 'Вход выполнен!' : 'Autentificat!'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {step === 'phone' && (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="field-label">
              {locale === 'ru' ? 'Номер телефона' : 'Număr de telefon'}
            </label>
            <div className="flex">
              <span
                className="flex items-center px-3 text-sm rounded-l-xl border-y border-l"
                style={{
                  background: 'var(--surface-2)',
                  borderColor: 'var(--glass-border)',
                  color: 'var(--text-muted)',
                  borderRight: 'none',
                }}
              >
                +373
              </span>
              <input
                type="tel"
                className="field-input rounded-l-none flex-1"
                placeholder="69 123 456"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && sendOtp()}
                maxLength={10}
                autoFocus
              />
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {locale === 'ru' ? 'Отправим SMS с кодом подтверждения' : 'Vom trimite un SMS cu codul de confirmare'}
            </p>
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

          <button
            onClick={sendOtp}
            className="btn-primary w-full"
            style={{ height: 48, fontSize: 15, justifyContent: 'center' }}
            disabled={loading}
          >
            {loading
              ? (locale === 'ru' ? 'Отправка...' : 'Se trimite...')
              : (locale === 'ru' ? 'Получить код →' : 'Obține codul →')}
          </button>
        </>
      )}

      {step === 'otp' && (
        <>
          <div className="flex flex-col gap-1.5">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {locale === 'ru'
                ? `Код отправлен на +373 ${phone}`
                : `Codul a fost trimis la +373 ${phone}`}
            </p>
            <button
              onClick={() => { setStep('phone'); setOtp(''); setError(''); }}
              className="text-xs w-fit"
              style={{ color: 'var(--accent)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}
            >
              {locale === 'ru' ? 'Изменить номер' : 'Schimbă numărul'}
            </button>
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="field-label">
              {locale === 'ru' ? 'Код из SMS' : 'Cod din SMS'}
            </label>
            <div className="flex gap-2 justify-between" onPaste={handleOtpPaste}>
              {Array.from({ length: 6 }).map((_, i) => (
                <input
                  key={i}
                  ref={(el) => { otpRefs.current[i] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={otp[i] ?? ''}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKey(i, e)}
                  className="text-center text-lg font-bold rounded-xl border"
                  style={{
                    width: 44, height: 52,
                    background: 'var(--surface-2)',
                    borderColor: otp[i] ? 'var(--accent)' : 'var(--glass-border)',
                    color: 'var(--text)',
                    outline: 'none',
                    fontSize: 22,
                  }}
                  autoFocus={i === 0}
                />
              ))}
            </div>
          </div>

          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

          <button
            onClick={verifyOtp}
            className="btn-primary w-full"
            style={{ height: 48, fontSize: 15, justifyContent: 'center' }}
            disabled={loading || otp.length < 6}
          >
            {loading
              ? (locale === 'ru' ? 'Проверка...' : 'Se verifică...')
              : (locale === 'ru' ? 'Войти →' : 'Intră →')}
          </button>

          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            {locale === 'ru' ? 'Не получили SMS?' : 'Nu ați primit SMS-ul?'}{' '}
            <button
              onClick={() => { setOtp(''); sendOtp(); }}
              style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'inherit', textDecoration: 'underline' }}
            >
              {locale === 'ru' ? 'Отправить снова' : 'Retrimiteți'}
            </button>
          </p>
        </>
      )}
    </div>
  );
}
