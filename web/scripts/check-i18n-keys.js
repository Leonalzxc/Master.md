#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Сверка ключей между messages/ru.json и messages/ro.json.
 * Exit 1 при наличии несимметричных ключей.
 */
const fs = require("fs");
const path = require("path");

const messagesDir = path.join(__dirname, "..", "messages");

function load(name) {
  return JSON.parse(fs.readFileSync(path.join(messagesDir, name), "utf8"));
}

function keys(obj, prefix = "") {
  return Object.keys(obj).reduce((acc, k) => {
    const full = prefix ? `${prefix}.${k}` : k;
    if (obj[k] && typeof obj[k] === "object" && !Array.isArray(obj[k])) {
      acc.push(...keys(obj[k], full));
    } else {
      acc.push(full);
    }
    return acc;
  }, []);
}

const ru = load("ru.json");
const ro = load("ro.json");
const ruKeys = new Set(keys(ru));
const roKeys = new Set(keys(ro));

const missingInRo = [...ruKeys].filter((k) => !roKeys.has(k)).sort();
const missingInRu = [...roKeys].filter((k) => !ruKeys.has(k)).sort();

console.log("=== i18n key sync ===");
console.log(`ru: ${ruKeys.size} keys | ro: ${roKeys.size} keys`);

if (missingInRo.length === 0 && missingInRu.length === 0) {
  console.log("✓ i18n keys are synchronized");
  process.exit(0);
}

if (missingInRo.length) {
  console.error(`\n❌ Missing in ro.json (${missingInRo.length}):`);
  missingInRo.forEach((k) => console.error("   - " + k));
}
if (missingInRu.length) {
  console.error(`\n❌ Missing in ru.json (${missingInRu.length}):`);
  missingInRu.forEach((k) => console.error("   - " + k));
}
process.exit(1);