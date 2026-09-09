# ASHA dependency hardening plan

This work is intentionally conservative.

1. Audit exact locked dependencies with `npm audit`.
2. Run only a dry-run of the non-breaking npm remediation first.
3. Apply dependency changes on a dedicated branch, never directly to production first.
4. Require `npm ci`, production build, TypeScript, and regression tests before merge.
5. Do not use `npm audit fix --force`.
6. Do not alter application logic, authentication, Supabase schema/data, clinical records, accounting rules, or permissions as part of dependency remediation.
7. Merge only fixes that reduce known vulnerabilities without regressions.
