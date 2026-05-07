# Design System — Component Spec (MASTER Moldova)

> Токены определены в `tokens.mvp.json` + `tokens.mvp.css`.  
> Стек: Tailwind CSS + CSS vars. Все компоненты доступны в Figma через Tokens Studio.

---

## Принципы

1. **Mobile-first** — 360px → 768px → 1120px
2. **Touch targets ≥ 44px** (задан в `grid.touchTargetMin`)
3. **RU/RO** — все строки через i18n, не хардкодить
4. **8pt grid** — отступы кратны 4px (`space-1..space-8`)
5. **WCAG AA** — контраст ≥ 4.5:1 для основного текста

---

## 1. Tokens (сводка)

| Токен | Значение | CSS var |
|-------|----------|---------|
| `color.accent.default` | `#0ea5e9` | `--accent` |
| `color.text.primary` | `#0f172a` | `--text` |
| `color.bg.page` | `#eef2f7` | `--bg-deep` |
| `color.bg.elevated` | `#ffffff` | `--bg-elevated` |
| `color.success.default` | `#16a34a` | `--success` |
| `color.danger` | `#e11d48` | `--danger` |
| `font.family.sans` | DM Sans | `--font-sans` |
| `font.family.display` | Outfit | `--font-display` |
| `radius.md` | 14px | `--radius-md` |
| `shadow.md` | 0 4px 16px rgba(15,23,42,.08) | — |

---

## 2. Button

### Варианты

| Variant | Использование | BG | Border |
|---------|-------------|-----|--------|
| `primary` | Основное CTA | `--accent` | — |
| `secondary` | Вторичное действие | transparent | `--glass-border-strong` |
| `danger` | Блокировка, удаление | `--danger` | — |
| `ghost` | Nav, inline | transparent | — |

### Размеры

| Size | Height | Padding X | Font |
|------|--------|-----------|------|
| `sm` | 36px | 12px | 14px |
| `md` | 44px | 20px | 15px |
| `lg` | 52px | 28px | 17px |

### States
- `hover`: яркость +5%
- `active`: scale 0.98, duration `fast` (150ms)
- `disabled`: opacity 0.45, cursor not-allowed
- `loading`: spinner icon, текст скрыт (aria-label сохраняется)

---

## 3. Input / Textarea

```
Height: 44px (input), auto (textarea min 80px)
Border: 1.5px solid --glass-border-strong
Border-radius: --radius-sm (10px)
Focus: border --accent, box-shadow 0 0 0 3px --accent-dim
Error: border --danger, helper text color --danger
Padding: 12px 16px
```

### PhoneInput
- Маска: `+373 XX XXX XXX`
- Автоматически добавляет `+373` если вводят с `0` или цифры
- Флаг Молдовы перед полем

### OTPInput
- 6 ячеек по 48px
- Автоматический переход на следующую ячейку
- Поддержка вставки (paste) всего кода сразу

---

## 4. JobCard

```
Layout: card (bg --bg-elevated, radius --radius-lg, shadow shadow-sm)
Content:
  - Category badge (top-left)
  - Urgency chip (top-right, если urgency=true)
  - Description (2 строки, clamp)
  - Meta row: city · area · дата
  - Budget (если указан)
  - Bid count badge
  - CTA: "Откликнуться" (primary sm)
```

**Состояния:**
- `active` — по умолчанию
- `in_progress` — badge "В работе", CTA скрыт
- `expired` — opacity 0.6, badge "Истёк срок"

---

## 5. WorkerCard

```
Layout: card с аватаром слева
  - Аватар 56×56 (круг, --radius-full)
  - Имя + verified badge (если verified=true)
  - Категории: chips row
  - Город/районы
  - Рейтинг: stars + (N отзывов)
  - PRO badge (если is_pro=true)
  - Кнопка "Смотреть профиль"
```

---

## 6. BidRow (в таблице откликов)

```
Columns: аватар | имя + rating | цена | дата | комментарий | действие
Mobile: карточка вместо строки
CTA для заказчика: "Выбрать" (primary sm) пока статус=sent
После выбора: badge "Выбран" + раскрытие контактов
```

