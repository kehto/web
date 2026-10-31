---
quick_id: 261031-ia2
status: complete
---

# Summary: experimental NAPs on kehto

Downstream developers can build `x-` NAPs without changing any kehto package.

- acl: `x-` namespace, reserved domains, extension decisions in `AclEntry.ext`.
- runtime: own-domain x- capabilities on routes; `pushCapabilities` and scoped `sendToEligibleNapplet`.
- shell: `ShellAdapter.extensions`, validation, tri-state, prelude bindings; `KEHTO_COMPAT_SHELL_ENV_OVERRIDE` warning.
- paja: config `extensions`, Interfaces/ACL/Extensions UI, message log, deniedDTags, wired `--firewall-mode`.
- playground: x-echo through demo hooks, header controls, ACL panels, resolveEnvironment denial.
- fixture + unit + Chromium e2e (Paja and playground); how-to; skill shipped in repo and @kehto/shell.
- services: no change was needed (extensions bring their own ServiceHandler).

Verification: build, type-check, 2516 unit tests, docs:check, relevant Chromium e2e, aislop 95 (equal to main 95, same five pre-existing complexity rows),
subagent dry run (x-counter, 7 unit + 1 Paja spec passing against packed tarballs).
Deviation: --full ran inline with decisions locked by GOAL.md instead of spawned discuss/research agents.
Upstream proposal drafted (not filed): UPSTREAM-PROPOSAL-DRAFT.md.
