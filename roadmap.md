# Roadmap — Central permission engine

- [x] Consolidate operation resolution and batch identity checks in the central authorization engine, preserving existing guards.
- [x] Add independent Import grants and enforce Import plus actual writes on both insert-only import paths; their buttons reuse the server registry.
- [x] Verify regression coverage, authenticated-function registry completeness and signed-out phone/desktop protection.
- [ ] Verify saved role changes, assignments and imports while signed in — blocked: the externally configured sign-in has no available session in this sandbox; existing .env and backend connection are unchanged.

# Roadmap — Import schdata archive modules

- [x] Inspect archive modules for compliance with project rules (currency, CSV, print, config domains, branding, RLS/grants)
- [x] Copy missing lib/component/test files for the 12 new modules
- [x] Register new modules in the portal module registry
- [x] Build database: apply new tables via Lovable migration tool (GRANTs + RLS, no seed-on-load)
- [x] Run tests + typecheck, fix errors in parallel (198/198 tests, 0 type errors)
- [x] Verify build OK and portal renders new modules (landing page verified in browser)

# Roadmap — Unified school governance

- [ ] Audit module dependencies, central settings, authorization and live database policies; record baseline.
- [ ] Centralize configuration and authorization gaps with dependency-aware changes.
- [ ] Enforce tenant-safe configuration and connected record contracts through migrations where necessary.
- [ ] Add regression coverage and run applicable tests and browser workflows.
- [ ] Document evidence, migration status and remaining limitations.

# Roadmap — Distinct module operations

- [x] Enforce separate View, Add, Edit, Delete and Export grants, including saved role updates and assignments.
- [x] Check record identity for mixed saves and enforce export permissions across module downloads.
- [x] Add regression tests and verify available flows; signed-out desktop/mobile protection checked and full regression suite passed.
- [ ] Verify authenticated permission changes and assignment CRUD against hosted data — blocked: existing external sign-in has no available test session.

# Roadmap — Custom role and operation management

- [x] Extend existing role management with super-admin-only role, permission and assignment CRUD without replacing built-in controls.
- [x] Enforce custom operation policies on the server and mirror allowed module access in the portal.
- [x] Test protected roles, permission changes, assignment and deletion safeguards; verify signed-out protection and mobile entry page.
- [x] Preserve .env and use the existing versioned people-settings save; no schema migration or connection replacement.
- [ ] Verify create/edit/assign/revoke/delete against the existing hosted database while signed in as Super Admin — blocked: no managed session or approved sign-in is available for this externally configured project. Public branding has a pre-existing hydration mismatch; its visible desktop/mobile rendering was checked.
