---
quick_id: 261111-mbh
status: complete
date: 2026-11-11
branch: feat/paja-firewall-ux
---

# Summary: Paja firewall UX overhaul

## Delivered

- `@kehto/firewall`: pure default-rule model (`permission-rules.ts`).
- `@kehto/runtime`: `PermissionAdapter.defaultDecision`, `DEFAULT_RULE_GRANT_PREFIX`.
- `@kehto/shell`: rebuilt prompt, rule editor, grouped grant list, exported stylesheet.
- `@kehto/paja`: default rules `allow` + `link.open: ask`, durable rule store,
  tab-title labels, one-dialog link open, restart after revocation in single-target mode.

## Decisions

- Rules are host policy consulted only when no stored decision covers a request;
  an `allow` becomes a session grant marked `rule:` so every existing recheck,
  revocation and ACL ceiling keeps working unchanged.
- The library default stays `ask`; only Paja ships `allow`.
- Rule keys follow a verified napplet across artifact versions; grants do not.
- Signing, publishing and device-chooser confirmations are untouched.

## Spec check

NAP-LINK draft `napplet/naps` branch `nap-link` @ `100e5c9`: conformant. The
shell owns policy and prompting; no wire change.

## Found, not changed

The operation budget's startup burst guard blocks operations past 20 in the
first three seconds of a napplet lifecycle, before any approval is consulted.
A napplet that registers many keyboard actions at launch loses the excess.

## Verification

- `pnpm build`, `pnpm type-check`, `pnpm docs:check`: green.
- `pnpm test:unit`: 3409 passed; 4 failures in two files caused by local
  untracked leftovers (`apps/playground/`, `.claude/worktrees/`), unrelated.
- Playwright `paja-*` + `nap-media-player`: 101 passed, 1 skipped.
- aislop 0.12.0: 100/100.
