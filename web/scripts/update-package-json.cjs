/**
 * Утилита для идемпотентного обновления web/package.json scripts.
 * Запуск: node scripts/update-package-json.cjs
 */
const fs = require("fs");
const path = require("path");

const pkgPath = path.join(process.cwd(), "web", "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

const required = {
  lint: pkg.scripts && pkg.scripts.lint ? pkg.scripts.lint : "next lint",
  "lint:fix": "next lint --fix",
  format: 'prettier --write "src/**/*.{ts,tsx,js,jsx,json,css,md}"',
  "format:check": 'prettier --check "src/**/*.{ts,tsx,js,jsx,json,css,md}"',
  typecheck: "tsc --noEmit",
  "check:supabase": "node scripts/check-supabase-client.js",
  "check:i18n": "node scripts/check-i18n-keys.js",
  "check:all":
    "npm run typecheck && npm run lint && npm run format:check && npm run check:supabase && npm run check:i18n",
  prepare: "cd .. && husky web/.husky",
};

pkg.scripts = { ...pkg.scripts };
let changed = false;
for (const [k, v] of Object.entries(required)) {
  if (pkg.scripts[k] !== v) {
    console.log(`${pkg.scripts[k] ? "~ update" : "+ add   "} ${k}`);
    pkg.scripts[k] = v;
    changed = true;
  } else {
    console.log(`  ok     ${k}`);
  }
}

if (changed) {
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log("\n✓ package.json updated");
} else {
  console.log("\n✓ package.json already in sync");
}

console.log("\nFinal scripts section:");
console.log(JSON.stringify(pkg.scripts, null, 2));