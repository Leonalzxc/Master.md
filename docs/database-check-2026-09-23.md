# Проверка работающей Supabase — 23.09.2026

Проект: `kbpuxfjfhgorwoulbpeu.supabase.co`. Проверка выполнена через HTTP API с publishable key из локальной конфигурации, без пользовательской сессии. Только GET, максимум одна строка на запрос; значения персональных данных в отчёт не включены. Записи, RPC с изменениями и миграции не запускались.

## Результаты

| Проверка | Результат |
|---|---|
| Auth health | HTTP 200 |
| profiles, profiles_worker, jobs, bids, reviews | HTTP 200; данные существуют |
| Каталог: profiles → profiles_worker | HTTP 200 |
| Отклик: bids → worker:profiles → profiles_worker | HTTP 200 |
| Отзыв: reviews → author через reviews_author_id_fkey | HTTP 200 |
| profiles.telegram_chat_id / blocked_at | Поля существуют |
| profiles_worker categories/areas/bid_credits/verified/verification_submitted_at/rating_avg/rating_count | Запрос успешен |
| jobs.lat / lng / expires_at / selected_worker_id | Поля существуют |
| jobs.title | **HTTP 400, PostgreSQL 42703: column jobs.title does not exist** |
| notifications.payload / read / type | Поля существуют, HTTP 200 |
| notifications.link | Отсутствует, 42703; текущий NotificationBell использует payload, поэтому сам по себе этот результат не ошибка UI |
| Чтение profiles.phone без входа | **HTTP 200, возвращена строка с непустым значением** |
| Чтение profiles.telegram_chat_id без входа | **HTTP 200, возвращена строка с непустым значением** |
| Чтение непустых jobs.lat/lng без входа | HTTP 200, 0 строк; наличие утечки фактических координат этим запросом не подтверждено |
| OpenAPI schema | HTTP 401; список RPC и их права не установлен |

Ошибки infinite recursion в выполненных SELECT не возникли. Это подтверждает доступность базы и конкретных запросов, но не исправность всех RLS-политик и операций записи.

## Подтверждённые проблемы

1. `web/src/app/actions/createJob.ts:37` передаёт `title` в INSERT, но такого столбца нет в живой базе. Перед проверкой создания заявки требуется согласовать контракт: убрать неиспользуемое поле из записи либо добавить осмысленную миграцию, если title действительно нужен продукту. Этот же INSERT есть в проверенном main.
2. Телефон и Telegram chat ID доступны анонимному API-клиенту. Скрытие контактов в интерфейсе не обеспечивает приватность. Требуется публичная проекция профиля без приватных полей и ограничение чтения базовой таблицы/столбцов с сохранением работы каталога.
3. Отсутствующий notifications.link означает, что старые link-based миграции нельзя запускать вслепую. Текущая база принимает payload-запрос; состояние старых триггеров ещё нужно проверить отдельно.

## Что не проверено

- Создание заявки/отклика, списание кредитов, выбор и завершение: проверка была без изменений данных.
- Изменение ролей/verified/credits, права RPC, триггеры, migration history, admin actions.
- Пользовательские сессии, доставка OTP/Telegram, Realtime publication и storage policies.

В локальной конфигурации нет service-role ключа и прямого DATABASE_URL. Проверки с обычными пользователями и read-only выгрузка pg_policies/GRANT/триггеров потребуются отдельно. Не добавлять service-role ключ в браузер или публичные переменные.
