# Dev Spec — MASTER Moldova

> Stack: **Next.js 14 App Router · Supabase · Vercel**  
> Язык: TypeScript strict. Линтер: ESLint + Prettier. Тесты: Vitest + Cypress.

---

## 1. Структура проекта

```
master-moldova/
├── app/
│   ├── [locale]/                  # next-intl dynamic locale
│   │   ├── (public)/
│   │   │   ├── page.tsx           # Главная
│   │   │   ├── jobs/
│   │   │   │   ├── page.tsx       # Лента заявок
│   │   │   │   └── [id]/page.tsx  # Карточка заявки
│   │   │   ├── workers/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── gigs/
│   │   │   │   ├── page.tsx
│   │   │   │   └── [id]/page.tsx
│   │   │   ├── services/[svc]/[city]/[area]/page.tsx  # SEO pages
│   │   │   └── legal/[slug]/page.tsx
│   │   ├── (auth)/
│   │   │   └── auth/page.tsx      # SMS OTP
│   │   ├── (dashboard)/
│   │   │   ├── account/
│   │   │   │   ├── client/page.tsx
│   │   │   │   └── worker/page.tsx
│   │   │   └── admin/
│   │   │       └── moderation/page.tsx
│   │   └── request/
│   │       └── new/page.tsx       # 4-step wizard
│   └── api/
│       ├── auth/otp/route.ts
│       ├── payments/webhook/route.ts
│       └── internal/fraud-check/route.ts
├── components/
│   ├── ui/                        # Primitive components (Button, Input, Badge...)
│   ├── features/                  # Domain components (JobCard, BidTable, WorkerCard...)
│   └── layout/                    # Header, Footer, PageWrapper
├── lib/
│   ├── supabase/
│   │   ├── client.ts              # Browser client (createBrowserClient)
│   │   └── server.ts              # Server client (createServerClient)
│   ├── sms/
│   │   └── send-otp.ts
│   ├── payments/
│   │   └── gateway.ts
│   └── fraud/
│       └── rules.ts
├── actions/                       # Next.js Server Actions
│   ├── jobs.ts
│   ├── bids.ts
│   ├── workers.ts
│   └── auth.ts
├── messages/
│   ├── ru.json
│   └── ro.json
├── supabase/
│   └── migrations/                # SQL миграции
└── tests/
    ├── unit/                      # Vitest
    └── e2e/                       # Cypress
```

---

## 2. База данных (Supabase / PostgreSQL)

### Таблицы

