#!/usr/bin/env tsx
/**
 * Проверяет синхронизацию ключей между messages/ru.json и messages/ro.json.
 * Завершается с кодом 1 при обнаружении расхождений.
 */
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const messagesDir = join(__dirname, "..", "messages");

type JsonValue = string | number | boolean | null | JsonObject | JsonValue[];
interface JsonObject {
  [key: string]: JsonValue;
}

function loadJson(file: string): JsonObject {
  const raw = readFileSync(join(messagesDir, file), "utf8");
  return JSON.parse(raw) as JsonObject;
}

function collectKeys(obj: JsonObject, prefix = ""): string[] {
  return Object.keys(obj).flatMap((key) => {
    const full = prefix ? `${prefix}.${key}` : key;
    const value = obj[key];
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      return collectKeys(value as JsonObject, full);
    }
    return [full];
  });
}

function diff(a: Set<string>, b: Set<string>): string[] {
  return [...a].filter((k) => !b.has(k)).sort();
}

function main(): void {
  const ru = loadJson("ru.json");
  const ro = loadJson("ro.json");

  const ruKeys = new Set(collectKeys(ru));
  const roKeys = new Set(collectKeys(ro));

  const missingInRo = diff(ruKeys, roKeys);
  const missingInRu = diff(roKeys, ruKeys);

  console.log("=== i18n key sync ===");
  console.log(`ru keys: ${ruKeys.size} | ro keys: ${roKeys.size}`);

  if (missingInRo.length === 0 && missingInRu.length === 0) {
    console.log("✓ Locale keys are synchronized");
    process.exit(0);
  }

  if (missingInRo.length > 0) {
    console.error(`\n❌ Missing in ro.json (${missingInRo.length}):`);
    missingInRo.forEach((k) => console.error(`   - ${k}`));
  }
  if (missingInRu.length > 0) {
    console.error(`\n❌ Missing in ru.json (${missingInRu.length}):`);
    missingInRu.forEach((k) => console.error(`   - ${k}`));
  }

  process.exit(1);
}

main();