# Telegram Dual-Bot System: Manager + Coder

Два Telegram-бота работают в одном групповом чате и непрерывно взаимодействуют друг с другом.

| Бот | Модель | Роль |
|-----|--------|------|
| **Manager Bot** | OpenAI GPT-4o | Принимает задачи от человека, планирует работу, проверяет код |
| **Coder Bot** | Anthropic Claude | Получает задачи, выбирает язык, пишет код, задаёт уточняющие вопросы |

---

## Структура проекта

```
telegram-bots/
├── manager_bot.py     # Бот-менеджер (OpenAI)
├── coder_bot.py       # Бот-кодер (Claude)
├── requirements.txt   # Зависимости
├── .env.example       # Шаблон переменных окружения
└── README.md
```

---

## Установка

### 1. Клонируй репозиторий и перейди в папку

```bash
cd telegram-bots
```

### 2. Создай виртуальное окружение

```bash
python -m venv .venv
source .venv/bin/activate      # Linux / macOS
.venv\Scripts\activate         # Windows
```

### 3. Установи зависимости

```bash
pip install -r requirements.txt
```

### 4. Создай `.env` файл

```bash
cp .env.example .env
```

Открой `.env` и заполни все значения:

```env
# Manager Bot
MANAGER_BOT_TOKEN=токен_менеджер_бота
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o          # или gpt-4-turbo, gpt-3.5-turbo

# Coder Bot
CODER_BOT_TOKEN=токен_кодер_бота
ANTHROPIC_API_KEY=sk-ant-...
CLAUDE_MODEL=claude-opus-4-7  # или claude-sonnet-4-6
```

---

## Создание ботов в Telegram

1. Открой [@BotFather](https://t.me/BotFather) в Telegram.
2. Отправь `/newbot` и следуй инструкциям — создай **два** бота.
3. Скопируй токены обоих ботов в `.env`.
4. Для каждого бота выполни `/setprivacy` → `Disable`, чтобы боты читали все сообщения в группе.

---

## Настройка группового чата

1. Создай новую Telegram-группу.
2. Добавь оба бота в группу.
3. Назначь обоих ботов **администраторами** (иначе они не смогут читать сообщения друг друга).

---

## Запуск

Запускай каждого бота в **отдельном терминале**:

```bash
# Терминал 1 — Manager Bot
python manager_bot.py

# Терминал 2 — Coder Bot
python coder_bot.py
```

Или запусти оба сразу в фоне:

```bash
python manager_bot.py &
python coder_bot.py &
```

---

## Как это работает

```
Пользователь → [сообщение в группу]
      ↓
Manager Bot (OpenAI)
  • Анализирует задачу
  • Выбирает язык программирования
  • Формирует план
  • Отправляет: CODER_TASK: ...
      ↓
Coder Bot (Claude)
  • Читает задачу
  • Выбирает/подтверждает язык
  • Пишет код + пояснение по-русски
  • Отправляет: CODER_RESULT: ...
  ──── или ────
  • Если недостаточно данных:
  • Отправляет: CODER_QUERY: ...
      ↓
Manager Bot (OpenAI)
  • Проверяет код → MANAGER_FEEDBACK: (одобрение / замечания)
  • Отвечает на вопрос → MANAGER_FEEDBACK: (ответ)
  • При необходимости → новый CODER_TASK:
      ↓
[Цикл повторяется до завершения задачи]
```

---

## Протокол сообщений

| Префикс | Кто отправляет | Смысл |
|---------|---------------|-------|
| `CODER_TASK:` | Manager Bot | Задача и инструкции для кодера |
| `CODER_QUERY:` | Coder Bot | Уточняющий вопрос (один!) |
| `CODER_RESULT:` | Coder Bot | Готовый код с пояснением |
| `MANAGER_FEEDBACK:` | Manager Bot | Отзыв, замечания или подтверждение |

---

## Поддерживаемые языки программирования

Менеджер автоматически выбирает язык исходя из контекста:

- **Python** — скрипты, автоматизация, ML, API
- **JavaScript / TypeScript** — фронтенд, Node.js, React
- **HTML / CSS** — разметка, стили, вёрстка
- **SQL** — запросы к БД, схемы
- **Bash** — shell-скрипты, автоматизация Linux
- **C++** — системное программирование, производительность
- **Rust** — системный код с безопасностью памяти
- **Go** — микросервисы, сетевые утилиты
- **Java** — корпоративные приложения, Android

---

## Пример диалога

```
Пользователь: Напиши парсер CSV-файла который считает сумму столбца "price"

Manager Bot:
CODER_TASK:
Язык: Python
Задача: Написать скрипт для парсинга CSV-файла.
Шаги:
1. Прочитать CSV через модуль csv или pandas
2. Найти столбец "price", преобразовать значения в float
3. Вычислить сумму и вывести результат
4. Обработать возможные ошибки (файл не найден, неверный формат)

Coder Bot:
CODER_RESULT:
Скрипт читает CSV-файл, суммирует столбец "price" и выводит результат.
Использует стандартную библиотеку csv без сторонних зависимостей.

\`\`\`python
import csv
import sys

def sum_price_column(filepath: str) -> float:
    total = 0.0
    with open(filepath, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                total += float(row["price"])
            except (KeyError, ValueError):
                pass
    return total

if __name__ == "__main__":
    path = sys.argv[1] if len(sys.argv) > 1 else "data.csv"
    print(f"Сумма столбца price: {sum_price_column(path):.2f}")
\`\`\`

Запуск: python script.py data.csv

Manager Bot:
MANAGER_FEEDBACK:
Код корректен. Обработка ошибок присутствует. Задача выполнена ✓
```

---

## Деплой на сервер (опционально)

Для постоянной работы используй `systemd` или `supervisor`:

```bash
# /etc/systemd/system/manager-bot.service
[Unit]
Description=Telegram Manager Bot

[Service]
WorkingDirectory=/path/to/telegram-bots
ExecStart=/path/to/.venv/bin/python manager_bot.py
Restart=always
EnvironmentFile=/path/to/telegram-bots/.env

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable manager-bot coder-bot
sudo systemctl start manager-bot coder-bot
```
