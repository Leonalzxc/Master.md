'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { updateProfile } from '@/app/actions/updateProfile';
import { CATEGORY_LABELS_RU, CATEGORY_LABELS_RO, CATEGORY_ICONS, CITIES, AREAS, type Category } from '@/lib/mock/data';
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
}

export default function OnboardingWizard({ locale }: { locale: string }) {
  const [step, setStep] = useState<Step>(1);
  const [state, setState] = useState<State>({
    name: '', role: null, categories: [], city: CITIES[0], areas: [], bio: '', experienceYrs: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
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

  async function finish() {
    if (loading || !state.role) return;
    setError(''); setLoading(true);
    try {
      await updateProfile({ name: state.name, city: state.city, role: state.role, categories: state.categories,
        areas: state.areas, bio: state.bio, experience_yrs: state.experienceYrs,
        viber: '', telegram: '', whatsapp: '', portfolio_photos: [], locale });
      router.push(`/${locale}/account`); router.refresh();
    } catch { setError(locale === 'ru' ? 'Анкета не сохранена. Проверьте данные и повторите.' : 'Profilul nu a fost salvat. Verificați datele și reîncercați.'); }
    finally { setLoading(false); }
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
                    <span>{(locale === 'ro' ? CATEGORY_LABELS_RO : CATEGORY_LABELS_RU)[cat]}</span>
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

        {step === 5 && (
          <div>
            <h2 className="font-bold text-xl mb-2">{locale === 'ru' ? 'Анкета готова' : 'Profilul este pregătit'}</h2>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
              {locale === 'ru' ? 'В пилоте паспорт загружать не нужно. После сохранения можно подать профиль на ручную проверку. Она не подтверждает квалификацию и не гарантирует качество работ.' : 'Pentru pilot nu este necesar actul de identitate. După salvare puteți solicita examinarea profilului. Aceasta nu certifică calificarea sau calitatea lucrărilor.'}
            </p>
          </div>
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
            <button onClick={finish} className="btn-primary flex-1" style={{ height: 48 }} disabled={loading}>
              {loading ? '...' : (locale === 'ru' ? 'Сохранить и начать →' : 'Salvează și începe →')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
