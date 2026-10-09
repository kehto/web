---
quick_id: 261009-j8y
status: complete
---
# PR #272 conflict resolution

Merged origin/main abb9004d into feat/shell-csp-policy a4cafca0 with merge commit
17e3d108. The sole textual conflict was browser-target-frame.ts imports. Neither
obsolete import is needed: the combined loader uses PajaRuntimeTarget and
isPajaLocalTarget from main with prepareNappletSrcdoc from this PR.

Preserved verified-manifest admission, the PR #278 local-file guard, identity
registration before execution, CSP validation before rebinding, host resource
settings, local tabs and sidebar features. Existing CSP minor changeset remains;
release-consumed main changesets were not restored. Primary package.json WIP
was not touched. No new compatibility adapter or NAP wire change.

Added an integration regression showing CSP overrides apply to local HTML and
invalid connection policy leaves existing identity/window/srcdoc untouched.

## Verification

- No unmerged index entries or conflict markers; diff against current main passes hygiene checks.
- Build 32/32; type-check 17/17.
- Unit 2,095/2,095 across 160 files. Initial fresh-worktree CLI import failure
  was due to unbuilt Paja output; full suite passes after required build.
- Full Playwright 108/108, including shell CSP browser enforcement, local files,
  canonical and legacy intent delivery, and resource server settings.
- Strict TypeDoc, VitePress and docs audit pass for all 9 public packages.
- Pinned aislop 0.12.0 passes at 99/100 with existing browser-host.ts and
  cvm-nostr-transport.ts file-size findings. No rule changes.

Authority: NIP-5D CSP at dskvr/nips@24711d9c47bbdd07908bf1d52bf677d9cbc530f0,
current admission at 020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7, and NAP-SHELL
at napplet/naps@e5308ac92cfd49e4fb026812c60886571515e219. CSP and registration
boundaries preserved; unsigned local loading remains main's intentional dev-host
spec gap. Broader NAP drift remains out of scope.

Logs: /private/tmp/pr272-{build,type,unit,e2e,docs}.log and /private/tmp/pr272-slop.json.
