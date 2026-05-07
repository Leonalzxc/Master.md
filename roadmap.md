# MASTER Moldova — Product Roadmap

> **Stack: Path A** — Next.js 14 App Router · Supabase · Vercel  
> **Горизонт:** 16 недель от старта (2026-05-07 → 2026-08-27)  
> **North Star KPI:** LiquidityRate ≥ 25% (заявки с выбранным мастером / все опубликованные заявки)

---

## Легенда

| Символ | Значение |
|--------|----------|
| 🔴 P0 | Блокер релиза — без этого не пускать |
| 🟡 P1 | Нужно для первых реальных пользователей |
| 🟢 P2 | Рост и монетизация после валидации |
| ⚠️ ЭСКАЛАЦИЯ | Решение фаундера обязательно перед стартом |

---

## Phase 0 — Foundation (Weeks 1–4, до 2026-06-04)

> Цель: перенести статический прототип на реальный стек. Ни один реальный пользователь ещё не видит сервис.

### W1: Repo + Infrastructure

| # | Задача | Pri | Трудозатраты |
|---|--------|-----|-------------|
| 0.1 | Init Next.js 14 monorepo, настроить Vercel Preview + Production | 🔴 P0 | 4 ч |
| 0.2 | Supabase project: создать org, настроить PITR, выбрать регион EU (Frankfurt) | 🔴 P0 | 2 ч |
| 0.3 | GitHub repo, branch protection, GitHub Actions skeleton | 🔴 P0 | 2 ч |
| 0.4 | ⚠️ ЭСКАЛАЦИЯ: выбор SMS-провайдера (SMSAPI.md / Twilio / SpeedSMS.md) | 🔴 P0 | 1 ч |
| 0.5 | ENV secrets: Supabase URL+anon+service, SMS API key, Sentry DSN | 🔴 P0 | 1 ч |

### W2: Database Schema + Auth

| # | Задача | Pri | Трудозатраты |
|---|--------|-----|-------------|
| 0.6 | Миграции Supabase: users, profiles_worker, profiles_client, jobs, bids, reviews, moderation_log | 🔴 P0 | 6 ч |
| 0.7 | RLS-политики: client видит только свои jobs; worker видит только принятые bids | 🔴 P0 | 4 ч |
| 0.8 | Supabase Auth + кастомный SMS OTP flow (Edge Function → провайдер) | 🔴 P0 | 5 ч |
| 0.9 | Rate-limit OTP: max 3 попытки / 10 мин / номер (Redis или Supabase KV) | 🔴 P0 | 2 ч |

### W3: Core API + UI Shell

| # | Задача | Pri | Трудозатраты |
|---|--------|-----|-------------|
| 0.10 | Server Actions / Route Handlers: create_job, list_jobs, submit_bid, select_worker | 🔴 P0 | 8 ч |
| 0.11 | Перенос design tokens в Tailwind config (CSS vars из tokens.mvp.json) | 🟡 P1 | 3 ч |
| 0.12 | Layout: Header (RU/RO lang switcher), Footer, RootLayout | 🟡 P1 | 4 ч |
| 0.13 | i18n: next-intl, словари /messages/ru.json и /messages/ro.json | 🟡 P1 | 4 ч |

### W4: MVP Flows Migration + Smoke Tests

| # | Задача | Pri | Трудозатраты |
|---|--------|-----|-------------|
| 0.14 | 4-step форма заявки с OTP (перенос из прототипа) | 🔴 P0 | 6 ч |
| 0.15 | Лента заявок + карточка + отклик | 🔴 P0 | 5 ч |
| 0.16 | Профиль мастера + кабинет | 🟡 P1 | 5 ч |
| 0.17 | Cypress E2E: client_flow + worker_flow (happy path) | 🔴 P0 | 4 ч |
| 0.18 | ⚠️ ЭСКАЛАЦИЯ: регистрация юрлица/ИП в Молдове (нужно до платежей) | 🔴 P0 | — |

**Phase 0 итого:** ~66 ч (≈ 2.5–3 недели плотной работы для 1 фаундера)

---

## Phase 1 — Soft Launch (Weeks 5–8, до 2026-07-02)

> Цель: 30 верифицированных мастеров, первые реальные заявки, LiquidityRate ≥ 15%.

### W5: Moderation + Anti-fraud

| # | Задача | Pri | Трудозатраты |
|---|--------|-----|-------------|
| 1.1 | Admin moderation dashboard (очередь, блокировка, log) | 🔴 P0 | 6 ч |
| 1.2 | Anti-fraud rules: дубль номера, ghost-client detection (нет выбора > 5 заявок) | 🔴 P0 | 4 ч |
| 1.3 | Off-platform leakage detection: сканирование откликов на паттерны телефонов | 🟡 P1 | 3 ч |
| 1.4 | Blacklist таблица (phone_hash + причина) | 🔴 P0 | 2 ч |

### W6: Legal Pages + Payments Foundation

| # | Задача | Pri | Трудозатраты |
|---|--------|-----|-------------|
| 1.5 | Рендер юридических страниц из MD (terms, privacy, moderation, reviews, refund) | 🟡 P1 | 3 ч |
| 1.6 | ⚠️ ЭСКАЛАЦИЯ: выбор платёжного шлюза (maib / PayNet / mpay Moldova) | 🔴 P0 | 2 ч |
| 1.7 | Интеграция платёжного шлюза: purchase bid_pack (5/20/50 откликов) | 🟡 P1 | 8 ч |
| 1.8 | Webhook платёжных событий + idempotency (хранить event_id) | 🔴 P0 | 3 ч |

