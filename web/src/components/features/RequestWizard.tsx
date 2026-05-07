'use client';

import { useState } from 'react';
import { CATEGORY_LABELS_RU, CATEGORY_ICONS, CITIES, AREAS, type Category } from '@/lib/mock/data';
import { createJob } from '@/app/actions/createJob';

const STEPS = ['Категория', 'Описание', 'Место'];

interface FormData {
  category: Category | '';
  description: string;
  urgent: boolean;
  needsQuote: boolean;
  city: string;
  area: string;
  budget: string;
}

const INITIAL: FormData = {
  category: '',
  description: '',
  urgent: false,
  needsQuote: false,
  city: '',
  area: '',
  budget: '',
};

interface Props { locale: string }

export default function RequestWizard({ locale }: Props) {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [loading, setLoading] = useState(false);
  const [serverError, setServerError] = useState('');

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  function validateStep(): boolean {
    const e: typeof errors = {};
    if (step === 0 && !form.category) e.category = locale === 'ru' ? 'Выберите категорию' : 'Alegeți categoria';
    if (step === 1 && form.description.trim().length < 20)
      e.description = locale === 'ru' ? 'Минимум 20 символов' : 'Minim 20 caractere';
    if (step === 2) {
      if (!form.city) e.city = locale === 'ru' ? 'Укажите город' : 'Indicați orașul';
      if (!form.area) e.area = locale === 'ru' ? 'Укажите район' : 'Indicați sectorul';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function nextStep() {
    if (!validateStep()) return;
    if (step < STEPS.length - 1) setStep(step + 1);
  }

  function prevStep() {
    if (step > 0) setStep(step - 1);
  }

  async function publish() {
    if (!validateStep()) return;
    setLoading(true);
    setServerError('');
    try {
      await createJob({
        category: form.category as string,
        description: form.description,
        city: form.city,
        area: form.area,
        budget: form.budget,
        urgent: form.urgent,
        needsQuote: form.needsQuote,
        locale,
      });
    } catch (err) {
      setServerError(err instanceof Error ? err.message : 'Ошибка. Попробуйте снова.');
      setLoading(false);
    }
  }

  const isLastStep = step === STEPS.length - 1;

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      <ProgressBar step={step} total={STEPS.length} locale={locale} />

      <div className="card p-6 mt-4">
        {step === 0 && <Step1Categories form={form} set={set} errors={errors} locale={locale} />}
        {step === 1 && <Step2Description form={form} set={set} errors={errors} locale={locale} />}
        {step === 2 && <Step3Location form={form} set={set} errors={errors} locale={locale} />}
      </div>

      {serverError && (
        <p className="text-sm mt-3 text-center" style={{ color: 'var(--danger)' }}>{serverError}</p>
      )}

      <div
        className="flex justify-between gap-3 mt-4"
        style={{ position: 'sticky', bottom: 16, background: 'var(--bg-deep)', padding: '12px 0', zIndex: 10 }}
      >
        <button
          onClick={prevStep}
          disabled={step === 0}
          className="btn-secondary"
          style={{ opacity: step === 0 ? 0 : 1, pointerEvents: step === 0 ? 'none' : 'auto' }}
        >
          ← {locale === 'ru' ? 'Назад' : 'Înapoi'}
        </button>

        {!isLastStep ? (
          <button onClick={nextStep} className="btn-primary" style={{ minWidth: 140 }}>
            {locale === 'ru' ? 'Далее →' : 'Înainte →'}
          </button>
        ) : (
          <button
            onClick={publish}
            disabled={loading}
            className="btn-primary"
            style={{ minWidth: 180, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? (locale === 'ru' ? 'Публикуем...' : 'Se publică...') : `📤 ${locale === 'ru' ? 'Опубликовать заявку' : 'Publică cererea'}`}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Progress Bar ─────────────────────────────────────────────── */
function ProgressBar({ step, total, locale }: { step: number; total: number; locale: string }) {
  const labels = locale === 'ru'
    ? ['Выберите категорию', 'Опишите задачу', 'Место и бюджет']
    : ['Alegeți categoria', 'Descrieți sarcina', 'Loc și buget'];

  return (
    <div>
      <div className="flex items-center mb-2">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="flex items-center" style={{ flex: i < total - 1 ? '1' : 'none' }}>
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors"
              style={{
                background: i <= step ? 'var(--accent)' : 'var(--glass-border)',
                color: i <= step ? '#fff' : 'var(--text-muted)',
              }}
            >
              {i < step ? '✓' : i + 1}
            </div>
            {i < total - 1 && (
              <div className="h-0.5 flex-1 mx-1 transition-colors" style={{ background: i < step ? 'var(--accent)' : 'var(--glass-border)' }} />
            )}
          </div>
        ))}
      </div>
      <p className="text-sm font-semibold mt-1" style={{ color: 'var(--text)' }}>
        {locale === 'ru' ? `Шаг ${step + 1}:` : `Pasul ${step + 1}:`} {labels[step]}
      </p>
    </div>
  );
}

/* ── Step 1 ───────────────────────────────────────────────────── */
function Step1Categories({ form, set, errors, locale }: StepProps) {
  const cats = Object.entries(CATEGORY_LABELS_RU) as [Category, string][];
  return (
    <div>
      <h2 className="font-semibold text-lg mb-4" style={{ color: 'var(--text)' }}>
        {locale === 'ru' ? 'Что нужно сделать?' : 'Ce trebuie făcut?'}
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {cats.map(([slug, label]) => (
          <button
            key={slug}
            onClick={() => set('category', slug)}
            className="flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all text-center"
            style={{
              borderColor: form.category === slug ? 'var(--accent)' : 'var(--glass-border)',
              background: form.category === slug ? 'var(--accent-dim)' : 'var(--bg-elevated)',
              cursor: 'pointer',
            }}
          >
            <span className="text-2xl">{CATEGORY_ICONS[slug]}</span>
            <span className="text-sm font-medium" style={{ color: 'var(--text)' }}>{label}</span>
          </button>
        ))}
      </div>
      {errors.category && <FieldError>{errors.category}</FieldError>}
    </div>
  );
}

/* ── Step 2 ───────────────────────────────────────────────────── */
function Step2Description({ form, set, errors, locale }: StepProps) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-semibold text-lg" style={{ color: 'var(--text)' }}>
        {locale === 'ru' ? 'Опишите задачу' : 'Descrieți sarcina'}
      </h2>

      <div>
        <label className="field-label">{locale === 'ru' ? 'Описание работы *' : 'Descrierea lucrării *'}</label>
        <textarea
          rows={4}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder={locale === 'ru'
            ? 'Например: нужно заменить 5 розеток и 3 выключателя в 2-комнатной квартире.'
            : 'De exemplu: trebuie înlocuite 5 prize și 3 întrerupătoare într-un apartament cu 2 camere.'}
          className="field-input"
          style={{ resize: 'vertical' }}
        />
        <div className="flex justify-between mt-1">
          {errors.description ? <FieldError>{errors.description}</FieldError> : <span />}
          <span className="text-xs" style={{ color: form.description.length < 20 ? 'var(--warning)' : 'var(--text-muted)' }}>
            {form.description.length}/20 {locale === 'ru' ? 'мин.' : 'min.'}
          </span>
        </div>
      </div>

      <div className="flex gap-3">
        <Chip active={form.urgent} onClick={() => set('urgent', !form.urgent)}>
          ⚡ {locale === 'ru' ? 'Срочно' : 'Urgent'}
        </Chip>
        <Chip active={form.needsQuote} onClick={() => set('needsQuote', !form.needsQuote)}>
          📋 {locale === 'ru' ? 'Нужна смета' : 'Deviz necesar'}
        </Chip>
      </div>
    </div>
  );
}

/* ── Step 3 ───────────────────────────────────────────────────── */
function Step3Location({ form, set, errors, locale }: StepProps) {
  const areas = form.city ? (AREAS[form.city] || []) : [];

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-semibold text-lg" style={{ color: 'var(--text)' }}>
        {locale === 'ru' ? 'Где и бюджет?' : 'Unde și bugetul?'}
      </h2>

      <div>
        <label className="field-label">{locale === 'ru' ? 'Город *' : 'Oraș *'}</label>
        <select value={form.city} onChange={(e) => { set('city', e.target.value); set('area', ''); }} className="field-input">
          <option value="">{locale === 'ru' ? 'Выберите город' : 'Alegeți orașul'}</option>
          {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {errors.city && <FieldError>{errors.city}</FieldError>}
      </div>

      {form.city && (
        <div>
          <label className="field-label">{locale === 'ru' ? 'Район *' : 'Sector *'}</label>
          <select value={form.area} onChange={(e) => set('area', e.target.value)} className="field-input">
            <option value="">{locale === 'ru' ? 'Выберите район' : 'Alegeți sectorul'}</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          {errors.area && <FieldError>{errors.area}</FieldError>}
        </div>
      )}

      <div>
        <label className="field-label">{locale === 'ru' ? 'Бюджет (необязательно)' : 'Buget (opțional)'}</label>
        <div className="relative">
          <input
            type="number"
            value={form.budget}
            onChange={(e) => set('budget', e.target.value)}
            placeholder={locale === 'ru' ? 'например 2000' : 'ex. 2000'}
            className="field-input"
            style={{ paddingRight: 52 }}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-muted)' }}>MDL</span>
        </div>
      </div>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────── */
type StepProps = {
  form: FormData;
  set: <K extends keyof FormData>(key: K, val: FormData[K]) => void;
  errors: Partial<Record<keyof FormData, string>>;
  locale: string;
};

function FieldError({ children }: { children: React.ReactNode }) {
  return <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{children}</p>;
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2 rounded-full text-sm font-medium border-2 transition-all"
      style={{
        borderColor: active ? 'var(--accent)' : 'var(--glass-border)',
        background: active ? 'var(--accent-dim)' : 'transparent',
        color: active ? 'var(--accent)' : 'var(--text-secondary)',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  );
}
