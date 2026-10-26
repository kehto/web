---
status: resolved
trigger: "Resolve #320 in a separate PR: retired source environment survives session unregister"
created: 2026-10-16
updated: 2026-10-16
---

## Symptoms

After destroyWindow, sessionRegistry.unregister, and originRegistry.unregister,
a new origin registration under the same window ID inherits the retired
registration's private domain. Both shell.init and actual service dispatch expose it.

## Current Focus

hypothesis: environment invalidation is nested under an existing-session check,
so explicit session retirement skips it before the cached environment fallback.
next_action: open the separate #320 PR with verification evidence.

## Authority and scope

- Baseline origin/main c3a19015fb705569eb1ca7fe297bf5a535bb3214, independent of #319.
- Checked napplet/naps master 19de5ce1cea40cd4c76089cdd8126e9f87648049,
  naps/NAP-SHELL.md and projections/web.md. The optional environment exchange
  must describe only its authenticated endpoint; other domains do not depend
  on shell.ready. Private `example.*` messages are host extensions, not a NAP.
- Conformant host policy: cached environments belong to one registered source
  lifecycle. A replacement without a supplied snapshot resolves current defaults.
- Existing mandatory-shell guidance in AGENTS.md predates the current optional
  upstream contract. This fix changes cache retirement only.
- GSD debug runs inline; the primary checkout's unrelated WIP remains untouched.

## Resolution and verification

Moved environment deletion outside the existing-session branch, after the live
same-registration early return. Both newly created and adopted sessions discard
old cached environments; an explicit current origin snapshot still takes precedence.

Four of seven new public-bridge regressions failed before the fix; all seven pass
afterward. They cover source reuse/replacement, explicit unregister and still-live
sessions, pre-ready dispatch, repeated ready signals, retired-source trust, init
domains/service names, and explicit replacement environments.

The original issue script passes with the built shell entry and installed jsdom
26.1.0 on Node 26.11.1: replacementInitHasExample=false, calls=1, and
replacementReceivedReply=false. Only module import paths were adapted.

Build, type-check, all 2,175 unit tests, all 123 Playwright tests (including Paja
and playground), docs:check, changed-file aislop 0.12.0 (100/100), and diff check
pass. Browser checks used temporary IPv6 listener isolation because another
project owns IPv4 port 4173; repository browser configuration was unchanged.
The pinned upstream master ref was rechecked unchanged. Shell patch changeset
and package docs accompany the fix. No dependency on #319's runtime patch.