```sql
-- Пользователи (расширение auth.users от Supabase)
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  phone       text unique not null,      -- E.164 format: +373XXXXXXXX
  role        text not null check (role in ('client','worker','admin')),
  name        text,
  city        text,
  created_at  timestamptz default now(),
  blocked_at  timestamptz,
  block_reason text
);

-- Профиль мастера
create table public.profiles_worker (
  id              uuid primary key references profiles(id) on delete cascade,
  categories      text[] not null,       -- ['electric','plumbing',...]
  areas           text[] not null,       -- ['Centru','Botanica',...]
  experience_yrs  int,
  bio             text,
  photos          text[],                -- Storage URLs
  viber           text,
  telegram        text,
  whatsapp        text,
  is_pro          boolean default false,
  pro_until       timestamptz,
  bid_credits     int default 5,         -- Бесплатных откликов
  rating_avg      numeric(3,2) default 0,
  rating_count    int default 0,
  verified        boolean default false,
  completed_at    timestamptz            -- Когда анкета заполнена
);

-- Заявки (заказчики)
create table public.jobs (
  id           uuid primary key default gen_random_uuid(),
  client_id    uuid not null references profiles(id),
  title        text,                     -- auto-generated from category+description
  description  text not null,
  category     text not null,
  city         text not null,
  area         text not null,
  budget_min   numeric,
  budget_max   numeric,
  urgency      boolean default false,
  needs_quote  boolean default false,
  photos       text[],
  status       text default 'active' check (status in ('active','in_progress','done','cancelled','blocked')),
  selected_worker_id uuid references profiles(id),
  created_at   timestamptz default now(),
  expires_at   timestamptz default now() + interval '30 days'
);

-- Отклики мастеров
create table public.bids (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs(id) on delete cascade,
  worker_id   uuid not null references profiles(id),
  price       numeric,
  price_max   numeric,
  comment     text not null,
  start_date  date,
  status      text default 'sent' check (status in ('sent','selected','rejected')),
  created_at  timestamptz default now(),
  unique(job_id, worker_id)             -- 1 отклик на заявку от мастера
);

-- Отзывы
create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  job_id      uuid not null references jobs(id),
  author_id   uuid not null references profiles(id),
  worker_id   uuid not null references profiles(id),
  rating      int not null check (rating between 1 and 5),
  text        text,
  created_at  timestamptz default now(),
  unique(job_id, author_id)
);

-- Журнал модерации
create table public.moderation_log (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references profiles(id),
  target_type text not null,            -- 'job','bid','profile','review'
  target_id   uuid not null,
  action      text not null,            -- 'block','approve','note','blacklist'
  reason      text,
  created_at  timestamptz default now()
);

-- Blacklist телефонов
create table public.phone_blacklist (
  phone_hash  text primary key,         -- SHA-256(phone) — не храним сырой номер
  reason      text,
  created_at  timestamptz default now()
);

-- Платёжные транзакции
create table public.payment_transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references profiles(id),
  provider_event_id text unique not null,   -- Idempotency key от шлюза
  type            text not null,            -- 'bid_pack','pro_subscription'
  amount_mdl      numeric not null,
  status          text default 'pending',   -- 'pending','success','failed','refunded'
  payload         jsonb,
  created_at      timestamptz default now()
);
```

### RLS-политики (ключевые)

```sql
-- Заявки: видят все активные, но редактирует только автор
alter table jobs enable row level security;
create policy "jobs_select_active" on jobs for select using (status = 'active' or client_id = auth.uid());
create policy "jobs_insert_own" on jobs for insert with check (client_id = auth.uid());
create policy "jobs_update_own" on jobs for update using (client_id = auth.uid());

-- Отклики: мастер видит свои, заказчик видит на свои заявки
alter table bids enable row level security;
create policy "bids_worker_own" on bids for select using (worker_id = auth.uid());
create policy "bids_client_own_job" on bids for select
  using (exists (select 1 from jobs where jobs.id = bids.job_id and jobs.client_id = auth.uid()));
create policy "bids_insert_worker" on bids for insert
  with check (worker_id = auth.uid() and exists (
    select 1 from profiles_worker pw where pw.id = auth.uid() and pw.completed_at is not null
  ));

-- Профиль мастера: публичный read, write только свой
alter table profiles_worker enable row level security;
create policy "worker_profile_public_read" on profiles_worker for select using (true);
create policy "worker_profile_own_write" on profiles_worker for all using (id = auth.uid());
```

---

## 3. Auth: SMS OTP Flow

### Sequence

```
Client                    Next.js (Server Action)         Supabase             SMS Provider
  |-- phone submit ------> actions/auth.ts:sendOtp()
  |                             |-- rate limit check -----> KV/Redis
  |                             |-- signInWithOtp() -----> Supabase Auth
  |                                                              |-- custom SMS hook -----> SMSAPI.md
  |<-- "enter code" ------
  |-- OTP code submit ---> actions/auth.ts:verifyOtp()
  |                             |-- verifyOtp() ---------> Supabase Auth
  |                             |-- check blacklist -----> phone_blacklist
  |<-- session cookie ----
```

### SMS Provider выбор (⚠️ ЭСКАЛАЦИЯ фаундеру)

