#!/usr/bin/env node
/* eslint-disable @typescript-eslint/no-require-imports */
const { execSync } = require("child_process");

console.log("=== Supabase client/server boundary audit ===\n");

let hasViolations = false;

// 1. Server-компоненты (без "use client") не должны импортировать lib/supabase/client
try {
  const serverFiles = execSync(
    `grep -rL '"use client"' src/ --include="*.tsx" --include="*.ts"`,
    { encoding: "utf8" }
  )
    .split("\n")
    .filter(Boolean);

  const bad = [];
  for (const f of serverFiles) {
    try {
      const content = require("fs").readFileSync(f, "utf8");
      if (/from\s+["']@\/lib\/supabase\/client["']/.test(content)) {
        bad.push(f);
      }
    } catch {
      /* ignore */
    }
  }

  if (bad.length) {
    hasViolations = true;
    console.log("❌ Server-компоненты используют supabase/client:");
    bad.forEach((f) => console.log("   " + f));
  } else {
    console.log("✓ Server-компоненты: чисто");
  }
} catch {
  console.log("✓ Server-компоненты: чисто (нет совпадений)");
}

// 2. Client-компоненты ("use client") не должны импортировать lib/supabase/server
try {
  const clientFiles = execSync(
    `grep -rl '"use client"' src/ --include="*.tsx" --include="*.ts"`,
    { encoding: "utf8" }
  )
    .split("\n")
    .filter(Boolean);

  const bad = [];
  for (const f of clientFiles) {
    const content = require("fs").readFileSync(f, "utf8");
    if (/from\s+["']@\/lib\/supabase\/server["']/.test(content)) {
      bad.push(f);
    }
  }

  if (bad.length) {
    hasViolations = true;
    console.log("❌ Client-компоненты используют supabase/server:");
    bad.forEach((f) => console.log("   " + f));
  } else {
    console.log("✓ Client-компоненты: чисто");
  }
} catch {
  console.log("✓ Client-компоненты: чисто (нет совпадений)");
}

console.log("");
process.exit(hasViolations ? 1 : 0);