---
phase: 115-regression-audit-and-shipping
plan: 01
status: complete
pr: https://github.com/kehto/web/pull/336
---

# Final audit and PR

Reconciled the package/service consumer matrix with host admission, current
NAP-CVM and NAP-NOTIFY draft heads, documented the legacy notification demo
wire as a bounded spec gap, and retained no untracked approval authority.
Firewall owns pure decisions and grants; runtime owns request coordination and
independent rate budgets; Paja and playground own presentation and frame
lifecycles. The playground remains verified-only.

The final source tree passed build and type-check, 207 unit files / 2,625
tests, 133 Chromium tests, the docs gate, changeset status, diff integrity,
and the 100/100 AI-slop gate. Chromium used `KEHTO_HARNESS_PORT=43173` to
avoid an unrelated local listener on 4173. Commits were pushed to
`feat/firewall-approvals`; PR [#336](https://github.com/kehto/web/pull/336)
is open. The unrelated `.planning/WINDOWS.md` edit was left unstaged.
