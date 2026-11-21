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

# Roadmap — Custom role and operation management

- [ ] Extend existing role management with super-admin-only role, permission and assignment CRUD without replacing built-in controls.
- [ ] Enforce custom operation policies on the server and mirror allowed module access in the portal.
- [ ] Test protected roles, permission changes, assignment and deletion safeguards; verify the available browser flow.
- [ ] Record any database activation or signed-in verification blocker without changing the existing environment settings.
