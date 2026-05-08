'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { CATEGORY_LABELS_RU, CATEGORY_ICONS, type Category } from '@/lib/mock/data';

const CITIES = ['Бельцы'];
const AREAS: Record<string, string[]> = {
  'Бельцы': ['Центр', 'Северная', 'Южная', 'Молодёжная', 'Флора', 'Пэмынтень', 'Весь город'],
};
const ALL_CATEGORIES = Object.keys(CATEGORY_LABELS_RU) as Category[];

type Role = 'client' | 'worker';
type Step = 1 | 2 | 3 | 4 | 5;

interface State {
  name: string;
  role: Role | null;
  categories: Category[];
  city: string;
  areas: string[];
  bio: string;
  experienceYrs: string;
  docFile: File | null;
}

export default function OnboardingWizard({ locale, userId }: { locale: string; userId: string }) {
  const [step, setStep] = useState<Step>(1);
  const [state, setState] = useState<State>({
    name: '', role: null, categories: [], city: 'Бельцы', areas: [], bio: '', experienceYrs: '', docFile: null,
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const set = (patch: Partial<State>) => setState((s) => ({ ...s, ...patch }));
  const isWorker = state.role === 'worker';
  const totalSteps = isWorker ? 5 : 2;

  function toggleCategory(cat: Category) {
    set({ categories: state.categories.includes(cat) ? state.categories.filter((c) => c !== cat) : [...state.categories, cat] });
  }
  function toggleArea(area: string) {
    set({ areas: state.areas.includes(area) ? state.areas.filter((a) => a !== area) : [...state.areas, area] });
  }

  async function finish(skipDoc = false) {
    setError('');
    setLoading(true);
    const supabase = createClient();

    try {
      // Update profile
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const profileQ = supabase.from('profiles') as any;
      const { error: profileErr } = await profileQ.update({
        name: state.name.trim(),
        role: state.role!,
        city: state.city || null,
      }).eq('id', userId);
      if (profileErr) throw profileErr;

      // If worker — create profiles_worker entry
      if (state.role === 'worker') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const workerQ = supabase.from('profiles_worker') as any;
        const { error: workerErr } = await workerQ.upsert({
          id: userId,
          categories: state.categories,
          areas: state.areas,
          bio: state.bio.trim() || null,
          experience_yrs: state.experienceYrs ? parseInt(state.experienceYrs) : null,
          is_pro: false,
          verified: false,
          bid_credits: 5,
          rating_avg: 0,
          rating_count: 0,
          completed_at: new Date().toISOString(),
        });
        if (workerErr) throw workerErr;

        // Upload verification doc if provided
        if (!skipDoc && state.docFile) {
          const ext = state.docFile.name.split('.').pop() ?? 'jpg';
          const path = `${userId}/id.${ext}`;
          const { error: uploadErr } = await supabase.storage
            .from('verification-docs')
            .upload(path, state.docFile, { upsert: true });
          if (uploadErr) throw uploadErr;

          // Mark as submitted
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (supabase.from('profiles_worker') as any).update({
            verification_submitted_at: new Date().toISOString(),
          }).eq('id', userId);
        }
      }

      router.push(`/${locale}/account`);
      router.refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка сохранения');
      setLoading(false);
    }
  }

  function next() {
    setError('');
    if (step === 1 && !state.name.trim()) { setError(locale === 'ru' ? 'Введите имя' : 'Introduceți numele'); return; }
    if (step === 2 && !state.role) { setError(locale === 'ru' ? 'Выберите роль' : 'Selectați rolul'); return; }
    if (step === 2 && state.role === 'client') { finish(); return; }
    if (step === 3 && state.categories.length === 0) { setError(locale === 'ru' ? 'Выберите хотя бы одну специализацию' : 'Selectați cel puțin o specializare'); return; }
    if (step === 4) { setStep(5); return; }
    setStep((s) => (s + 1) as Step);
  }

  const progress = Math.round((step / totalSteps) * 100);

  return (
    <div style={{ width: '100%', maxWidth: 520, margin: '0 auto' }}>
      {/* Progress */}
      <div className="mb-6">
        <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--text-muted)' }}>
          <span>{locale === 'ru' ? `Шаг ${step} из ${totalSteps}` : `Pasul ${step} din ${totalSteps}`}</span>
          <span>{progress}%</span>
        </div>
        <div className="rounded-full overflow-hidden" style={{ height: 4, background: 'var(--surface-2)' }}>
          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${progress}%`, background: 'var(--accent)' }} />
        </div>
      </div>

      <div className="card p-8 flex flex-col gap-6">

        {/* Step 1: Name */}
        {step === 1 && (
          <>
            <div>
              <h2 className="font-bold text-xl mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
                {locale === 'ru' ? 'Как вас зовут?' : 'Cum vă numiți?'}
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {locale === 'ru' ? 'Имя будет отображаться в профиле' : 'Numele va fi afișat în profil'}
              </p>
            </div>
            <input
              type="text"
              className="field-input"
              placeholder={locale === 'ru' ? 'Имя и фамилия' : 'Nume și prenume'}
              value={state.name}
              onChange={(e) => set({ name: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && next()}
              autoFocus
            />
          </>
        )}

        {/* Step 2: Role */}
        {step === 2 && (
          <>
            <div>
              <h2 className="font-bold text-xl mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
                {locale === 'ru' ? 'Кто вы на платформе?' : 'Care este rolul dvs.?'}
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {locale === 'ru' ? 'Это можно изменить позже' : 'Puteți schimba mai târziu'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {([['client', '🏠', locale === 'ru' ? 'Заказчик' : 'Client', locale === 'ru' ? 'Ищу мастера для своих задач' : 'Caut un meșter'],
                ['worker', '🔧', locale === 'ru' ? 'Мастер' : 'Meșter', locale === 'ru' ? 'Предлагаю услуги и беру заказы' : 'Ofer servicii și accept comenzi']] as const).map(([r, icon, label, desc]) => (
                <button
                  key={r}
                  onClick={() => set({ role: r })}
                  className="rounded-2xl p-5 text-left flex flex-col gap-2 border-2 transition-all"
                  style={{
                    background: state.role === r ? 'var(--accent-dim)' : 'var(--surface-2)',
                    borderColor: state.role === r ? 'var(--accent)' : 'var(--glass-border)',
                  }}
                >
                  <span className="text-3xl">{icon}</span>
                  <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{label}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)', lineHeight: 1.4 }}>{desc}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {/* Step 3: Categories (worker only) */}
        {step === 3 && (
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
                const active = state.categories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className="rounded-xl px-3 py-2.5 text-sm text-left flex items-center gap-2 border transition-all"
                    style={{
                      background: active ? 'var(--accent-dim)' : 'var(--surface-2)',
                      borderColor: active ? 'var(--accent)' : 'var(--glass-border)',
                      color: active ? 'var(--accent)' : 'var(--text-secondary)',
                      fontWeight: active ? 600 : 400,
                    }}
                  >
                    <span>{CATEGORY_ICONS[cat]}</span>
                    <span>{CATEGORY_LABELS_RU[cat]}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}

        {/* Step 4: City + areas + bio + experience (worker only) */}
        {step === 4 && (
          <>
            <div>
              <h2 className="font-bold text-xl mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
                {locale === 'ru' ? 'О себе и зоне работы' : 'Despre dvs. și zona de lucru'}
              </h2>
            </div>

            <div className="flex flex-col gap-4">
              {/* City */}
              <div className="flex flex-col gap-1.5">
                <label className="field-label">{locale === 'ru' ? 'Город' : 'Oraș'}</label>
                <div className="flex gap-2">
                  {CITIES.map((c) => (
                    <button key={c} onClick={() => set({ city: c, areas: [] })}
                      className="flex-1 rounded-xl py-2 text-sm border transition-all"
                      style={{ background: state.city === c ? 'var(--accent-dim)' : 'var(--surface-2)', borderColor: state.city === c ? 'var(--accent)' : 'var(--glass-border)', color: state.city === c ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: state.city === c ? 600 : 400 }}>
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              {/* Areas */}
              <div className="flex flex-col gap-1.5">
                <label className="field-label">{locale === 'ru' ? 'Районы работы' : 'Zone de lucru'}</label>
                <div className="flex flex-wrap gap-1.5">
                  {(AREAS[state.city] ?? []).map((area) => {
                    const active = state.areas.includes(area);
                    return (
                      <button key={area} onClick={() => toggleArea(area)}
                        className="px-3 py-1.5 rounded-lg text-xs border transition-all"
                        style={{ background: active ? 'var(--accent-dim)' : 'var(--surface-2)', borderColor: active ? 'var(--accent)' : 'var(--glass-border)', color: active ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: active ? 600 : 400 }}>
                        {area}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Experience */}
              <div className="flex flex-col gap-1.5">
                <label className="field-label">{locale === 'ru' ? 'Опыт работы (лет)' : 'Experiență (ani)'}</label>
                <input type="number" min={0} max={60} className="field-input" placeholder="5"
                  value={state.experienceYrs} onChange={(e) => set({ experienceYrs: e.target.value })} />
              </div>

              {/* Bio */}
              <div className="flex flex-col gap-1.5">
                <label className="field-label">{locale === 'ru' ? 'О себе' : 'Despre dvs.'}</label>
                <textarea className="field-input" rows={3} placeholder={locale === 'ru' ? 'Расскажите о своём опыте, подходе к работе...' : 'Povestiți despre experiența dvs...'}
                  value={state.bio} onChange={(e) => set({ bio: e.target.value })}
                  style={{ resize: 'vertical', minHeight: 80 }} />
              </div>
            </div>
          </>
        )}

        {/* Step 5: Verification doc (worker only) */}
        {step === 5 && (
          <>
            <div>
              <h2 className="font-bold text-xl mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
                {locale === 'ru' ? 'Верификация' : 'Verificare'}
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                {locale === 'ru'
                  ? 'Загрузите фото удостоверения или профессионального сертификата. Верифицированные мастера получают больше заказов.'
                  : 'Încărcați o fotografie a actului de identitate sau a certificatului profesional. Meșterii verificați primesc mai multe comenzi.'}
              </p>
            </div>

            <div
              onClick={() => fileRef.current?.click()}
              className="rounded-2xl border-2 border-dashed flex flex-col items-center justify-center gap-3 cursor-pointer transition-all"
              style={{
                padding: '32px 16px',
                borderColor: state.docFile ? 'var(--success)' : 'var(--glass-border)',
                background: state.docFile ? 'rgba(22,163,74,.04)' : 'var(--surface-2)',
              }}
            >
              {state.docFile ? (
                <>
                  <span className="text-3xl">✅</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--success)' }}>{state.docFile.name}</span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{locale === 'ru' ? 'Нажмите чтобы заменить' : 'Apăsați pentru a înlocui'}</span>
                </>
              ) : (
                <>
                  <span className="text-3xl">📄</span>
                  <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>
                    {locale === 'ru' ? 'Загрузить документ' : 'Încarcă document'}
                  </span>
                  <span className="text-xs text-center" style={{ color: 'var(--text-muted)' }}>
                    {locale === 'ru' ? 'Паспорт, удостоверение или сертификат · JPEG, PNG, PDF · до 10 МБ' : 'Pașaport, buletin sau certificat · JPEG, PNG, PDF · max 10 MB'}
                  </span>
                </>
              )}
            </div>
            <input ref={fileRef} type="file" className="hidden" accept="image/*,.pdf"
              onChange={(e) => set({ docFile: e.target.files?.[0] ?? null })} />

            <div className="rounded-xl p-3 text-xs" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
              🛡️ {locale === 'ru' ? 'Документ виден только администраторам платформы' : 'Documentul este vizibil doar administratorilor platformei'}
            </div>
          </>
        )}

        {/* Error */}
        {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

        {/* Actions */}
        <div className="flex gap-3">
          {step > 1 && (
            <button onClick={() => setStep((s) => (s - 1) as Step)} className="btn-secondary flex-1" style={{ height: 48 }} disabled={loading}>
              ← {locale === 'ru' ? 'Назад' : 'Înapoi'}
            </button>
          )}

          {step < 5 ? (
            <button onClick={next} className="btn-primary flex-1" style={{ height: 48, fontSize: 15, justifyContent: 'center' }} disabled={loading}>
              {loading ? '...' : (step === 2 && state.role === 'client'
                ? (locale === 'ru' ? 'Готово →' : 'Gata →')
                : (locale === 'ru' ? 'Далее →' : 'Înainte →'))}
            </button>
          ) : (
            <div className="flex-1 flex flex-col gap-2">
              <button onClick={() => finish(false)} className="btn-primary w-full" style={{ height: 48, fontSize: 15, justifyContent: 'center' }} disabled={loading || !state.docFile}>
                {loading ? (locale === 'ru' ? 'Сохранение...' : 'Se salvează...') : (locale === 'ru' ? 'Отправить на верификацию →' : 'Trimite pentru verificare →')}
              </button>
              <button onClick={() => finish(true)} className="btn-secondary w-full text-sm" style={{ height: 38, justifyContent: 'center' }} disabled={loading}>
                {locale === 'ru' ? 'Пропустить, войти без верификации' : 'Omite, intră fără verificare'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
