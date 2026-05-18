#!/usr/bin/env node
/**
 * Validates parity of translation keys between messages/ru.json and messages/ro.json.
 * Recursively walks nested objects and reports missing keys on either side.
 * Exit code 1 if any divergence is found.
 */
const fs = require('fs');
const path = require('path');

function loadJson(rel) {
  const abs = path.resolve(__dirname, '..', rel);
  try {
    return JSON.parse(fs.readFileSync(abs, 'utf8'));
  } catch (err) {
    console.error(`❌ Failed to parse ${rel}:`, err.message);
    process.exit(2);
  }
}

function flattenKeys(obj, prefix = '') {
  const out = [];
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) {
      out.push(...flattenKeys(v, key));
    } else {
      out.push(key);
    }
  }
  return out;
}

const ru = loadJson('messages/ru.json');
const ro = loadJson('messages/ro.json');

const ruKeys = new Set(flattenKeys(ru));
const roKeys = new Set(flattenKeys(ro));

const missingInRo = [...ruKeys].filter((k) => !roKeys.has(k)).sort();
const missingInRu = [...roKeys].filter((k) => !ruKeys.has(k)).sort();

console.log(`📊 ru.json keys: ${ruKeys.size}`);
console.log(`📊 ro.json keys: ${roKeys.size}`);
console.log('');

if (missingInRo.length === 0 && missingInRu.length === 0) {
  console.log('✅ Translation key structure is identical in ru.json and ro.json');
  process.exit(0);
}

if (missingInRo.length) {
  console.error('❌ Missing in messages/ro.json:');
  missingInRo.forEach((k) => console.error(`   - ${k}`));
}
if (missingInRu.length) {
  console.error('❌ Missing in messages/ru.json:');
  missingInRu.forEach((k) => console.error(`   - ${k}`));
}
process.exit(1);