'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CATEGORY_LABELS_RU, CATEGORY_ICONS, CITIES, AREAS, type Category } from '@/lib/mock/data';

const STEPS = ['Категория', 'Описание', 'Место и время', 'Контакт'];

interface FormData {
  category: Category | '';
  description: string;
  urgent: boolean;
  needsQuote: boolean;
  city: string;
  area: string;
  budget: string;
  startDate: string;
  phone: string;
  otp: string;
  agreeTerms: boolean;
}

const INITIAL: FormData = {
  category: '',
  description: '',
  urgent: false,
  needsQuote: false,
  city: '',
  area: '',
  budget: '',
  startDate: '',
  phone: '+373 ',
  otp: '',
  agreeTerms: false,
};

interface Props { locale: string }

export default function RequestWizard({ locale }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(INITIAL);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);
  const [loading, setLoading] = useState(false);
  const [published, setPublished] = useState(false);

  const set = <K extends keyof FormData>(key: K, value: FormData[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  function validateStep(): boolean {
    const e: typeof errors = {};
    if (step === 0 && !form.category) e.category = 'Выберите категорию';
    if (step === 1 && form.description.trim().length < 20)
      e.description = 'Минимум 20 символов';
    if (step === 2) {
      if (!form.city) e.city = 'Укажите город';
      if (!form.area) e.area = 'Укажите район';
    }
    if (step === 3) {
      const digits = form.phone.replace(/\D/g, '');
      if (digits.length < 11) e.phone = 'Введите корректный номер (+373XXXXXXXX)';
      if (!otpSent) e.otp = 'Сначала получите код';
      else if (form.otp.length < 6) e.otp = 'Введите 6-значный код';
      if (!form.agreeTerms) e.agreeTerms = 'Необходимо согласие с правилами';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function nextStep() {
    if (!validateStep()) return;
    if (step < 3) setStep(step + 1);
  }

  function prevStep() {
    if (step > 0) setStep(step - 1);
  }

  async function sendOtp() {
    const digits = form.phone.replace(/\D/g, '');
    if (digits.length < 11) {
      setErrors((e) => ({ ...e, phone: 'Введите корректный номер' }));
      return;
    }
    setLoading(true);
    // TODO: replace with real SMS provider call
    await new Promise((r) => setTimeout(r, 800));
    setOtpSent(true);
    setOtpTimer(60);
    setLoading(false);
    const interval = setInterval(() => {
      setOtpTimer((t) => {
        if (t <= 1) { clearInterval(interval); return 0; }
        return t - 1;
      });
    }, 1000);
  }

  async function publish() {
    if (!validateStep()) return;
    // TODO: replace with real Server Action
    if (form.otp !== '123456') {
      setErrors((e) => ({ ...e, otp: 'Неверный код. Для теста введите 123456' }));
      return;
    }
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1000));
    setPublished(true);
    setLoading(false);
  }

  if (published) {
    return <SuccessScreen locale={locale} />;
  }

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>
      {/* Progress */}
      <ProgressBar step={step} total={STEPS.length} />

      {/* Step content */}
      <div className="card p-6 mt-4">
        {step === 0 && <Step1Categories form={form} set={set} errors={errors} />}
        {step === 1 && <Step2Description form={form} set={set} errors={errors} />}
        {step === 2 && <Step3Location form={form} set={set} errors={errors} />}
        {step === 3 && (
          <Step4Contact
            form={form}
            set={set}
            errors={errors}
            otpSent={otpSent}
            otpTimer={otpTimer}
            loading={loading}
            onSendOtp={sendOtp}
          />
        )}
      </div>

      {/* Navigation */}
      <div
        className="flex justify-between gap-3 mt-4"
        style={{
          position: 'sticky',
          bottom: 16,
          background: 'var(--bg-deep)',
          padding: '12px 0',
          zIndex: 10,
        }}
      >
        <button
          onClick={prevStep}
          disabled={step === 0}
          className="btn-secondary"
          style={{ opacity: step === 0 ? 0 : 1, pointerEvents: step === 0 ? 'none' : 'auto' }}
        >
          ← Назад
        </button>

        {step < 3 ? (
          <button onClick={nextStep} className="btn-primary" style={{ minWidth: 140 }}>
            Далее →
          </button>
        ) : (
          <button
            onClick={publish}
            disabled={loading}
            className="btn-primary"
            style={{ minWidth: 180, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? 'Публикуем...' : '📤 Опубликовать заявку'}
          </button>
        )}
      </div>
    </div>
  );
}

/* ── Progress Bar ─────────────────────────────────────────────── */
function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div>
      <div className="flex justify-between mb-2">
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} className="flex items-center gap-1">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
              style={{
                background: i <= step ? 'var(--accent)' : 'var(--glass-border)',
                color: i <= step ? '#fff' : 'var(--text-muted)',
              }}
            >
              {i < step ? '✓' : i + 1}
            </div>
            {i < total - 1 && (
              <div
                className="flex-1 h-0.5 mx-1 transition-colors"
                style={{
                  background: i < step ? 'var(--accent)' : 'var(--glass-border)',
                  width: 40,
                }}
              />
            )}
          </div>
        ))}
      </div>
      <p className="text-sm font-semibold mt-1" style={{ color: 'var(--text)' }}>
        Шаг {step + 1}: {['Выберите категорию', 'Опишите задачу', 'Место и время', 'Ваш контакт'][step]}
      </p>
    </div>
  );
}

