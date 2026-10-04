# Доступ к базе для выпуска

SQL Editor уже отвечает. Для полноценного backup/restore нужен сеансовый
PostgreSQL доступ; публичный ключ API или service-role key его не заменяют.
В бесплатном проекте сейчас нет готовой резервной копии.

1. Supabase → **Connect → Direct → Session pooler**. Для этого проекта показаны
   host `aws-0-eu-west-1.pooler.supabase.com`, порт `5432`, база `postgres`,
   пользователь `postgres.kbpuxfjfhgorwoulbpeu`.
2. В локальном файле `web/.env.db.local` заполнить только `PGPASSWORD=""`
   существующим паролем базы, сохранить. Остальные поля подготовлены. Пароль
   не отправлять в чат и не добавлять в Vercel public env. Если пароль неизвестен,
   сообщить об этом; сброс требует отдельной оценки влияния на подключения.
3. Проверить только чтение:
   `node --env-file=.env.db.local scripts/db-connection-check.mjs` из `web/`.
   Скрипт печатает версию PostgreSQL и количество столбцов таблиц, никаких
   значений профилей и секретов. Изменения базы не выполняются.

Файл исключён из Git; создан с правами 0600. Пароли со специальными символами
нужно записывать с корректным quoting формата env; URI percent-encoding здесь
не требуется. Проверка TLS обязательна. При ошибке доверия сертификату добавить
путь к CA-файлу из настроек Supabase в `PGSSLROOTCERT`, а не отключать TLS.

После подключения: определить версию сервера, сохранить dump/roles/GRANT и
проверить восстановление в изолированной базе. Клиент pg_dump не должен быть
старше сервера. Backup содержит личные данные: хранить вне репозитория с
ограниченными правами, не публиковать и не отправлять в чат. Файлы Storage
требуют отдельного сохранения; SQL dump не содержит байты фотографий.

Только после backup и проверки текущих триггеров выполняется связанная
выкладка `docs/releases/20261004-free-balti-pilot.sql` и соответствующего SHA
кода. Read-only CSV политик является аудитом, не резервной копией.

Источники: [подключение PostgreSQL](https://supabase.com/docs/guides/database/connecting-to-postgres),
[backup/restore](https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore),
[совместимость pg_dump](https://www.postgresql.org/docs/16/app-pgdump.html).
