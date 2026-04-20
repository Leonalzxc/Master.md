# MASTER — дизайн‑система MVP (Figma + CSS)

Совместимость с текущими переменными: `assets/styles.css` (`:root`). Расширение: `design-system/tokens.mvp.css` + `design-system/tokens.mvp.json`.

**Принципы:** 8pt grid (половинный шаг 4px), минимальная зона касания **44×44px**, RU/RO — переносы и переполнение, явные error/empty/focus состояния.

---

## 1. Figma — структура файлов и библиотек

| Страница (Page) | Назначение |
|-----------------|------------|
| `00 Foundations` | Цвета, типографика, spacing, radius, elevation, motion, z-index, иконки 24px grid |
| `01 Tokens` | Variables / Token Studio: синхрон с `tokens.mvp.json` |
| `02 Components` | Опубликованная **Component Library** (все UI-компоненты ниже) |
| `03 Patterns` | Карточки списков, формы заявки, таблица ставок (композиции) |
| `04 Templates` | Экраны MVP: главная, заявка, заказ, чат |
| `05 Archive` | Deprecated |

**Библиотеки для включения в проекты продуктов:**

1. **MASTER — Core** (Variables: Color, Space, Radius, Type).  
2. **MASTER — Components** (все варианты из раздела 2).  
3. (Опционально) **MASTER — Icons** — Lucide / кастом 24px.

**Именование в Figma:** `Category / Name / Variant`  
Пример: `Button / Primary / MD`, `Input / Text / Error`.

---

## 2. Figma — спецификация компонентов

Общие **boolean props** где уместно: `Disabled`, `Loading` (только кнопки), `Inverse` (тёмный фон — редко для MVP).

Общие **instance swap**: `Leading icon`, `Trailing icon` (optional).

### Button

| Имя компонента | `Button` |
|----------------|----------|
| **Variants** | `variant`: Primary · Secondary · Ghost · Danger · Link (text) |
| | `size`: SM · MD · LG (высота визуально 36 / 44 / 48; SM только desktop, иначе min 44) |
| | `width`: Hug · Fill |
| | `icon`: None · Leading · Trailing · Icon only |
| **States** (отдельные варианты или interactive component) | Default, Hover, Pressed, Focus, Disabled, Loading (Primary) |
| **Props** | `label` (text), `showIcon`, `loading` |

**Размеры (8pt):** padding X: 16 / 20 / 24; min-height: **44** для MD/LG на touch; SM: 36 только при `min-width: desktop`.

---

### Input (text, email, tel, number)

| Имя | `Input / Text` |
|-----|------------------|
| **Variants** | `state`: Default · Hover · Focus · Filled · Disabled · Error · Read only |
| | `size`: MD (44) · LG (48) |
| **Props** | `label`, `hint`, `errorText`, `required`, `optional`, `prefix`, `suffix` (slot) |
| **Слои** | Label (caption) → Field (border) → Hint или Error text (caption, danger color) |

---

### Select

| Имя | `Select` |
|-----|----------|
| **Variants** | как Input + `state`: Open (chevron rotated) |
| **Props** | `placeholder`, `value`, same as Input |
| **Слот** | Dropdown panel = отдельный компонент `Select / Menu` (max-height ~320, scroll) |

---

### Textarea

| Имя | `Textarea` |
|-----|------------|
| **Variants** | `state`: как Input; `resize`: None (CSS) · Vertical (token) |
| **Props** | `rows` (3 / 5 / 8), `maxLength`, `counter` boolean |
| **Min-height** | кратно 8pt (например 88px = 11×8) |

---

### Checkbox (+ optional Radio как отдельный компонент)

| Имя | `Checkbox` |
|-----|------------|
| **Variants** | `state`: Unchecked · Checked · Indeterminate · Disabled · Error (border danger) |
| **Layout** | Hit area **44×44**, визуальный квадрат 20px по центру ячейки |
| **Props** | `label` (multiline), `description` (optional caption) |

---

### Chip

| Имя | `Chip` |
|-----|--------|
| **Variants** | `style`: Filled · Outline · Soft; `tone`: Neutral · Accent · Success · Danger |
| | `state`: Default · Hover · Active (selected) · Disabled |
| **Props** | `label`, `onRemove` (shows ×), `leadingIcon` |
| **Min-height** | 32 desktop / **44** touch target при tappable |

---

### Stepper (wizard / steps)

| Имя | `Stepper` |
|-----|-----------|
| **Variants** | `orientation`: Horizontal · Vertical |
| | `step`: Complete · Current · Upcoming · Error |
| **Props** | `totalSteps`, `currentIndex` (для документации в макете) |
| **Анатомия** | Connector line, circle (icon or number), label + optional caption (clamp 2 lines) |

