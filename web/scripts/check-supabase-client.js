#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
/**
 * Аудит границ Supabase client/server:
 *  - server-компоненты (без "use client") НЕ должны импортировать @/lib/supabase/client
 *  - client-компоненты ("use client") НЕ должны импортировать @/lib/supabase/server
 * Exit 1 при нарушении.
 */
const fs = require("fs");
const path = require("path");

const SRC = path.join(__dirname, "..", "src");
const exts = new Set([".ts", ".tsx"]);

function walk(dir, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, acc);
    else if (exts.has(path.extname(entry.name))) acc.push(full);
  }
  return acc;
}

const files = walk(SRC);
const violations = [];

for (const file of files) {
  const content = fs.readFileSync(file, "utf8");
  const isClient = /^\s*["']use client["']/m.test(content);
  const importsServer = /from\s+["']@\/lib\/supabase\/server["']/.test(content);
  const importsClient = /from\s+["']@\/lib\/supabase\/client["']/.test(content);

  const rel = path.relative(path.join(__dirname, ".."), file);

  if (isClient && importsServer) {
    violations.push(`❌ ${rel}: client-компонент импортирует @/lib/supabase/server`);
  }
  if (!isClient && importsClient) {
    violations.push(`❌ ${rel}: server-компонент импортирует @/lib/supabase/client`);
  }
}

console.log("=== Supabase client/server boundary audit ===");
console.log(`Scanned ${files.length} files`);

if (violations.length === 0) {
  console.log("✓ Supabase client boundaries are correct");
  process.exit(0);
}

violations.forEach((v) => console.error(v));
console.error(`\n${violations.length} violation(s) found`);
process.exit(1);