"""
Coder Bot — полноценный агент-разработчик на базе Claude.
Пишет код, сохраняет файлы, выполняет git/npm/shell команды в проекте.
"""

import logging
import os
import re
import shlex
import subprocess
from pathlib import Path
from dotenv import load_dotenv
import anthropic
from telegram import Update
from telegram.ext import (
    Application,
    ContextTypes,
    MessageHandler,
    filters,
)

load_dotenv()

CODER_BOT_TOKEN   = os.environ["CODER_BOT_TOKEN"]
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
CLAUDE_MODEL      = os.getenv("CLAUDE_MODEL", "claude-sonnet-4-6")
PROJECT_DIR       = Path(os.environ["PROJECT_DIR"])
EXEC_TIMEOUT      = int(os.getenv("EXEC_TIMEOUT", "120"))
GIT_USER_NAME     = os.getenv("GIT_USER_NAME", "Coder Bot")
GIT_USER_EMAIL    = os.getenv("GIT_USER_EMAIL", "coder@bot.local")

logging.basicConfig(
    format="%(asctime)s [CODER] %(levelname)s — %(message)s",
    level=logging.INFO,
)
logger = logging.getLogger(__name__)

claude_client = anthropic.Anthropic(api_key=ANTHROPIC_API_KEY)
conversation_history: list[dict] = []
MAX_HISTORY = 40

# ─── Безопасность: разрешённые префиксы команд ────────────────────────────────
ALLOWED_COMMANDS = {
    "git", "npm", "npx", "node", "tsc",
    "supabase", "mkdir", "cp", "mv", "touch",
    "cat", "ls", "find", "grep", "echo",
    "python", "python3", "pip", "pip3",
}
BLOCKED_PATTERNS = [
    r"rm\s+-rf\s+/",      # rm -rf /
    r"sudo",
    r"chmod\s+777",
    r">\s*/dev/",
    r"curl.*\|\s*sh",     # curl | sh
    r"wget.*\|\s*sh",
]


def is_safe_command(cmd: str) -> tuple[bool, str]:
    cmd_stripped = cmd.strip()
    if not cmd_stripped or cmd_stripped.startswith("#"):
        return True, ""
    for pattern in BLOCKED_PATTERNS:
        if re.search(pattern, cmd_stripped):
            return False, f"Заблокировано по соображениям безопасности: `{cmd_stripped}`"
    try:
        parts = shlex.split(cmd_stripped)
    except ValueError:
        parts = cmd_stripped.split()
    base = parts[0] if parts else ""
    if base not in ALLOWED_COMMANDS:
        return False, f"Команда `{base}` не в списке разрешённых."
    return True, ""


def run_command(cmd: str, cwd: Path = PROJECT_DIR) -> tuple[bool, str]:
    """Выполняет одну shell-команду и возвращает (успех, вывод)."""
    safe, reason = is_safe_command(cmd)
    if not safe:
        return False, reason

    env = os.environ.copy()
    env["GIT_AUTHOR_NAME"]    = GIT_USER_NAME
    env["GIT_AUTHOR_EMAIL"]   = GIT_USER_EMAIL
    env["GIT_COMMITTER_NAME"] = GIT_USER_NAME
    env["GIT_COMMITTER_EMAIL"]= GIT_USER_EMAIL

    try:
        result = subprocess.run(
            cmd,
            shell=True,
            capture_output=True,
            text=True,
            timeout=EXEC_TIMEOUT,
            cwd=cwd,
            env=env,
        )
        output = (result.stdout + result.stderr).strip()
        return result.returncode == 0, output or "(нет вывода)"
    except subprocess.TimeoutExpired:
        return False, f"Таймаут {EXEC_TIMEOUT}с."
    except Exception as e:
        return False, str(e)


def read_file_for_context(rel_path: str) -> str:
    """Читает файл проекта и возвращает содержимое (для контекста Claude)."""
    path = PROJECT_DIR / rel_path.lstrip("/")
    if not path.exists():
        return f"[файл не найден: {rel_path}]"
    try:
        text = path.read_text(encoding="utf-8")
        if len(text) > 8000:
            text = text[:8000] + "\n…(обрезано)"
        return text
    except Exception as e:
        return f"[ошибка чтения: {e}]"


def extract_file_blocks(text: str) -> list[dict]:
    """Блоки вида ### path/to/file.tsx \\n```tsx\\n...\\n```"""
    blocks = []
    for m in re.finditer(r"###\s*([\w.\-/\[\]@]+)\s*\n```(?:\w*)\n(.*?)```", text, re.DOTALL):
        rel = m.group(1).strip()
        if rel.startswith("web/"):
            rel = rel[4:]
        blocks.append({"rel_path": rel, "code": m.group(2).strip()})
    return blocks