| Провайдер | Стоимость | Moldova покрытие | Примечание |
|-----------|-----------|-----------------|-----------|
| SMSAPI.md | ~0.05 EUR/SMS | ✅ Прямой | Местный, рублёвые тарифы |
| Twilio | ~0.08 USD/SMS | ✅ | Международный, надёжный |
| SpeedSMS | ~0.04 EUR | ✅ | Менее документирован |

### Rate Limiting OTP

```typescript
// lib/sms/send-otp.ts
const OTP_WINDOW_SECONDS = 600;   // 10 мин
const OTP_MAX_ATTEMPTS   = 3;     // попыток на окно
const OTP_DAILY_LIMIT    = 10;    // SMS в день на номер
```

---

## 4. API: Server Actions

### jobs.ts

```typescript
// actions/jobs.ts
export async function createJob(formData: FormData): Promise<{jobId?: string; error?: string}>
export async function listJobs(filters: JobFilters): Promise<Job[]>
export async function getJob(id: string): Promise<Job & { bids: Bid[] }>
export async function selectWorker(jobId: string, workerId: string): Promise<void>
```

### bids.ts

```typescript
export async function submitBid(jobId: string, data: BidInput): Promise<{bidId?: string; error?: string}>
  // Проверки: worker profile completed, bid_credits > 0 | is_pro, не дубль
  // Декремент bid_credits если не PRO
export async function listMyBids(): Promise<(Bid & { job: Job })[]>
```

### Anti-fraud checks (в каждом action)

```typescript
// lib/fraud/rules.ts
export async function checkGhostClient(clientId: string): Promise<boolean>
  // Ghost client: >5 заявок без ни одного выбора мастера
export async function checkOffPlatformLeak(text: string): Promise<boolean>
  // Regex: телефоны (+373...), Viber/Telegram юзернеймы в тексте отклика
export async function checkFakeWorker(workerId: string): Promise<boolean>
  // Fake worker: >20 откликов, 0 выборов, профиль без фото
```

---

## 5. Payments

### ⚠️ ЭСКАЛАЦИЯ: Требуется регистрация юрлица (SRL или ИП Moldova) до интеграции

### Рекомендуемый шлюз: maib (Moldova Agroindbank) e-Commerce

| Шлюз | Комиссия | MDL | Документы |
|------|----------|-----|-----------|
| maib e-pay | 1.5–2% | ✅ Нативно | SRL/ИП + договор |
| PayNet | 1.8% | ✅ | SRL + договор |
| mpay | ~2% | ✅ | SRL |

### Продукты для продажи

```typescript
export const PRODUCTS = {
  bid_pack_5:   { credits: 5,  price_mdl: 49,  label_ru: '5 откликов' },
  bid_pack_20:  { credits: 20, price_mdl: 149, label_ru: '20 откликов' },
  bid_pack_50:  { credits: 50, price_mdl: 299, label_ru: '50 откликов' },
  pro_monthly:  { days: 30,    price_mdl: 199, label_ru: 'PRO 1 месяц' },
  pro_quarter:  { days: 90,    price_mdl: 499, label_ru: 'PRO 3 месяца' },
} as const;
```

### Webhook (idempotent)

```typescript
// app/api/payments/webhook/route.ts
export async function POST(req: Request) {
  const event = await req.json();
  // 1. Проверить HMAC-подпись шлюза
  // 2. Upsert payment_transactions по provider_event_id (idempotency)
  // 3. Если success: начислить credits / установить pro_until
  // 4. Вернуть 200 немедленно
}
```

---

## 6. i18n (next-intl)

```
messages/
  ru.json   — основной язык
  ro.json   — румынский/молдавский

URL structure:
  /ru/...   — русский
  /ro/...   — румынский
  /         — redirect по Accept-Language
```

Обязательные ключи:
- `nav.*` — меню
- `home.*` — главная
- `jobs.*` — лента и карточки
- `request.*` — форма заявки
- `worker.*` — профиль мастера
- `auth.*` — OTP экраны
- `legal.*` — юридические страницы

---

