"""
Manager Bot — принимает задачи от человека, планирует работу для кодера,
проверяет результаты. Знает стек проекта (Next.js/TS/Supabase).
"""

import logging
import os
from dotenv import load_dotenv
from openai import AsyncOpenAI
from telegram import Update
from telegram.ext import (
    Application,
    ContextTypes,
    MessageHandler,
    filters,
)

load_dotenv()

MANAGER_BOT_TOKEN = os.environ["MANAGER_BOT_TOKEN"]
OPENAI_API_KEY = os.environ["OPENAI_API_KEY"]
OPENAI_MODEL = os.getenv("OPENAI_MODEL", "gpt-4o")

logging.basicConfig(
    format="%(asctime)s [MANAGER] %(levelname)s — %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

openai_client = AsyncOpenAI(api_key=OPENAI_API_KEY)

SYSTEM_PROMPT = """Ты — опытный тимлид и архитектор, работающий над конкретным проектом.

## Стек проекта
- Next.js 16 (App Router) + React 19 + TypeScript 5
- Tailwind CSS v4
- Supabase (PostgreSQL + Auth + Storage) через @supabase/ssr
- next-intl v4 — локализации ru и ro
- react-hook-form + zod — формы
- Leaflet — карты

## Структура (кратко)
- src/app/[locale]/ — страницы
- src/app/actions/ — Server Actions
- src/components/ui/ — примитивы, features/ — бизнес-компоненты, layout/ — шапка/подвал
- src/lib/supabase/ — client.ts, server.ts, types.ts
- messages/ru.json и ro.json — i18n
- supabase/migrations/ — SQL миграции

## Git и деплой
- Репозиторий: https://github.com/Leonalzxc/Master.md.git
- Кодер пушит в рабочую ветку автоматически после каждого коммита
- Vercel деплоит автоматически при пуше в `main`
- Когда задача полностью готова и проверена — дай кодеру команду смержить в main:
  `git checkout main && git merge <ветка> && git push origin main`
  После этого Vercel автоматически задеплоит изменения.

## Твоя роль

**При получении задачи от пользователя:**
- Разбей задачу на конкретные шаги.
- Укажи какие файлы нужно создать/изменить (с путями относительно web/).
- Укажи нужно ли добавить i18n-ключи, SQL-миграцию, server action.
- Укажи имя рабочей ветки (например `feat/notifications`).
- Будь точен. Не пиши код сам — только чёткое ТЗ для кодера.

**При получении CODER_RESULT:**
- Проверь логику, типы, соблюдение стека (нет ли `any`, правильный ли Supabase client, есть ли i18n).
- Если есть ошибки lint/TS — проанализируй и опиши что исправить.
- Если всё готово — дай команду мержить в main для деплоя на Vercel.
- Если нужен следующий шаг — сформулируй новый CODER_TASK.

**При ответе на CODER_QUERY:**
- Дай исчерпывающий ответ. Ссылайся на конкретные файлы проекта.

Всегда отвечай по-русски. Не генерируй код сам — только инструкции."""


async def call_openai(messages: list[dict]) -> str:
    response = await openai_client.chat.completions.create(
        model=OPENAI_MODEL,
        messages=messages,
        temperature=0.2,
    )
    return response.choices[0].message.content.strip()


async def send_long(update: Update, text: str) -> None:
    for i in range(0, len(text), 4000):
        await update.message.reply_text(text[i:i + 4000])


async def handle_human_task(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    user_text = update.message.text
    logger.info("Задача от пользователя: %s", user_text[:80])

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"Пользователь поставил задачу для веб-проекта:\n\n{user_text}\n\n"
                "Составь подробное ТЗ для кодера: какие файлы создать/изменить, "
                "какие шаги выполнить, что проверить после."
            ),
        },
    ]

    plan = await call_openai(messages)
    await send_long(update, f"CODER_TASK:\n{plan}")
    logger.info("CODER_TASK отправлен")


async def handle_coder_query(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    query_text = update.message.text[len("CODER_QUERY:"):].strip()
    logger.info("CODER_QUERY: %s", query_text[:80])

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"Кодер задал вопрос по проекту:\n\n{query_text}\n\n"
                "Дай точный ответ, ссылаясь на конкретные файлы и соглашения проекта."
            ),
        },
    ]

    answer = await call_openai(messages)
    await send_long(update, f"MANAGER_FEEDBACK:\n{answer}")
    logger.info("MANAGER_FEEDBACK (ответ на вопрос) отправлен")


async def handle_coder_result(update: Update, context: ContextTypes.DEFAULT_TYPE) -> None:
    result_text = update.message.text[len("CODER_RESULT:"):].strip()
    logger.info("CODER_RESULT получен (%d симв.)", len(result_text))

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "user",
            "content": (
                f"Кодер прислал результат:\n\n{result_text}\n\n"
                "Проверь:\n"
                "1. Соответствие ТЗ\n"
                "2. TypeScript строгость (нет any, правильные типы)\n"
                "3. Правильный Supabase client (server vs client)\n"
                "4. i18n — все строки через переводы, оба языка\n"
                "5. Tailwind v4 — нет inline-стилей\n"
                "Если lint/TS ошибки указаны в результате — прокомментируй их.\n"
                "Если всё верно — подтверди. Если нужен следующий шаг — опиши его."
            ),
        },
    ]

    feedback = await call_openai(messages)

    next_task_kw = ["следующий шаг", "далее нужно", "теперь реализуй", "продолжи с"]
    has_next = any(kw in feedback.lower() for kw in next_task_kw)

    await send_long(update, f"MANAGER_FEEDBACK:\n{feedback}")

    if has_next:
        await send_long(update, f"CODER_TASK:\n{feedback}")

    logger.info("MANAGER_FEEDBACK (проверка кода) отправлен. Новое задание: %s", has_next)


def main() -> None:
    app = Application.builder().token(MANAGER_BOT_TOKEN).build()

    human_filter = (
        filters.TEXT
        & ~filters.COMMAND
        & ~filters.Regex(r"^(CODER_TASK:|CODER_QUERY:|CODER_RESULT:|MANAGER_FEEDBACK:)")
    )

    app.add_handler(MessageHandler(filters.TEXT & filters.Regex(r"^CODER_QUERY:"), handle_coder_query))
    app.add_handler(MessageHandler(filters.TEXT & filters.Regex(r"^CODER_RESULT:"), handle_coder_result))
    app.add_handler(MessageHandler(human_filter, handle_human_task))

    logger.info("Manager Bot запущен.")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