def extract_shell_blocks(text: str) -> list[str]:
    """Извлекает команды из блоков ### RUN / ### SHELL / ### КОМАНДЫ.
    Также ловит блоки без заголовка если внутри есть git/npm/npx."""
    lines: list[str] = []

    # Основной вариант: ### RUN (или SHELL, КОМАНДЫ, TERMINAL)
    for m in re.finditer(
        r"###\s*(?:RUN|SHELL|TERMINAL|КОМАНДЫ?|ВЫПОЛНИТЬ?)\s*\n```[^\n]*\n(.*?)```",
        text,
        re.DOTALL | re.IGNORECASE,
    ):
        for line in m.group(1).splitlines():
            line = line.strip()
            if line and not line.startswith("#"):
                lines.append(line)

    # Запасной: любой ```sh / ```bash блок с git или npm внутри
    if not lines:
        for m in re.finditer(r"```(?:sh|bash|shell)\n(.*?)```", text, re.DOTALL):
            block_lines = [l.strip() for l in m.group(1).splitlines() if l.strip() and not l.strip().startswith("#")]
            if any(l.startswith(("git ", "npm ", "npx ", "supabase ")) for l in block_lines):
                lines.extend(block_lines)

    return lines


def save_files(blocks: list[dict]) -> list[Path]:
    saved = []
    for b in blocks:
        fp = PROJECT_DIR / b["rel_path"]
        fp.parent.mkdir(parents=True, exist_ok=True)
        fp.write_text(b["code"], encoding="utf-8")
        logger.info("Записан: %s", fp)
        saved.append(fp)
    return saved


def build_project_context() -> str:
    """Снимок структуры проекта для системного промпта."""
    lines = []
    for root, dirs, files in os.walk(PROJECT_DIR):
        dirs[:] = [d for d in dirs if d not in ("node_modules", ".next", ".git", "dist", ".cache")]
        level = len(Path(root).relative_to(PROJECT_DIR).parts)
        indent = "  " * level
        lines.append(f"{indent}{Path(root).name}/")
        for f in sorted(files):
            lines.append(f"{indent}  {f}")
        if len(lines) > 150:
            lines.append("  ...(обрезано)")
            break
    return "\n".join(lines)


SYSTEM_PROMPT = """Ты — старший fullstack-разработчик и DevOps-агент со ПРЯМЫМ доступом к файловой системе и терминалу.

ВАЖНО: Ты работаешь внутри автоматизированного бота. Всё что ты пишешь в блоках файлов и команд — РЕАЛЬНО ВЫПОЛНЯЕТСЯ на компьютере пользователя. Не говори "я не могу выполнять команды" или "у меня нет доступа" — это неправда. Бот-обёртка сам запустит все команды которые ты укажешь.

## Стек проекта
- Next.js 16 (App Router) · React 19 · TypeScript 5
- Tailwind CSS v4
- Supabase (PostgreSQL + Auth + Storage) — `@supabase/ssr`
- next-intl v4 — локали `ru`, `ro`
- react-hook-form + zod · Leaflet

## Структура web/
- src/app/[locale]/        — страницы (page.tsx, layout.tsx)
- src/app/actions/         — Server Actions
- src/app/api/             — API Routes
- src/components/ui/       — примитивы
- src/components/features/ — бизнес-компоненты
- src/components/layout/   — Header, Footer
- src/lib/supabase/        — client.ts, server.ts, types.ts
- messages/ru.json · ro.json
- supabase/migrations/     — SQL (001_init_schema.sql …)

## Правила кода
- TypeScript строго: нет `any`, правильные типы везде
- Server Components по умолчанию; `"use client"` только при необходимости
- Supabase: `createClient` из `@/lib/supabase/server` на сервере, из `@/lib/supabase/client` на клиенте
- Все пользовательские строки через `useTranslations()` / `getTranslations()`
- При новых строках — добавляй ключи в оба файла messages/
- Импорты через `@/`
- Tailwind v4: только утилиты, никаких inline-стилей

## Git и деплой
- Репозиторий: https://github.com/Leonalzxc/Master.md.git
- Ветки: `feat/name`, `fix/name`, `chore/name`
- Коммиты: `feat: ...`, `fix: ...`, `chore: ...`, `refactor: ...`
- ВСЕГДА после `git commit` делай `git push origin HEAD`
- Если ветка новая: `git push -u origin HEAD`
- Vercel автоматически деплоит при пуше в `main`
- Для деплоя фичи: сначала пуш в ветку, потом менеджер скажет мержить в main

## КАК ОТВЕЧАТЬ — строго соблюдай этот формат:

Начни с `CODER_RESULT:` (или `CODER_QUERY:` если нужна информация).

Краткое пояснение что сделано (2-3 предложения).

**Каждый файл** — отдельный блок (путь относительно web/):
```
### src/components/features/MyComponent.tsx
```tsx
код здесь
```
```

**Команды** (git, npm, npx и т.д.) — блок RUN ПОСЛЕ файлов:
```
### RUN
```sh
git add src/components/features/MyComponent.tsx
git commit -m "feat: add MyComponent"
git push origin HEAD
```
```

Бот прочитает эти блоки и выполнит их автоматически — тебе не нужно объяснять как это работает.
Никогда не пиши "я не могу", "у меня нет доступа", "выполни вручную" — просто пиши блоки.
Не используй префиксы CODER_TASK: или MANAGER_FEEDBACK:."""