### W7: SEO + Analytics

| # | Задача | Pri | Трудозатраты |
|---|--------|-----|-------------|
| 1.9 | Динамические SEO-страницы /ru/services/:svc/:city/:area (SSG + ISR) | 🟡 P1 | 6 ч |
| 1.10 | Sitemap.xml dynamic, robots.txt, hreflang RU/RO | 🟡 P1 | 2 ч |
| 1.11 | PostHog или Plausible: события из docs/05-kpi-events.csv | 🟡 P1 | 3 ч |
| 1.12 | Sentry error tracking (frontend + edge functions) | 🔴 P0 | 2 ч |

### W8: Soft Launch Gate

| # | Задача | Pri | Трудозатраты |
|---|--------|-----|-------------|
| 1.13 | Security audit: OWASP Top-10 чеклист, CSP headers, rate-limit на API | 🔴 P0 | 5 ч |
| 1.14 | Load test: k6 / 50 VU симуляция публикации заявок | 🔴 P0 | 3 ч |
| 1.15 | Onboarding 30 мастеров вручную (WhatsApp/Viber outreach) | 🔴 P0 | 8 ч |
| 1.16 | Мягкий запуск: invite-only по ссылке, первые 20 заявок | 🔴 P0 | — |

**Phase 1 итого:** ~59 ч

---

## Phase 2 — Growth (Weeks 9–16, до 2026-08-27)

> Цель: 150+ мастеров, 80+ заявок/мес, LiquidityRate ≥ 25%, первая выручка.

### W9–10: PRO Features + Chat

| # | Задача | Pri | Трудозатраты |
|---|--------|-----|-------------|
| 2.1 | PRO-профиль мастера (badge, топ в поиске, доп. фото) | 🟡 P1 | 6 ч |
| 2.2 | Подписка PRO: ежемесячная / квартальная (recurring payment) | 🟡 P1 | 6 ч |
| 2.3 | Чат заказчик ↔ мастер (Supabase Realtime) после выбора | 🟢 P2 | 10 ч |
| 2.4 | Push/Viber уведомления: новый отклик, выбор мастера | 🟢 P2 | 6 ч |

### W11–12: SEO Content Machine

| # | Задача | Pri | Трудозатраты |
|---|--------|-----|-------------|
| 2.5 | Генерация 200+ SEO-страниц волны 1 (из seo-pages-wave1.csv) | 🟡 P1 | 4 ч |
| 2.6 | Blog/FAQ section (MDX) | 🟢 P2 | 4 ч |
| 2.7 | Structured data: LocalBusiness, FAQPage, Service schema | 🟡 P1 | 3 ч |

### W13–14: Quality + Trust

| # | Задача | Pri | Трудозатраты |
|---|--------|-----|-------------|
| 2.8 | Верификация мастера (фото паспорта → ручная проверка) | 🟡 P1 | 5 ч |
| 2.9 | Портфолио мастера (фото до/после с тегами) | 🟡 P1 | 4 ч |
| 2.10 | Система споров (клиент открывает спор, модератор решает) | 🟡 P1 | 6 ч |

### W15–16: Stability + Metrics

| # | Задача | Pri | Трудозатраты |
|---|--------|-----|-------------|
| 2.11 | Admin analytics dashboard (LiquidityRate, воронки) | 🟡 P1 | 6 ч |
| 2.12 | GDPR-style data export / account deletion flow | 🔴 P0 | 4 ч |
| 2.13 | Automated backup test + disaster recovery runbook | 🟡 P1 | 3 ч |

**Phase 2 итого:** ~67 ч

---

## Хронологическая сводка

```
Week  1-2: Infra + DB + Auth
Week  3-4: Core flows + Cypress
Week  5-6: Admin + Payments
Week  7-8: SEO + Soft Launch → 🚀
Week  9-12: PRO + Chat + SEO content
Week 13-16: Trust + Disputes + Analytics
```

## Трудозатраты суммарно

| Phase | Часы | Недели (40ч/нед) |
|-------|------|-----------------|
| Phase 0 | ~66 ч | ~1.7 |
| Phase 1 | ~59 ч | ~1.5 |
| Phase 2 | ~67 ч | ~1.7 |
| **Итого** | **~192 ч** | **~5 недель чистой работы** |

> Реалистично для 1 фаундера (20–25 ч/нед): **8–10 недель до публичного релиза**

---

## Decision Log (заполнять по ходу)

| Дата | Решение | Альтернатива | Причина |
|------|---------|-------------|---------|
| 2026-05-07 | Path A (Next.js+Supabase+Vercel) | Path B (NestJS+Postgres) | Скорость для 1 фаундера |
| TBD | SMS-провайдер | — | ⚠️ Нужен выбор фаундера |
| TBD | Платёжный шлюз | — | ⚠️ Нужна регистрация юрлица |

---

## Weekly Status Template

```
## Week N Status (YYYY-MM-DD)

### Completed
- 

### Blockers
- 

### Next week
- 

### KPIs
- Workers registered: 
- Jobs published: 
- LiquidityRate: 
```
