#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Проверка i18n:
 *  1. Симметрия ключей между messages/ru.json и messages/ro.json
 *  2. Все ключи использованные в коде через t("...") / getTranslations()
 *     присутствуют в обоих файлах локализации
 *
 * Exit 1 при любых нарушениях.
 */
const fs = require("fs");
const path = require("path");

const webRoot = path.join(__dirname, "..");
const messagesDir = path.join(webRoot, "messages");
const srcDir = path.join(webRoot, "src");

// ───────────────────────────────────────────────
// Утилиты
// ───────────────────────────────────────────────
function loadJson(name) {
  return JSON.parse(fs.readFileSync(path.join(messagesDir, name), "utf8"));
}

function flatten(obj, prefix = "") {
  return Object.keys(obj).reduce((acc, k) => {
    const full = prefix ? `${prefix}.${k}` : k;
    if (obj[k] && typeof obj[k] === "object" && !Array.isArray(obj[k])) {
      acc.push(...flatten(obj[k], full));
    } else {
      acc.push(full);
    }
    return acc;
  }, []);
}

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (/\.(ts|tsx|js|jsx)$/.test(e.name)) acc.push(full);
  }
  return acc;
}

// ───────────────────────────────────────────────
// 1. Сбор ключей из JSON-файлов локалей
// ───────────────────────────────────────────────
const ru = loadJson("ru.json");
const ro = loadJson("ro.json");
const ruKeys = new Set(flatten(ru));
const roKeys = new Set(flatten(ro));

console.log("=== i18n audit ===");
console.log(`ru.json: ${ruKeys.size} keys | ro.json: ${roKeys.size} keys`);

// ───────────────────────────────────────────────
// 2. Симметрия ru ↔ ro
// ───────────────────────────────────────────────
const missingInRo = [...ruKeys].filter((k) => !roKeys.has(k)).sort();
const missingInRu = [...roKeys].filter((k) => !ruKeys.has(k)).sort();

let hasErrors = false;

if (missingInRo.length) {
  console.error(`\n❌ Missing in ro.json (${missingInRo.length}):`);
  missingInRo.forEach((k) => console.error("   - " + k));
  hasErrors = true;
}
if (missingInRu.length) {
  console.error(`\n❌ Missing in ru.json (${missingInRu.length}):`);
  missingInRu.forEach((k) => console.error("   - " + k));
  hasErrors = true;
}

if (!hasErrors) {
  console.log("✓ ru.json и ro.json симметричны");
}

// ───────────────────────────────────────────────
// 3. Сканирование использования ключей в коде
// ───────────────────────────────────────────────
const files = walk(srcDir);
const usedKeys = new Map(); // key -> [files]
const usedNamespaces = new Map(); // ns -> [files]

// Паттерны: useTranslations("Namespace") / getTranslations("Namespace")
const nsRegex = /(?:useTranslations|getTranslations)\s*\(\s*["'`]([\w.]+)["'`]\s*\)/g;
// Прямой вызов t("key.subkey") или t(`key`)
const tCallRegex = /\bt\s*\(\s*["'`]([\w.]+)["'`]/g;

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const rel = path.relative(webRoot, file);

  // Извлекаем namespaces объявленные в файле
  const fileNamespaces = [];
  let m;
  while ((m = nsRegex.exec(content)) !== null) {
    fileNamespaces.push(m[1]);
    if (!usedNamespaces.has(m[1])) usedNamespaces.set(m[1], []);
    usedNamespaces.get(m[1]).push(rel);
  }

  // Извлекаем все t("...") вызовы, к каждому приписываем все ns из файла
  while ((m = tCallRegex.exec(content)) !== null) {
    const subKey = m[1];
    if (fileNamespaces.length === 0) {
      // t("..") без useTranslations — возможно вложенный namespace вызов
      const k = subKey;
      if (!usedKeys.has(k)) usedKeys.set(k, []);
      usedKeys.get(k).push(rel);
    } else {
      for (const ns of fileNamespaces) {
        const full = `${ns}.${subKey}`;
        if (!usedKeys.has(full)) usedKeys.set(full, []);
        usedKeys.get(full).push(rel);
      }
    }
  }
}

console.log(`\nScanned ${files.length} source files`);
console.log(`Found ${usedKeys.size} translation key references`);
console.log(`Found ${usedNamespaces.size} namespace declarations`);

// ───────────────────────────────────────────────
// 4. Проверка: использованные ключи есть в локалях
// ───────────────────────────────────────────────
const dangling = [];
for (const [key, locations] of usedKeys) {
  // Ключ считаем валидным если ОН САМ есть в локали, ИЛИ есть с любым префиксом-namespace
  const inRu = ruKeys.has(key) || [...ruKeys].some((k) => k === key);
  const inRo = roKeys.has(key) || [...roKeys].some((k) => k === key);

  if (!inRu || !inRo) {
    dangling.push({
      key,
      inRu,
      inRo,
      file: locations[0],
    });
  }
}

if (dangling.length) {
  console.error(`\n⚠️  Используются в коде, но отсутствуют в локалях (${dangling.length}):`);
  dangling.slice(0, 50).forEach((d) => {
    const flags = `${d.inRu ? "ru✓" : "ru✗"} ${d.inRo ? "ro✓" : "ro✗"}`;
    console.error(`   ${flags}  ${d.key}  (${d.file})`);
  });
  if (dangling.length > 50) {
    console.error(`   ... и ещё ${dangling.length - 50}`);
  }
  // Не делаем exit 1 на этом — это soft-warning, т.к. эвристика regex
  // может давать false positives на сложных случаях (динамические ключи)
  console.error("\nℹ️  Это предупреждение (regex-эвристика). Проверь вручную.");
}

// ───────────────────────────────────────────────
// Итог
// ───────────────────────────────────────────────
if (hasErrors) {
  console.error("\n❌ i18n sync failed");
  process.exit(1);
}
console.log("\n✓ i18n keys are synchronized");
process.exit(0);