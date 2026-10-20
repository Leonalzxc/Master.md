#!/usr/bin/env bash
# Validation only: never format, stage, commit, push, or migrate a database.
set -euo pipefail
cd "$(dirname "$0")/.."

npm run lint
npm run i18n:check
npm run supabase:check
npm test
# Generate route types first so this also works on a fresh checkout.
npm run build
npm run typecheck
