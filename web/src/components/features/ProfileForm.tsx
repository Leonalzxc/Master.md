'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORY_LABELS_RU, CATEGORY_ICONS, CITIES, AREAS, type Category } from '@/lib/mock/data';
import { updateProfile } from '@/app/actions/updateProfile';
import type { Profile, ProfileWorker } from '@/lib/supabase/types';

interface Props {
  locale: string;
  profile: Profile;
  workerProfile: ProfileWorker | null;
}

export default function ProfileForm({ locale, profile, workerProfile }: Props) {
  const router = useRouter();
  const t = (ru: string, ro: string) => locale === 'ru' ? ru : ro;

  const [role, setRole] = useState<'client' | 'worker'>(profile.role === 'worker' ? 'worker' : 'client');
  const isWorker = role === 'worker';

  const [name, setName] = useState(profile.name ?? '');
  const [city, setCity] = useState(profile.city ?? '');
  const [bio, setBio] = useState(workerProfile?.bio ?? '');
  const [categories, setCategories] = useState<Category[]>(workerProfile?.categories ?? []);
  const [areas, setAreas] = useState<string[]>(workerProfile?.areas ?? []);
  const [experienceYrs, setExperienceYrs] = useState(String(workerProfile?.experience_yrs ?? ''));
  const [viber, setViber] = useState(workerProfile?.viber ?? '');
  const [telegram, setTelegram] = useState(workerProfile?.telegram ?? '');
  const [whatsapp, setWhatsapp] = useState(workerProfile?.whatsapp ?? '');

  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const availableAreas = city ? (AREAS[city] ?? []) : [];

  function toggleCategory(cat: Category) {
    setCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat]
    );
  }

  function toggleArea(area: string) {
    setAreas((prev) =>
      prev.includes(area) ? prev.filter((a) => a !== area) : [...prev, area]
    );
  }

  async function handleSave() {
    if (!name.trim()) { setError(t('Укажите имя', 'Indicați numele')); return; }
    setLoading(true);
    setError('');
    try {
      await updateProfile({ name, city, role, bio, categories, areas, experience_yrs: experienceYrs, viber, telegram, whatsapp, locale });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('Ошибка сохранения', 'Eroare la salvare'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">

      {/* Role switcher */}
      <section className="card p-5">
        <p className="text-sm font-semibold mb-3" style={{ color: 'var(--text-secondary)' }}>
          {t('Кто я на платформе', 'Rolul meu pe platformă')}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {([
            ['client', '🏠', t('Заказчик', 'Client'), t('Ищу мастера', 'Caut meșter')],
            ['worker', '🔧', t('Мастер', 'Meșter'),   t('Беру заказы', 'Accept comenzi')],
          ] as const).map(([r, icon, label, desc]) => (
            <button
              key={r}
              type="button"
              onClick={() => setRole(r)}
              className="rounded-2xl p-4 text-left flex flex-col gap-1 border-2 transition-all"
              style={{
                background: role === r ? 'var(--accent-dim)' : 'var(--surface-2)',
                borderColor: role === r ? 'var(--accent)' : 'var(--glass-border)',
              }}
            >
              <span style={{ fontSize: 26 }}>{icon}</span>
              <span className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{label}</span>
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</span>
            </button>
          ))}
        </div>
        {role === 'worker' && !workerProfile && (
          <p className="text-xs mt-3" style={{ color: 'var(--accent)' }}>
            ℹ️ {t('После сохранения появятся поля для мастера', 'După salvare vor apărea câmpuri pentru meșter')}
          </p>
        )}
      </section>

      {/* Base info */}
      <section className="card p-6 flex flex-col gap-4">
        <h2 className="font-semibold" style={{ color: 'var(--text)' }}>
          {t('Основная информация', 'Informații de bază')}
        </h2>

        <div>
          <label className="field-label">{t('Имя и фамилия *', 'Nume și prenume *')}</label>
          <input
            className="field-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('Например: Андрей Иванов', 'De ex: Ion Popescu')}
          />
        </div>

        <div>
          <label className="field-label">{t('Телефон', 'Telefon')}</label>
          <input className="field-input" value={profile.phone} disabled style={{ opacity: 0.5 }} />
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            {t('Телефон нельзя изменить', 'Telefonul nu poate fi modificat')}
          </p>
        </div>

        <div>
          <label className="field-label">{t('Город', 'Oraș')}</label>
          <select className="field-input" value={city} onChange={(e) => { setCity(e.target.value); setAreas([]); }}>
            <option value="">{t('Не указан', 'Nespecificat')}</option>
            {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
      </section>

      {/* Worker-specific */}
      {isWorker && (
        <>
          <section className="card p-6 flex flex-col gap-4">
            <h2 className="font-semibold" style={{ color: 'var(--text)' }}>
              {t('О себе', 'Despre mine')}
            </h2>

            <div>
              <label className="field-label">{t('Расскажите о своём опыте', 'Povestiți despre experiența dvs.')}</label>
              <textarea
                rows={4}
                className="field-input"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder={t('Опыт работы, специализация, гарантии...', 'Experiență, specializare, garanții...')}
                style={{ resize: 'vertical' }}
              />
            </div>

            <div>
              <label className="field-label">{t('Стаж (лет)', 'Ani de experiență')}</label>
              <input
                type="number"
                min="0"
                max="60"
                className="field-input"
                style={{ maxWidth: 120 }}
                value={experienceYrs}
                onChange={(e) => setExperienceYrs(e.target.value)}
                placeholder="0"
              />
            </div>
          </section>

          <section className="card p-6 flex flex-col gap-4">
            <h2 className="font-semibold" style={{ color: 'var(--text)' }}>
              {t('Специализация', 'Specializare')}
            </h2>
            <p className="text-sm -mt-2" style={{ color: 'var(--text-muted)' }}>
              {t('Выберите категории, в которых вы работаете', 'Selectați categoriile în care lucrați')}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.entries(CATEGORY_LABELS_RU) as [Category, string][]).map(([cat, label]) => {
                const active = categories.includes(cat);
                return (
                  <button
                    key={cat}
                    onClick={() => toggleCategory(cat)}
                    className="flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all"
                    style={{
                      borderColor: active ? 'var(--accent)' : 'var(--glass-border)',
                      background: active ? 'var(--accent-dim)' : 'var(--bg-elevated)',
                      cursor: 'pointer',
                    }}
                  >
                    <span className="text-xl shrink-0">{CATEGORY_ICONS[cat]}</span>
                    <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {city && availableAreas.length > 0 && (
            <section className="card p-6 flex flex-col gap-4">
              <h2 className="font-semibold" style={{ color: 'var(--text)' }}>
                {t('Районы работы', 'Zone de activitate')}
              </h2>
              <div className="flex flex-wrap gap-2">
                {availableAreas.map((area) => {
                  const active = areas.includes(area);
                  return (
                    <button
                      key={area}
                      onClick={() => toggleArea(area)}
                      className="px-3 py-1.5 rounded-full text-sm font-medium border-2 transition-all"
                      style={{
                        borderColor: active ? 'var(--accent)' : 'var(--glass-border)',
                        background: active ? 'var(--accent-dim)' : 'transparent',
                        color: active ? 'var(--accent)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                      }}
                    >
                      {area}
                    </button>
                  );
                })}
              </div>
            </section>
          )}

          <section className="card p-6 flex flex-col gap-4">
            <h2 className="font-semibold" style={{ color: 'var(--text)' }}>
              {t('Контакты для связи', 'Contacte')}
            </h2>
            <p className="text-sm -mt-2" style={{ color: 'var(--text-muted)' }}>
              {t('Открываются заказчику только после выбора вас исполнителем', 'Vizibile clientului doar după ce vă selectează ca executant')}
            </p>
            {[
              { label: 'Viber', value: viber, onChange: setViber, placeholder: '+373 XX XXX XXX' },
              { label: 'Telegram', value: telegram, onChange: setTelegram, placeholder: '@username' },
              { label: 'WhatsApp', value: whatsapp, onChange: setWhatsapp, placeholder: '+373 XX XXX XXX' },
            ].map(({ label, value, onChange, placeholder }) => (
              <div key={label}>
                <label className="field-label">{label}</label>
                <input className="field-input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} />
              </div>
            ))}
          </section>
        </>
      )}

      {/* Save */}
      {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}

      <div className="flex items-center gap-4">
        <button
          onClick={handleSave}
          disabled={loading}
          className="btn-primary"
          style={{ minWidth: 160, opacity: loading ? 0.7 : 1 }}
        >
          {loading ? '...' : t('Сохранить', 'Salvează')}
        </button>
        {saved && (
          <span className="text-sm font-semibold" style={{ color: 'var(--success)' }}>
            ✓ {t('Сохранено', 'Salvat')}
          </span>
        )}
      </div>
    </div>
  );
}
