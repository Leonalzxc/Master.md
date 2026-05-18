#!/usr/bin/env node
/**
 * Validates parity of translation keys between messages/ru.json and messages/ro.json.
 * - Resolves paths relative to this script's location (CWD-independent).
 * - Walks up parent directories to locate the `messages/` folder.
 * - Recursively flattens nested objects and reports any divergence.
 * - Exits with code 1 on divergence, 2 on I/O or parse error.
 */
const fs = require('fs');
const path = require('path');

function findMessagesDir(startDir) {
  let dir = startDir;
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, 'messages');
    if (
      fs.existsSync(candidate) &&
      fs.statSync(candidate).isDirectory() &&
      fs.existsSync(path.join(candidate, 'ru.json')) &&
      fs.existsSync(path.join(candidate, 'ro.json'))
    ) {
      return candidate;
    }
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function loadJson(absPath) {
  try {
    return JSON.parse(fs.readFileSync(absPath, 'utf8'));
  } catch (err) {
    console.error(`❌ Failed to read/parse ${absPath}: ${err.message}`);
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

// Resolve `messages/` relative to this script (script lives in <web>/scripts/).
const scriptDir = __dirname;
const messagesDir =
  findMessagesDir(path.resolve(scriptDir, '..')) ||
  findMessagesDir(process.cwd());

if (!messagesDir) {
  console.error(
    '❌ messages/ directory with ru.json and ro.json not found.\n' +
      `   script dir : ${scriptDir}\n` +
      `   cwd        : ${process.cwd()}`
  );
  process.exit(2);
}

const ruPath = path.join(messagesDir, 'ru.json');
const roPath = path.join(messagesDir, 'ro.json');

console.log(`📁 Using messages dir: ${path.relative(process.cwd(), messagesDir) || messagesDir}`);

const ru = loadJson(ruPath);
const ro = loadJson(roPath);

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