---

### Card

| Имя | `Card` |
|-----|--------|
| **Variants** | `elevation`: Flat (border) · Raised (shadow-md); `padding`: 16 · 24 |
| | `interactive`: false · true (hover + focus ring на всей карте) |
| **Props** | Slots: `header`, `body`, `footer` |

---

### List item

| Имя | `List Item` |
|-----|-------------|
| **Variants** | `density`: Comfortable (min 56) · Compact (48 desktop only) |
| | `state`: Default · Hover · Pressed · Selected · Disabled |
| **Slots** | `leading` (avatar/icon), `title`, `subtitle`, `meta`, `trailing` (chevron/actions) |
| **RU/RO** | Title: `line-clamp` 2, `overflow-wrap: anywhere` |

---

### Tabs

| Имя | `Tabs` |
|-----|--------|
| **Variants** | `style`: Underline · Pill |
| **Tab item** | `state`: Default · Hover · Active · Disabled · Focus |
| **Props** | `equalWidth` boolean, `scrollable` boolean (overflow-x на мобиле) |
| **A11y** | Роль tablist / tab; панели — отдельный фрейм `Tab panel` |

---

### Badge — Verified

| Имя | `Badge` |
|-----|---------|
| **Variants** | `type`: Verified · Pro · New · Count · Dot |
| | `tone`: Accent · Success · Neutral · Warning · Danger |
| **Verified** | Иконка галочки + label «Проверен» / «Verificat» (i18n в продукте) |

---

### Toast / Alert

| Имя | `Toast` (fixed), `Alert` (inline) |
|-----|-------------------------------------|
| **Variants** | `tone`: Info · Success · Warning · Danger |
| | `layout`: Title only · Title + body · With actions (2 links max) |
| **States** | Visible, Dismissing (optional animation token) |
| **Props** | `persistent` (Alert), `duration` (Toast), `onClose` |

---

### Modal / Bottom sheet

| Имя | `Modal / Dialog`, `Modal / Bottom Sheet` |
|-----|------------------------------------------|
| **Variants** | `size`: SM · MD · LG · Full (mobile modal) |
| **Bottom sheet** | `snap`: Half · Full; handle visible |
| **Слои** | Scrim, surface, header (title + close), body (scroll), footer (actions) |
| **Props** | `dangerAction` (красная вторичная деструктивная кнопка) |

---

### Table — Bids (ставки)

| Имя | `Table / Bids` |
|-----|----------------|
| **Variants** | `striped`: on/off; `stickyHeader`: on |
| **Columns** | Мастер · Рейтинг · Сумма · Срок · Статус · Действия |
| **States** | Row hover, row selected, empty (illustration + CTA), loading (skeleton rows) |
| **RU/RO** | Числа и валюта — `tabular-nums`; длинные имена — clamp + tooltip pattern |

---

### Skeleton

| Имя | `Skeleton` |
|-----|------------|
| **Variants** | `shape`: Text line · Circle · Rect; `width`: 25/50/75/100% |
| **Animation** | Shimmer (prefers-reduced-motion: static) |

---

### Pagination

| Имя | `Pagination` |
|-----|----------------|
| **Variants** | `size`: MD (44 touch) |
| **Элементы** | Prev, Next, Page number, Ellipsis, «Стр. N из M» (caption) |
| **States** | Default, Active, Disabled (prev/next) |

---

## 3. Токены — файлы

| Файл | Описание |
|------|----------|
| `design-system/tokens.mvp.css` | Семантические алиасы + grid/touch/z-index/form + утилиты `.ds-text-clamp-*`, `.ds-min-touch` |
| `design-system/tokens.mvp.json` | Значения для Figma Token Studio / ручной импорт; поле `$css` — ссылка на переменную из `styles.css` |

**Подключение CSS:** после основного файла:

```html
<link rel="stylesheet" href="./assets/styles.css" />
<link rel="stylesheet" href="./design-system/tokens.mvp.css" />
```

---

## 4. Сетка 8pt и RU/RO

| Token (styles.css) | px | Примечание |
|--------------------|-----|------------|
| `--space-1` | 4 | половинный шаг |
| `--space-2` | 8 | **1u** |
| `--space-3` | 12 | между 8 и 16 |
| `--space-4` | 16 | **2u** |
| `--space-5` | 24 | **3u** |
| `--space-6` | 32 | **4u** |
| `--space-8` | 48 | **6u** |