/* ── Step 1: Categories ───────────────────────────────────────── */
function Step1Categories({ form, set, errors }: StepProps) {
  const cats = Object.entries(CATEGORY_LABELS_RU) as [Category, string][];
  return (
    <div>
      <h2 className="font-semibold text-lg mb-4" style={{ color: 'var(--text)' }}>
        Что нужно сделать?
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

/* ── Step 2: Description ──────────────────────────────────────── */
function Step2Description({ form, set, errors }: StepProps) {
  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-semibold text-lg" style={{ color: 'var(--text)' }}>
        Опишите задачу
      </h2>

      <div>
        <label className="field-label">Описание работы *</label>
        <textarea
          rows={4}
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          placeholder="Например: нужно заменить 5 розеток и 3 выключателя в 2-комнатной квартире. Проводка медная."
          className="field-input"
          style={{ resize: 'vertical' }}
        />
        <div className="flex justify-between mt-1">
          {errors.description
            ? <FieldError>{errors.description}</FieldError>
            : <span />}
          <span className="text-xs" style={{ color: form.description.length < 20 ? 'var(--warning)' : 'var(--text-muted)' }}>
            {form.description.length}/20 мин.
          </span>
        </div>
      </div>

      <div className="flex gap-3">
        <Chip active={form.urgent} onClick={() => set('urgent', !form.urgent)}>
          ⚡ Срочно
        </Chip>
        <Chip active={form.needsQuote} onClick={() => set('needsQuote', !form.needsQuote)}>
          📋 Нужна смета
        </Chip>
      </div>
    </div>
  );
}

/* ── Step 3: Location ─────────────────────────────────────────── */
function Step3Location({ form, set, errors }: StepProps) {
  const areas = form.city ? (AREAS[form.city] || []) : [];

  return (
    <div className="flex flex-col gap-4">
      <h2 className="font-semibold text-lg" style={{ color: 'var(--text)' }}>
        Где и когда?
      </h2>

      <div>
        <label className="field-label">Город *</label>
        <select
          value={form.city}
          onChange={(e) => { set('city', e.target.value); set('area', ''); }}
          className="field-input"
        >
          <option value="">Выберите город</option>
          {CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {errors.city && <FieldError>{errors.city}</FieldError>}
      </div>

      {form.city && (
        <div>
          <label className="field-label">Район *</label>
          <select value={form.area} onChange={(e) => set('area', e.target.value)} className="field-input">
            <option value="">Выберите район</option>
            {areas.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
          {errors.area && <FieldError>{errors.area}</FieldError>}
        </div>
      )}

      <div>
        <label className="field-label">Бюджет (необязательно)</label>
        <div className="relative">
          <input
            type="number"
            value={form.budget}
            onChange={(e) => set('budget', e.target.value)}
            placeholder="например 2000"
            className="field-input"
            style={{ paddingRight: 52 }}
          />
          <span
            className="absolute right-3 top-1/2 -translate-y-1/2 text-sm"
            style={{ color: 'var(--text-muted)' }}
          >MDL</span>
        </div>
      </div>

      <div>
        <label className="field-label">Желаемая дата начала</label>
        <input
          type="date"
          value={form.startDate}
          onChange={(e) => set('startDate', e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="field-input"
        />
      </div>
    </div>
  );
}

/* ── Step 4: Contact + OTP ────────────────────────────────────── */
function Step4Contact({
  form, set, errors, otpSent, otpTimer, loading, onSendOtp,
}: StepProps & { otpSent: boolean; otpTimer: number; loading: boolean; onSendOtp: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <h2 className="font-semibold text-lg" style={{ color: 'var(--text)' }}>
        Ваш номер телефона
      </h2>

      <div>
        <label className="field-label">Телефон *</label>
        <div className="flex gap-2">
          <input
            type="tel"
            value={form.phone}
            onChange={(e) => {
              let v = e.target.value;
              if (!v.startsWith('+373 ')) v = '+373 ' + v.replace(/^\+373\s?/, '');
              set('phone', v);
            }}
            placeholder="+373 XX XXX XXX"
            className="field-input flex-1"
            disabled={otpSent}
          />
          <button
            onClick={onSendOtp}
            disabled={loading || (otpSent && otpTimer > 0)}
            className="btn-primary shrink-0"
            style={{ fontSize: 13, whiteSpace: 'nowrap', opacity: (otpSent && otpTimer > 0) ? 0.6 : 1 }}
          >
            {loading ? '...' : otpSent && otpTimer > 0 ? `${otpTimer}с` : 'Получить код'}
          </button>
        </div>
        {errors.phone && <FieldError>{errors.phone}</FieldError>}
      </div>

      {otpSent && (
        <div>
          <label className="field-label">Код из SMS *</label>
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            value={form.otp}
            onChange={(e) => set('otp', e.target.value.replace(/\D/g, ''))}
            placeholder="123456"
            className="field-input text-center text-xl tracking-widest"
            style={{ letterSpacing: '0.3em' }}
            autoFocus
          />
          {errors.otp && <FieldError>{errors.otp}</FieldError>}
          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
            Тестовый код: <strong>123456</strong>
          </p>
        </div>
      )}

      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={form.agreeTerms}
          onChange={(e) => set('agreeTerms', e.target.checked)}
          className="mt-0.5 w-4 h-4 accent-[var(--accent)]"
        />
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Принимаю{' '}
          <a href="/ru/legal/terms" target="_blank" style={{ color: 'var(--accent)' }}>
            Условия использования
          </a>{' '}
          и{' '}
          <a href="/ru/legal/privacy" target="_blank" style={{ color: 'var(--accent)' }}>
            Политику конфиденциальности
          </a>
        </span>
      </label>
      {errors.agreeTerms && <FieldError>{errors.agreeTerms}</FieldError>}
    </div>
  );
}

/* ── Success Screen ───────────────────────────────────────────── */
function SuccessScreen({ locale }: { locale: string }) {
  return (
    <div className="card p-10 text-center flex flex-col items-center gap-4" style={{ maxWidth: 480, margin: '0 auto' }}>
      <div
        className="w-16 h-16 rounded-full flex items-center justify-center text-3xl"
        style={{ background: 'rgba(22,163,74,.1)' }}
      >
        ✅
      </div>
      <h2 className="font-bold text-xl" style={{ color: 'var(--text)', fontFamily: 'var(--font-display)' }}>
        Заявка опубликована!
      </h2>
      <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
        Мастера уже видят вашу заявку. Первый отклик — обычно в течение 15–30 минут.
      </p>
      <a href={`/${locale}/jobs`} className="btn-primary mt-2">
        Смотреть мастеров →
      </a>
    </div>
  );
}

/* ── Helpers ──────────────────────────────────────────────────── */
type StepProps = {
  form: FormData;
  set: <K extends keyof FormData>(key: K, val: FormData[K]) => void;
  errors: Partial<Record<keyof FormData, string>>;
};

function FieldError({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{children}</p>
  );
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
