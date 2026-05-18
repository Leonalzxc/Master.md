#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const fs = require("fs");
const path = require("path");

const messagesDir = path.join(__dirname, "..", "messages");
const ru = JSON.parse(fs.readFileSync(path.join(messagesDir, "ru.json"), "utf8"));
const ro = JSON.parse(fs.readFileSync(path.join(messagesDir, "ro.json"), "utf8"));

function collectKeys(obj, prefix = "") {
  return Object.keys(obj).reduce((acc, k) => {
    const full = prefix ? `${prefix}.${k}` : k;
    if (obj[k] && typeof obj[k] === "object" && !Array.isArray(obj[k])) {
      acc.push(...collectKeys(obj[k], full));
    } else {
      acc.push(full);
    }
    return acc;
  }, []);
}

const ruKeys = new Set(collectKeys(ru));
const roKeys = new Set(collectKeys(ro));

const missingInRo = [...ruKeys].filter((k) => !roKeys.has(k));
const missingInRu = [...roKeys].filter((k) => !ruKeys.has(k));

console.log("=== i18n key sync audit ===");
console.log(`ru keys: ${ruKeys.size} | ro keys: ${roKeys.size}\n`);

if (missingInRo.length === 0 && missingInRu.length === 0) {
  console.log("✓ Все ключи синхронизированы");
  process.exit(0);
}

if (missingInRo.length) {
  console.log(`❌ Отсутствуют в ro.json (${missingInRo.length}):`);
  missingInRo.forEach((k) => console.log("   " + k));
}
if (missingInRu.length) {
  console.log(`❌ Отсутствуют в ru.json (${missingInRu.length}):`);
  missingInRu.forEach((k) => console.log("   " + k));
}
process.exit(1);