---

## 7. StepWizard (форма заявки)

```
Header: ProgressBar (4 шага, accent)
Шаги: Category → Description → Location+Time → Contact+OTP
Навигация: "Назад" (secondary) + "Далее" / "Опубликовать" (primary)
Кнопки фиксированы внизу на мобильном (sticky bottom bar)
Переходы: slide-left/right (320ms, easing out)
```

### Step indicators
```
● ── ○ ── ○ ── ○   (accent = пройдено/текущий, muted = будущий)
```

---

## 8. Badge / Chip

| Variant | BG | Text | Используется |
|---------|-----|------|-------------|
| `category` | `--accent-dim` | `--accent` | Категория услуги |
| `pro` | `#fef3c7` | `#92400e` | PRO мастер |
| `verified` | `--success-deep` (5% opacity) | `--success` | Проверен |
| `urgency` | `rgba(217,119,6,.12)` | `--warning` | Срочно |
| `status-active` | `--success` (10% opacity) | `--success` | Статус |
| `status-blocked` | danger bg | danger | Заблокирован |

---

## 9. RatingStars

```
5 звёзд SVG
Заполненные: --warning (#d97706)
Пустые: --glass-border-strong
Размер: 16px (display), 20px (profile)
Interactive (для отзыва): hover анимация, tap/click выбор
```

---

## 10. Toast / Notification

```
Position: top-right (desktop), bottom-center (mobile)
z-index: --z-toast (90)
Variants: success (--success border), error (--danger border), info (--accent border)
Duration: 4000ms auto-close
Animation: slide-in + fade-out (fast 150ms)
```

---

## 11. Modal / Drawer

```
Desktop: Modal по центру, max-width 560px, --radius-xl, backdrop --scrim
Mobile: Bottom sheet Drawer, radius top-left/right --radius-xl
z-index: --z-modal (80) / --z-drawer (70)
Close: ESC, backdrop click, X button
Focus trap обязателен (a11y)
```

---

## 12. CategoryGrid (главная)

```
Grid: 2 cols mobile, 3 cols tablet, 4 cols desktop
Иконка (SVG 32px) + название категории
Hover: bg --accent-dim, border --accent
Active state при выборе категории в форме
```

### Список категорий MVP

| Slug | RU | RO | Иконка |
|------|----|----|-------|
| `electric` | Электрика | Electrică | ⚡ |
| `plumbing` | Сантехника | Sanitară | 🔧 |
| `finishing` | Отделка | Finisaje | 🏠 |
| `roofing` | Кровля | Acoperiș | 🏚 |
| `tiling` | Плитка | Placare | 🟫 |
| `minor-repairs` | Мелкий ремонт | Reparații mici | 🔨 |
| `furniture` | Мебель/сборка | Mobilă | 🪑 |
| `painting` | Покраска | Vopsire | 🖌 |

---

## 13. Language Switcher

```
Компонент в Header: [RU] | [RO]
Текущий язык: accent color, font-weight semibold
При переключении: сохранить текущий path, заменить locale сегмент
```

---

## 14. EmptyState

```
Иконка (SVG 64px, muted)
Заголовок (title)
Подзаголовок (text-secondary)
CTA button (primary)

Примеры:
- Нет заявок → "Создайте первую заявку"
- Нет откликов → "Ждём откликов от мастеров"
- Нет мастеров по фильтру → "Попробуйте другие параметры"
```

---

## 15. Responsive Breakpoints

```
xs:  360px   (mobile min)
sm:  480px
md:  768px   (tablet)
lg: 1024px
xl: 1120px   (--content-max, desktop cap)
```

---

## Figma — Tokens Studio Import

Импортировать `tokens.mvp.json` через плагин **Tokens Studio for Figma**:
1. Plugin → Import → JSON
2. Выбрать файл `design-system/tokens.mvp.json`
3. Apply to: Global tokens → Styles
4. Создать компоненты по спецификации выше, привязать к токенам
