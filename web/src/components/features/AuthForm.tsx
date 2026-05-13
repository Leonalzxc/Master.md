'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CATEGORY_LABELS_RU, CATEGORY_ICONS, type Category } from '@/lib/mock/data';

type Screen = 'phone' | 'otp' | 'name' | 'role' | 'worker-cats' | 'worker-area' | 'success';
type Role = 'client' | 'worker';

const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS_RU) as Category[];
const AREAS = ['Центр', 'Северная', 'Южная', 'Молодёжная', 'Флора', 'Пэмынтень', 'Весь город'];

export default function AuthForm({ locale, next }: { locale: string; next?: string }) {
  const [screen, setScreen] = useState<Screen>('phone');
  const [phone, setPhone]   = useState('');
  const [otp, setOtp]       = useState('');
  const [name, setName]     = useState('');
  const [role, setRole]     = useState<Role | null>(null);
  const [cats, setCats]     = useState<Category[]>([]);
  const [areas, setAreas]   = useState<string[]>([]);
  const [bio, setBio]       = useState('');
  const [expYrs, setExpYrs] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [userId, setUserId]   = useState('');

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router  = useRouter();

  const fullPhone = phone.startsWith('+') ? phone : `+373${phone.replace(/^0+/, '')}`;

  /* ── helpers ─────────────────────────────────────────────── */
  function toggleCat(cat: Category) {
    setCats((prev) => prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]);
  }
  function toggleArea(area: string) {
    setAreas((prev) => prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]);
  }

  /* ── step 1: send OTP ───────────────────────────────────── */
  async function sendOtp() {
    if (phone.replace(/\D/g, '').length < 8) {
      setError(locale === 'ru' ? 'Введите корректный номер' : 'Introduceți un număr valid'); return;
    }
    setError(''); setLoading(true);
    const { error: err } = await createClient().auth.signInWithOtp({ phone: fullPhone });
    setLoading(false);
    if (err) { setError(err.message); return; }
    setScreen('otp');
  }

  /* ── step 2: verify OTP ─────────────────────────────────── */
  async function verifyOtp() {
    if (otp.length !== 6) {
      setError(locale === 'ru' ? 'Введите 6-значный код' : 'Introduceți codul de 6 cifre'); return;
    }
    setError(''); setLoading(true);
    const supabase = createClient();
    const { data, error: err } = await supabase.auth.verifyOtp({ phone: fullPhone, token: otp, type: 'sms' });
    if (err) { setError(err.message); setLoading(false); return; }

    const uid = data.user?.id;
    if (!uid) { setError('Ошибка авторизации'); setLoading(false); return; }
    setUserId(uid);

    // Check if profile is complete
    const { data: existing } = await supabase
      .from('profiles').select('id, name, role').eq('id', uid).single();

    const profile = existing as { id: string; name?: string; role?: string } | null;

    if (profile?.name) {
      // Returning user — go to account
      setScreen('success');
      setTimeout(() => { router.push(next ?? `/${locale}/account`); router.refresh(); }, 500);
    } else {
      // New user — start registration flow
      if (!profile) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.from('profiles') as any).insert({
          id: uid,
          phone: data.user?.phone ?? fullPhone,
          role: 'client',
        });
      }
      setLoading(false);
      setScreen('name');
    }
  }

  /* ── step 3: save name ──────────────────────────────────── */
  function submitName() {
    if (!name.trim()) { setError(locale === 'ru' ? 'Введите ваше имя' : 'Introduceți numele'); return; }
    setError(''); setScreen('role');
  }

  /* ── step 4: pick role ──────────────────────────────────── */
  function submitRole() {
    if (!role) { setError(locale === 'ru' ? 'Выберите роль' : 'Selectați rolul'); return; }
    setError('');
    if (role === 'worker') { setScreen('worker-cats'); } else { finishClient(); }
  }

  /* ── finish client ──────────────────────────────────────── */
  async function finishClient() {
    setLoading(true);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('profiles') as any).update({ name: name.trim(), role: 'client' }).eq('id', userId);
    setScreen('success');
    setTimeout(() => { router.push(`/${locale}/account/client`); router.refresh(); }, 500);
  }

  /* ── step 5 (worker): categories ───────────────────────── */
  function submitCats() {
    if (cats.length === 0) {
      setError(locale === 'ru' ? 'Выберите хотя бы одну специализацию' : 'Selectați cel puțin o specializare'); return;
    }
    setError(''); setScreen('worker-area');
  }

  /* ── step 6 (worker): area + bio → finish ───────────────── */
  async function finishWorker() {
    setLoading(true);
    const supabase = createClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('profiles') as any).update({ name: name.trim(), role: 'worker', city: 'Бельцы' }).eq('id', userId);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (supabase.from('profiles_worker') as any).upsert({
      id: userId,
      categories: cats,
      areas: areas.length > 0 ? areas : ['Весь город'],
      bio: bio.trim() || null,
      experience_yrs: expYrs ? parseInt(expYrs) : null,
      is_pro: false, verified: false, bid_credits: 5,
      rating_avg: 0, rating_count: 0,
      completed_at: new Date().toISOString(),
    });
    setScreen('success');
    setTimeout(() => { router.push(`/${locale}/account/worker`); router.refresh(); }, 500);
  }

  /* ── OTP input helpers ───────────────────────────────────── */
  function handleOtpChange(i: number, val: string) {
    const digit = val.replace(/\D/g, '').slice(-1);
    const arr = otp.split('');
    arr[i] = digit;
    const next6 = arr.join('').slice(0, 6);
    setOtp(next6);
    if (digit && i < 5) otpRefs.current[i + 1]?.focus();
  }
  function handleOtpKey(i: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !otp[i] && i > 0) otpRefs.current[i - 1]?.focus();
  }
  function handleOtpPaste(e: React.ClipboardEvent) {
    const digits = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (digits.length === 6) { setOtp(digits); otpRefs.current[5]?.focus(); }
  }

  /* ── progress indicator ─────────────────────────────────── */
  const STEPS: Screen[] = ['phone', 'otp', 'name', 'role', 'worker-cats', 'worker-area'];
  const stepIdx = STEPS.indexOf(screen);
  const totalSteps = role === 'worker' ? 6 : (screen === 'worker-cats' || screen === 'worker-area' ? 6 : 4);
  const showProgress = stepIdx >= 2; // show after OTP verified

  /* ── render ─────────────────────────────────────────────── */
  if (screen === 'success') {
    return (
      <div className="text-center py-10 flex flex-col items-center gap-3">
        <div style={{ fontSize: 48 }}>✅</div>
        <p className="font-semibold text-lg" style={{ color: 'var(--text)' }}>
          {locale === 'ru' ? 'Готово!' : 'Gata!'}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">

      {/* Registration progress (steps 3+) */}
      {showProgress && (
        <div className="flex flex-col gap-1.5 -mb-1">
          <div className="flex justify-between text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>
              {locale === 'ru' ? `Шаг ${stepIdx - 1} из ${totalSteps - 2}` : `Pasul ${stepIdx - 1} din ${totalSteps - 2}`}
            </span>
            <span>{Math.round(((stepIdx - 1) / (totalSteps - 2)) * 100)}%</span>
          </div>
          <div className="rounded-full overflow-hidden" style={{ height: 3, background: 'var(--surface-2)' }}>
            <div className="h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.round(((stepIdx - 1) / (totalSteps - 2)) * 100)}%`, background: 'var(--accent)' }} />
          </div>
        </div>
      )}

      {/* ── Screen: phone ─────────────────────────────────── */}
      {screen === 'phone' && (
        <>
          <div className="flex flex-col gap-1.5">
            <label className="field-label">{locale === 'ru' ? 'Номер телефона' : 'Număr de telefon'}</label>
            <div className="flex">
              <span className="flex items-center px-3 text-sm rounded-l-xl border-y border-l"
                style={{ background: 'var(--surface-2)', borderColor: 'var(--glass-border)', color: 'var(--text-muted)', borderRight: 'none' }}>
                +373
              </span>
              <input type="tel" className="field-input rounded-l-none flex-1"
                placeholder="69 123 456"
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ''))}
                onKeyDown={(e) => e.key === 'Enter' && sendOtp()}
                maxLength={10} autoFocus />
            </div>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
              {locale === 'ru' ? 'Отправим SMS с кодом' : 'Vom trimite un SMS cu codul'}
            </p>
          </div>
          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
          <button onClick={sendOtp} className="btn-primary w-full" style={{ height: 48, fontSize: 15, justifyContent: 'center' }} disabled={loading}>
            {loading ? (locale === 'ru' ? 'Отправка...' : 'Se trimite...') : (locale === 'ru' ? 'Получить код →' : 'Obține codul →')}
          </button>
        </>
      )}

      {/* ── Screen: OTP ──────────────────────────────────── */}
      {screen === 'otp' && (
        <>
          <div className="flex flex-col gap-1">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {locale === 'ru' ? `Код отправлен на +373 ${phone}` : `Codul a fost trimis la +373 ${phone}`}
            </p>
            <button onClick={() => { setScreen('phone'); setOtp(''); setError(''); }}
              className="text-xs w-fit" style={{ color: 'var(--accent)', textDecoration: 'underline', background: 'none', border: 'none', cursor: 'pointer' }}>
              {locale === 'ru' ? 'Изменить номер' : 'Schimbă numărul'}
            </button>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="field-label">{locale === 'ru' ? 'Код из SMS' : 'Cod din SMS'}</label>
            <div className="flex gap-2 justify-between" onPaste={handleOtpPaste}>
              {Array.from({ length: 6 }).map((_, i) => (
                <input key={i} ref={(el) => { otpRefs.current[i] = el; }}
                  type="text" inputMode="numeric" maxLength={1}
                  value={otp[i] ?? ''}
                  onChange={(e) => handleOtpChange(i, e.target.value)}
                  onKeyDown={(e) => handleOtpKey(i, e)}
                  className="text-center font-bold rounded-xl border"
                  style={{ width: 44, height: 52, fontSize: 22, background: 'var(--surface-2)',
                    borderColor: otp[i] ? 'var(--accent)' : 'var(--glass-border)', color: 'var(--text)', outline: 'none' }}
                  autoFocus={i === 0} />
              ))}
            </div>
          </div>
          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
          <button onClick={verifyOtp} className="btn-primary w-full" style={{ height: 48, fontSize: 15, justifyContent: 'center' }}
            disabled={loading || otp.length < 6}>
            {loading ? (locale === 'ru' ? 'Проверка...' : 'Se verifică...') : (locale === 'ru' ? 'Подтвердить →' : 'Confirmați →')}
          </button>
          <p className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
            {locale === 'ru' ? 'Не получили SMS?' : 'Nu ați primit SMS-ul?'}{' '}
            <button onClick={() => { setOtp(''); sendOtp(); }}
              style={{ color: 'var(--accent)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'inherit', textDecoration: 'underline' }}>
              {locale === 'ru' ? 'Отправить снова' : 'Retrimiteți'}
            </button>
          </p>
        </>
      )}

      {/* ── Screen: name ─────────────────────────────────── */}
      {screen === 'name' && (
        <>
          <div>
            <h2 className="font-bold text-xl mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
              {locale === 'ru' ? '👋 Добро пожаловать!' : '👋 Bun venit!'}
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {locale === 'ru' ? 'Расскажите немного о себе' : 'Spuneți-ne puțin despre dvs.'}
            </p>
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="field-label">{locale === 'ru' ? 'Ваше имя' : 'Numele dvs.'}</label>
            <input type="text" className="field-input"
              placeholder={locale === 'ru' ? 'Имя и фамилия' : 'Nume și prenume'}
              value={name} onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submitName()} autoFocus />
          </div>
          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
          <button onClick={submitName} className="btn-primary w-full" style={{ height: 48, fontSize: 15, justifyContent: 'center' }}>
            {locale === 'ru' ? 'Далее →' : 'Înainte →'}
          </button>
        </>
      )}

      {/* ── Screen: role ─────────────────────────────────── */}
      {screen === 'role' && (
        <>
          <div>
            <h2 className="font-bold text-xl mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
              {locale === 'ru' ? 'Кто вы?' : 'Cine ești?'}
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {locale === 'ru' ? 'Это можно изменить в настройках позже' : 'Puteți schimba mai târziu din setări'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {([
              ['client', '🏠', locale === 'ru' ? 'Заказчик' : 'Client',
                locale === 'ru' ? 'Ищу мастера для ремонта' : 'Caut un meșter'],
              ['worker', '🔧', locale === 'ru' ? 'Мастер' : 'Meșter',
                locale === 'ru' ? 'Предлагаю услуги, беру заказы' : 'Ofer servicii, accept comenzi'],
            ] as const).map(([r, icon, label, desc]) => (
              <button key={r} onClick={() => setRole(r)}
                className="rounded-2xl p-5 text-left flex flex-col gap-2 border-2 transition-all"
                style={{
                  background: role === r ? 'var(--accent-dim)' : 'var(--surface-2)',
                  borderColor: role === r ? 'var(--accent)' : 'var(--glass-border)',
                }}>
                <span style={{ fontSize: 32 }}>{icon}</span>
                <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{label}</span>
                <span className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.4 }}>{desc}</span>
              </button>
            ))}
          </div>
          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setScreen('name')} className="btn-secondary" style={{ height: 48, flex: '0 0 auto', padding: '0 20px' }}>
              ←
            </button>
            <button onClick={submitRole} className="btn-primary flex-1" style={{ height: 48, fontSize: 15, justifyContent: 'center' }} disabled={loading}>
              {loading ? '...' : (role === 'client'
                ? (locale === 'ru' ? 'Готово →' : 'Gata →')
                : (locale === 'ru' ? 'Далее →' : 'Înainte →'))}
            </button>
          </div>
        </>
      )}

      {/* ── Screen: worker categories ─────────────────────── */}
      {screen === 'worker-cats' && (
        <>
          <div>
            <h2 className="font-bold text-xl mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
              {locale === 'ru' ? 'Ваша специализация' : 'Specializarea dvs.'}
            </h2>
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              {locale === 'ru' ? 'Выберите одну или несколько' : 'Selectați una sau mai multe'}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {ALL_CATEGORIES.map((cat) => {
              const active = cats.includes(cat);
              return (
                <button key={cat} onClick={() => toggleCat(cat)}
                  className="rounded-xl px-3 py-2.5 text-sm text-left flex items-center gap-2 border transition-all"
                  style={{
                    background: active ? 'var(--accent-dim)' : 'var(--surface-2)',
                    borderColor: active ? 'var(--accent)' : 'var(--glass-border)',
                    color: active ? 'var(--accent)' : 'var(--text-secondary)',
                    fontWeight: active ? 600 : 400,
                  }}>
                  <span>{CATEGORY_ICONS[cat]}</span>
                  <span>{CATEGORY_LABELS_RU[cat]}</span>
                </button>
              );
            })}
          </div>
          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setScreen('role')} className="btn-secondary" style={{ height: 48, flex: '0 0 auto', padding: '0 20px' }}>←</button>
            <button onClick={submitCats} className="btn-primary flex-1" style={{ height: 48, fontSize: 15, justifyContent: 'center' }}>
              {locale === 'ru' ? 'Далее →' : 'Înainte →'}
            </button>
          </div>
        </>
      )}

      {/* ── Screen: worker area + bio ─────────────────────── */}
      {screen === 'worker-area' && (
        <>
          <div>
            <h2 className="font-bold text-xl mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
              {locale === 'ru' ? 'О себе и районы работы' : 'Despre dvs. și zonele de lucru'}
            </h2>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="field-label">{locale === 'ru' ? 'Опыт работы (лет)' : 'Experiență (ani)'}</label>
              <input type="number" min={0} max={60} className="field-input" placeholder="5"
                value={expYrs} onChange={(e) => setExpYrs(e.target.value)} />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="field-label">{locale === 'ru' ? 'Районы Бельц' : 'Zonele din Bălți'}</label>
              <div className="flex flex-wrap gap-1.5">
                {AREAS.map((area) => {
                  const active = areas.includes(area);
                  return (
                    <button key={area} onClick={() => toggleArea(area)}
                      className="px-3 py-1.5 rounded-lg text-xs border transition-all"
                      style={{
                        background: active ? 'var(--accent-dim)' : 'var(--surface-2)',
                        borderColor: active ? 'var(--accent)' : 'var(--glass-border)',
                        color: active ? 'var(--accent)' : 'var(--text-secondary)',
                        fontWeight: active ? 600 : 400,
                      }}>
                      {area}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="field-label">
                {locale === 'ru' ? 'О себе (необязательно)' : 'Despre dvs. (opțional)'}
              </label>
              <textarea className="field-input" rows={3}
                placeholder={locale === 'ru' ? 'Расскажите об опыте, подходе к работе...' : 'Povestiți despre experiența dvs...'}
                value={bio} onChange={(e) => setBio(e.target.value)}
                style={{ resize: 'vertical', minHeight: 80 }} />
            </div>
          </div>
          {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
          <div className="flex gap-2">
            <button onClick={() => setScreen('worker-cats')} className="btn-secondary" style={{ height: 48, flex: '0 0 auto', padding: '0 20px' }}>←</button>
            <button onClick={finishWorker} className="btn-primary flex-1" style={{ height: 48, fontSize: 15, justifyContent: 'center' }} disabled={loading}>
              {loading
                ? (locale === 'ru' ? 'Сохранение...' : 'Se salvează...')
                : `🎉 ${locale === 'ru' ? 'Начать работу' : 'Începe'}`}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
