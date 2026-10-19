# Paja intent availability notifications — complete

Implemented catalog-to-resolver notification wiring in a dedicated Paja intent
service composition module. Catalog events retain their ID argument and add
immutable deduplicated previous/current archetype slugs. Service registration
owns the subscription, including repeated registration and unregister cleanup.
Default-handler UI updates notify the same resolver. Eligibility still uses the
live verified catalog filtered by the target's resolved intent domain.

No-handler invocation rejection remains terminal. No automatic retry, catalog
admission for local files, or simulation behavior change was introduced.

Authority rechecked before closeout: napplet/naps master
19de5ce1cea40cd4c76089cdd8126e9f87648049, naps/NAP-INTENT.md, last touched
at e5308ac92cfd49e4fb026812c60886571515e219; SHA-256
1063765132336e8f922bfb5c2a83c7daf9d131ca8db9875d9e1f3cda559d70a6.
Conformant for this change: pre-acceptance failure stays terminal and catalog /
default changes now emit the recommended intent.changed notification.

## Verification

- pnpm build: pass (32 tasks).
- pnpm type-check: pass (17 tasks).
- pnpm test:unit: pass (2,237 tests / 176 files). Updated static conformance
  guard to follow the extracted composition without weakening contract checks.
- pnpm docs:check: pass (strict TypeDoc, VitePress, nine-package audit).
- aislop@0.12.0: pass, 95/100, same five baseline complexity warnings; pinned
  configuration unchanged, no disabled rules. Extracted intent composition to
  avoid adding a new file-size warning to browser-adapter.ts.
- New real-browser failed-invoke/install/notification/explicit-retry regression:
  pass. Default-choice regression also confirms hasDefault/isDefault pushes.
- Full three-file Paja Playwright attempt: 31 passed, one failure, nine skipped
  by the existing serial suite. The unrelated pre-existing single-window test
  initially timed out waiting for cvm.discover.result (line 398). The entire
  affected file passed on retry (18/18), including that case; the failure was
  transient and network causation is unproven. Historical quick-task summary
  also records this failure.
- Final three-file Paja run excluding that transient CVM case: 40/40 pass.
  All 41 distinct Paja browser tests passed across these runs.
  Browser used downloaded Playwright Chromium and existing /tmp shared-library
  dependencies, without repository configuration changes.
- Independent review after extraction: no remaining correctness/security blockers.
- git diff --check: pass.

Primary checkout remains untouched with its existing .gitignore change and
untracked .nsite/ and nsyte-logs. No merge or release is part of this fix.