def call_claude(messages: list[dict]) -> str:
    return claude_client.messages.create(
        model=CLAUDE_MODEL,
        max_tokens=8096,
        system=SYSTEM_PROMPT,
        messages=messages,
    ).content[0].text.strip()


def update_history(role: str, content: str) -> None:
    conversation_history.append({"role": role, "content": content})
    if len(conversation_history) > MAX_HISTORY:
        conversation_history.pop(0)


async def send_long(update: Update, text: str) -> None:
    for i in range(0, len(text), 4000):
        await update.message.reply_text(text[i:i + 4000])


async def process_and_respond(update: Update, input_text: str) -> None:
    update_history("user", input_text)
    reply = call_claude(list(conversation_history))
    update_history("assistant", reply)

    logger.info("Claude ответил (%d симв.). Первые 200: %s", len(reply), reply[:200])

    if not reply.startswith(("CODER_RESULT:", "CODER_QUERY:")):
        reply = f"CODER_RESULT:\n{reply}"

    if reply.startswith("CODER_QUERY:"):
        await send_long(update, reply)
        logger.info("CODER_QUERY отправлен")
        return

    report = [reply]

    # 1. Записываем файлы
    file_blocks = extract_file_blocks(reply)
    saved = save_files(file_blocks)
    if saved:
        paths = [str(p.relative_to(PROJECT_DIR)) for p in saved]
        report.append("\n\n📁 Файлы записаны:\n" + "\n".join(f"  • {p}" for p in paths))

    # 2. Выполняем shell-команды
    shell_cmds = extract_shell_blocks(reply)
    logger.info("Найдено команд: %d", len(shell_cmds))

    if shell_cmds:
        cmd_results = []
        for cmd in shell_cmds:
            ok, out = run_command(cmd)
            icon = "✅" if ok else "❌"
            cmd_results.append(f"{icon} `{cmd}`\n{out[:600]}")
            logger.info("%s: %s", "OK" if ok else "ERR", cmd)
        report.append("\n\n🔧 Выполнено:\n" + "\n\n".join(cmd_results))
    elif file_blocks:
        # Файлы записаны, но команд не нашли — напомнить Claude в истории
        logger.info("Файлы записаны, команды не обнаружены в ответе.")

    await send_long(update, "".join(report))
    logger.info("CODER_RESULT: файлов=%d команд=%d", len(saved), len(shell_cmds))


async def handle_coder_task(update: Update, _ctx: ContextTypes.DEFAULT_TYPE) -> None:
    logger.info("CODER_TASK: %s", update.message.text[:80])
    await process_and_respond(update, update.message.text)


async def handle_manager_feedback(update: Update, _ctx: ContextTypes.DEFAULT_TYPE) -> None:
    text = update.message.text
    logger.info("MANAGER_FEEDBACK: %s", text[:80])
    done_kw = ["задача выполнена", "всё готово", "работа завершена", "принято", "отлично, всё"]
    if any(kw in text.lower() for kw in done_kw) and "правк" not in text.lower():
        return
    await process_and_respond(update, text)


def main() -> None:
    if not PROJECT_DIR.exists():
        raise SystemExit(f"PROJECT_DIR не найден: {PROJECT_DIR}")
    logger.info("Проект: %s", PROJECT_DIR)

    app = Application.builder().token(CODER_BOT_TOKEN).build()
    app.add_handler(MessageHandler(filters.TEXT & filters.Regex(r"^CODER_TASK:"), handle_coder_task))
    app.add_handler(MessageHandler(filters.TEXT & filters.Regex(r"^MANAGER_FEEDBACK:"), handle_manager_feedback))
    logger.info("Coder Bot запущен.")
    app.run_polling(allowed_updates=Update.ALL_TYPES)


if __name__ == "__main__":
    main()
