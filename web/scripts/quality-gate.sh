#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."

echo "═══════════════════════════════════════"
echo " 1/7  i18n key sync"
echo "═══════════════════════════════════════"
npx tsx scripts/i18n-sync-check.ts

echo ""
echo "═══════════════════════════════════════"
echo " 2/7  TYPECHECK"
echo "═══════════════════════════════════════"
npm run typecheck

echo ""
echo "═══════════════════════════════════════"
echo " 3/7  Prettier (auto-fix)"
echo "═══════════════════════════════════════"
npm run format

echo ""
echo "═══════════════════════════════════════"
echo " 4/7  ESLint --fix"
echo "═══════════════════════════════════════"
npm run lint:fix || npm run lint

echo ""
echo "═══════════════════════════════════════"
echo " 5/7  ANY usage audit"
echo "═══════════════════════════════════════"
if grep -rn --include="*.ts" --include="*.tsx" -E "(: any\b|<any>|as any\b|Array<any>|any\[\])" src/ ; then
  echo "❌ Found any usage — fix types manually"
  exit 1
else
  echo "✓ no any usage"
fi

echo ""
echo "═══════════════════════════════════════"
echo " 6/7  Inline styles audit"
echo "═══════════════════════════════════════"
if grep -rn --include="*.tsx" --include="*.jsx" "style={{" src/ ; then
  echo "⚠️  Inline styles found (acceptable only for dynamic transforms / CSS vars)"
else
  echo "✓ no inline styles"
fi

echo ""
echo "═══════════════════════════════════════"
echo " 7/7  Supabase client/server boundary"
echo "═══════════════════════════════════════"
node scripts/check-supabase-client.js

echo ""
echo "═══════════════════════════════════════"
echo " ✅ ALL CHECKS PASSED"
echo "═══════════════════════════════════════"

# Авто-коммит изменений от prettier/eslint, если они есть
cd ..
if [ -n "$(git status --porcelain)" ]; then
  echo ""
  echo "📝 Auto-fixes detected — committing..."
  git add -A
  git commit -m "chore: quality gate script and auto-fixes from prettier/eslint"
  CURRENT_BRANCH=$(git branch --show-current)
  echo "🚀 Pushing to origin/$CURRENT_BRANCH..."
  git push origin "$CURRENT_BRANCH"
  echo "✓ Pushed"
else
  echo ""
  echo "✓ No changes to commit"
fi