const fs = require("fs");
const path = require("path");

const pkgPath = path.join(process.cwd(), "web", "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

pkg.scripts = pkg.scripts || {};
pkg.scripts["check:i18n"] = "node scripts/check-i18n-keys.js";
pkg.scripts["check-i18n-keys"] = "node scripts/check-i18n-keys.js"; // alias по ТЗ

fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
console.log("✓ updated:");
console.log("  check:i18n        =", pkg.scripts["check:i18n"]);
console.log("  check-i18n-keys   =", pkg.scripts["check-i18n-keys"]);