# Publication hotfix, 20 October 2026

Baseline: production SHA d9402674546cc0d6196e125feb6f5574e70d390e,
deployment dpl_CSeFo1Pg7SE3w63Fsc9L7L2N2q1p.

Runtime logs show HTTP 500 on /ru/request/new, digest 3541431670:
`Could not find the 'title' column of 'jobs' in the schema cache`.
The action writes title although the existing jobs SQL schema has no such column.
A read-only select=title&limit=0 probe confirmed HTTP 400 / PostgreSQL 42703.

This code-only hotfix removes that field. Expected validation/auth/database errors
return a result instead of a production-redacted Server Components exception.
The wizard preserves the draft, prevents immediate double submissions, handles
login in a new tab and navigates on success. An uncertain network result asks the
user to check existing jobs first: database idempotency is part of separate PR #36.

Next.js and its ESLint config are pinned to 16.4.2. Compatible dependency updates
reduce runtime npm audit from 1 critical, 5 high, 1 moderate to zero known advisories.
ESLint uses the supported flat preset. Existing type errors were corrected;
invalid pagination values fall back to page 1 and timestamp rendering is stable.
The quality script validates only, without auto-formatting, committing or pushing.

Validation: five regressions exercising the actual action/wizard, all-project lint,
locale-key check, client/server boundary check, production build, typecheck and
runtime audit passed. No production job or external notification was created by
these checks. SQL migrations are NOT required for this hotfix.

This is not the full pilot launch. Production still lacks the unpublished privacy
restrictions; the prepared free-pilot frontend and nine SQL migrations must roll
out together after backup/restore and staging checks. Do not deploy PR #36 alone.
Do not add a title column merely to accommodate the faulty legacy INSERT.