## 7. Security Headers (next.config.js)

```javascript
const securityHeaders = [
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",   // убрать unsafe-inline после миграции на nonce
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
      "img-src 'self' data: https://*.supabase.co",
      "frame-ancestors 'none'",
    ].join('; ')
  },
];
```

---

## 8. Rate Limiting (Middleware)

```typescript
// middleware.ts
// Supabase Edge + Upstash Redis (или Vercel KV)
const LIMITS = {
  'POST /api/auth/otp': { window: '10m', max: 3 },
  'POST /actions/createJob': { window: '1d', max: 5 },   // макс 5 заявок/день/номер
  'POST /actions/submitBid': { window: '1h', max: 20 },  // макс 20 откликов/час/мастер
};
```

---

## 9. CI/CD (GitHub Actions)

```yaml
# .github/workflows/ci.yml
on: [push, pull_request]
jobs:
  lint-type-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check

  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - run: npm run test:unit

  e2e:
    runs-on: ubuntu-latest
    steps:
      - run: npx cypress run --spec "tests/e2e/client_flow.cy.ts,tests/e2e/worker_flow.cy.ts"

  deploy-preview:
    needs: [lint-type-check, unit-tests]
    if: github.event_name == 'pull_request'
    # Vercel Preview автоматически через Vercel GitHub integration

  deploy-prod:
    needs: [e2e]
    if: github.ref == 'refs/heads/main'
    # Vercel Production deploy
```

---

## 10. Environment Variables

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=          # только серверный код

# SMS
SMS_PROVIDER=smsapi                 # smsapi | twilio
SMS_API_KEY=
SMS_SENDER_NAME=MASTER              # латиница, макс 11 символов

# Payments
PAYMENT_GATEWAY=maib                # maib | paynet
PAYMENT_MERCHANT_ID=
PAYMENT_SECRET_KEY=
PAYMENT_WEBHOOK_SECRET=

# Monitoring
SENTRY_DSN=
NEXT_PUBLIC_POSTHOG_KEY=

# Security
OTP_RATE_LIMIT_REDIS_URL=           # Upstash Redis URL
CRON_SECRET=                        # для scheduled jobs
```

---

## 11. Тестовые сценарии (Cypress E2E)

```typescript
// tests/e2e/client_flow.cy.ts
describe('Client happy path', () => {
  it('creates a job and sees bids', () => {
    cy.visit('/ru/request/new');
    cy.selectCategory('electric');
    cy.fillDescription('Нужно заменить розетки в 2-комнатной квартире');
    cy.selectCity('Chisinau'); cy.selectArea('Centru');
    cy.fillPhone('+37369000001');
    cy.enterOTP('123456');        // тестовый OTP провайдер
    cy.contains('Заявка опубликована').should('exist');
  });
});

// tests/e2e/worker_flow.cy.ts
describe('Worker happy path', () => {
  it('registers, completes profile, submits bid', () => {
    cy.registerWorker({ phone: '+37369000002', categories: ['electric'] });
    cy.completeWorkerProfile();
    cy.visit('/ru/jobs');
    cy.get('[data-testid=job-card]').first().click();
    cy.submitBid({ price: 500, comment: 'Сделаю за 1 день' });
    cy.contains('Отклик отправлен').should('exist');
  });
});
```

---

## 12. Зависимости (package.json ключевые)

```json
{
  "dependencies": {
    "next": "^14.2",
    "@supabase/supabase-js": "^2",
    "@supabase/ssr": "^0.4",
    "next-intl": "^3",
    "zod": "^3",
    "react-hook-form": "^7",
    "@hookform/resolvers": "^3",
    "clsx": "^2",
    "tailwind-merge": "^2"
  },
  "devDependencies": {
    "typescript": "^5",
    "vitest": "^1",
    "cypress": "^13",
    "@testing-library/react": "^15",
    "tailwindcss": "^3",
    "eslint": "^8",
    "prettier": "^3"
  }
}
```
