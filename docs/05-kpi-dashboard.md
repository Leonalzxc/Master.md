# KPI Dashboard: liquidity и конверсии

## 1) North Star

`LiquidityRate` = (кол-во заявок, где заказчик выбрал мастера и открыл контакт) / (кол-во опубликованных заявок)

Цель MVP: **25-35%**.

## 2) KPI-слои

### A. Спрос (заказчики)

- `requests_started` — начали форму заявки.
- `requests_published` — успешно опубликовали заявку.
- `request_publish_rate` = `requests_published / requests_started`.
- `share_requests_with_photo` = заявки с фото / все опубликованные заявки.

### B. Предложение (мастера)

- `worker_signups` — зарегистрировались.
- `worker_profiles_completed` — заполнили анкету.
- `worker_profile_completion_rate` = `worker_profiles_completed / worker_signups`.
- `workers_with_bid` — мастера с >=1 откликом за период.

### C. Ликвидность и скорость

- `avg_bids_per_request` — среднее кол-во откликов на заявку.
- `time_to_first_bid_minutes` — среднее время до первого отклика.
- `requests_with_1plus_bid_rate` — доля заявок с >=1 откликом.
- `request_to_selection_rate` — доля заявок с выбранным мастером.
- `LiquidityRate` — ключевая метрика (см. North Star).

### D. Качество

- `post_selection_review_rate` — доля завершенных заявок с отзывом.
- `avg_worker_rating` — средний рейтинг мастеров.
- `fraud_block_rate` — доля заблокированных сущностей (мониторинг антифрода).

## 3) Цели на MVP (90 дней)

- `LiquidityRate`: 25-35%
- `time_to_first_bid_minutes`: 15-60 мин (рабочее время)
- `share_requests_with_photo`: 40%+
- `worker_profile_completion_rate`: 60%+
- `avg_bids_per_request`: 2.5+

## 4) Схема дашборда

1. **Overview**
   - LiquidityRate, опубликованные заявки, активные мастера, среднее время до отклика.
2. **Client Funnel**
   - start -> step2 -> step3 -> otp_verified -> published -> selected.
3. **Worker Funnel**
   - signup -> profile_completed -> first_bid -> selected.
4. **Operations**
   - модерация, блокировки, причины фрода, SLA поддержки.

## 5) Event tracking (минимум)

- `request_form_started`
- `request_step_completed`
- `request_published`
- `worker_signup_completed`
- `worker_profile_completed`
- `bid_sent`
- `first_bid_received_for_request`
- `worker_selected`
- `contact_revealed`
- `review_submitted`
- `admin_block_action`

Обязательные параметры событий:

- `user_id`
- `role` (`client`, `worker`, `admin`)
- `city`
- `area`
- `category`
- `job_id` (если применимо)
- `worker_id` (если применимо)
- `timestamp`

## 6) Рекомендуемый ритм

- Ежедневно: мониторинг LiquidityRate и времени до первого отклика.
- Еженедельно: разбор узких мест воронки.
- Ежемесячно: ревизия KPI-целей и антифрод-правил.