**Переполнение текста (RU/RO):**

- Заголовки карточек: max 2 строки (`-webkit-line-clamp: 2`) + `overflow-wrap: anywhere` для длинных токенов без пробелов.  
- Кнопки: `white-space: nowrap` только если текст короткий; иначе — две строки max или сокращение с `title` tooltip.  
- Таблицы: не фиксировать ширину колонки «Имя» слишком узко; минимум **160px** на мобиле для колонки мастера.  
- Чипы: `max-width` + ellipsis или перенос на вторую строку с cap height.

**Минимальный touch:** интерактивные элементы — `min-height: var(--touch-target-min)` (44px); визуально меньше — увеличить `padding` или обёртку `.ds-min-touch`.

---

## 5. Accessibility — по компонентам

| Компонент | Заметки |
|-----------|---------|
| **Button** | Нативный `<button>`; `aria-busy` при loading; icon-only — `aria-label`; контраст текста к фону ≥ 4.5:1 (Primary/Danger). |
| **Input** | Связка `<label for>` + `id`; ошибки — `aria-invalid="true"` + `aria-describedby` на текст ошибки; не полагаться только на цвет. |
| **Select** | Клавиатура: Arrow, Enter, Escape; для кастомного — `role="combobox"` + `aria-expanded` + listbox. |
| **Textarea** | Тот же паттерн describedby; счётчик символов — в `aria-live="polite"` при приближении к лимиту (опционально). |
| **Checkbox** | `role="checkbox"` или нативный input; группа — `fieldset` + `legend`. |
| **Chip** | Если кликабелен — `role="button"` или `<button>`; removable — `aria-label` на ×. |
| **Stepper** | `aria-current="step"` на текущем шаге; не использовать только цвет для статуса ошибки — иконка + текст. |
| **Card** | Если вся карта — ссылка, один фокус; вложенные кнопки — не дублировать tab без нужды. |
| **List item** | Различать навигацию и действия; для swipe — альтернатива без жеста. |
| **Tabs** | Roving `tabindex` на табах; панели `role="tabpanel"` + `aria-labelledby`. |
| **Badge** | Декоративный — `aria-hidden="true"` если дублирует текст рядом; иначе — в потоке текста. |
| **Toast** | `role="status"` (info/success) или `role="alert"` (danger/critical); фокус не ловит toast при появлении, если не modal. |
| **Alert** | `role="alert"` для критичных; dismiss — видимая кнопка с label. |
| **Modal** | Focus trap; возврат фокуса на триггер; `aria-modal="true"`; Escape закрывает; scrim клик — по продуктовым правилам (осторожно с WCAG). |
| **Bottom sheet** | Фокус внутри листа; первый фокусируемый элемент или заголовок с `tabindex="-1"` при открытии. |
| **Table** | `<th scope="col">`; caption или `aria-label` на таблице; сортировка — `aria-sort`. |
| **Skeleton** | `aria-busy="true"` на контейнере до загрузки; не skeleton вместо label формы. |
| **Pagination** | `nav` + `aria-label`; текущая страница — `aria-current="page"`. |

**Focus ring:** в коде использовать `box-shadow: var(--focus-ring)` из `styles.css` или `var(--ds-focus-ring)` из `tokens.mvp.css` для новых слоёв; `:focus-visible` только (не `:focus` для мыши где мешает).

**Reduced motion:** анимации skeleton/toast ≤ `prefers-reduced-motion: reduce` — отключить или упростить.

---

## 6. Error и Empty states (паттерн)

**Error (форма):** border `--input-border-error` / `var(--danger)`; фон поля слегка `--color-danger-bg`; иконка + текст ошибки под полем (14px, `--text-secondary` для вторичного или danger для критичного).

**Empty (списки, таблица):** иллюстрация 120–160px; заголовок + короткое описание; primary CTA + опционально secondary; отступы кратные `--space-5` / `--space-6`.

---

## 7. Чеклист синхронизации Figma ↔ CSS

1. Variables в Figma = ключи из `tokens.mvp.json` (имена согласовать 1:1).  
2. Компоненты используют только variables, без raw hex в инстансах.  
3. Автолейаут: gap из шкалы spacing (8/16/24…).  
4. Текстовые стили: Caption / Body / Body Strong / Title / H1 с привязкой к шрифтам DM Sans / Outfit.  
5. Релиз библиотеки: semver + changelog (добавление variant = minor).

---

*Документ и токены созданы для MVP MASTER; при изменении `assets/styles.css` обновляйте `$value` в JSON при необходимости синхронизации с Figma.*
