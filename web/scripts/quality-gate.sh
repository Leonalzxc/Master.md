#!/usr/bin/env bash
# Validation only: no formatting, commits, pushes or database writes.
set -euo pipefail
cd "$(dirname "$0")/.."
npm run lint
npm run i18n:check
npm run supabase:check
node --test scripts/test-job-publication-hotfix.mjs
npm run build
npm run typecheck
