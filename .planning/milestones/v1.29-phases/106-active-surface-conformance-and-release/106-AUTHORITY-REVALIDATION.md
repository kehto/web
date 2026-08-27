---
phase: 106
plan: 01
checked_at: 2026-07-27T15:41:13Z
status: conformant
---

# Phase 106 Authority Revalidation

This record is the immutable execution-time reconciliation for the mutable
`napplet/naps` PRs and released `@napplet/*` line. It is consumed fail-closed by
`node scripts/verify-napplet-authorities.mjs --check`.

## PR inventory

| PR | State | Recorded head | Current head | Merge SHA | Base SHA | Semantic verdict |
| --- | --- | --- | --- | --- | --- | --- |
| #89 NAP-INC | closed / merged | `4593ce9e301ce098fd3dad64206fcd6f144fa7af` | `e0cd5848abb70a7450ed0eabfef9e8d04f4b41b3` | `111bea78eb5d0bc9b838eb52ac70a110c92254a7` | `6461e4b37c29dc09a20dff35d9515889c4433874` | conformant |
| #90 governance/web projection | closed / merged | `896c32c92deee68dc4d10fc1132b62df20cccb6f` | `896c32c92deee68dc4d10fc1132b62df20cccb6f` | `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24` | `6461e4b37c29dc09a20dff35d9515889c4433874` | conformant |
| #91 NAP-INTENT | open | `a718915ddefa2f03a0126579601f59d8bd86f7c4` | `a718915ddefa2f03a0126579601f59d8bd86f7c4` | `37b42558f60244e2694ee907676a014d2497cf61` | `6461e4b37c29dc09a20dff35d9515889c4433874` | conformant against open draft |
| #92 symmetric channels | closed / merged | `c5cd06f7be6d4690b303949abb26e87ff62f4729` | `c5cd06f7be6d4690b303949abb26e87ff62f4729` | `e0cd5848abb70a7450ed0eabfef9e8d04f4b41b3` | `4593ce9e301ce098fd3dad64206fcd6f144fa7af` | conformant |

Current merged `master` authority: `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`.
The PR head, merge identity, and current-master identity are intentionally kept
separate; none is mechanically substituted for another.

## PR #89 semantic delta

The immutable comparison from former draft head `4593ce9e301ce098fd3dad64206fcd6f144fa7af`
to current head `e0cd5848abb70a7450ed0eabfef9e8d04f4b41b3` changes only `naps/NAP-INC.md`.

Changed clauses reconciled against Kehto:

1. `channel.onOpened`, `inc.channel.opened`, and target attachment are required
   before the opener result. `packages/runtime/src/inc-handler.ts` sends the
   attested target notification before `inc.channel.open.result`; the injected
   prelude retains handles until `onOpened` registration.
2. `ChannelHandle.onClosed` and `inc.channel.closed` retain terminal records for
   late handlers. `packages/shell/src/napplet-namespace.ts` retains the terminal
   record and `packages/shell/src/napplet-namespace.test.ts` exercises late
   registration.
3. Target and opener handles are symmetric, including inbound/outbound list
   snapshots, exact peer dTags, and trusted-parent message ordering. Runtime and
   shell focused tests cover both endpoints, target-unavailable rollback, ACL
   denial, bounded unopened handles, and sender attestation.
4. The runtime may bound unopened handles/messages only by closing and notifying
   both sides. The prelude test covers overflow as a terminal closure rather than
   a silent drop.

Verdict: **conformant**. No repair is required, so this plan may update only its
evidence/guard artifacts and does not alter product behavior.

## Published package provenance

| Package | npm | JSR | Installed/lock/manifests | Source ref | Release ref |
| --- | --- | --- | --- | --- | --- |
| `@napplet/core` | `0.29.0` | `0.29.0` | aligned | `dd7b3a728eb9c838b7218fcec7bb7bb00e7cc88b` | `60889f1c2476e063500c7ab6624af6abe0dbcbe5` |
| `@napplet/nap` | `0.29.0` | `0.29.0` | aligned | `dd7b3a728eb9c838b7218fcec7bb7bb00e7cc88b` | `60889f1c2476e063500c7ab6624af6abe0dbcbe5` |
| `@napplet/shim` | `0.27.0` | `0.27.0` | aligned | `dd7b3a728eb9c838b7218fcec7bb7bb00e7cc88b` | `60889f1c2476e063500c7ab6624af6abe0dbcbe5` |
| `@napplet/sdk` | `0.25.0` | `0.25.0` | aligned | `dd7b3a728eb9c838b7218fcec7bb7bb00e7cc88b` | `60889f1c2476e063500c7ab6624af6abe0dbcbe5` |
| `@napplet/vite-plugin` | `0.12.0` | `0.12.0` | aligned | `dd7b3a728eb9c838b7218fcec7bb7bb00e7cc88b` | `60889f1c2476e063500c7ab6624af6abe0dbcbe5` |

<script type="application/json" id="authority-baseline">
{"checkedAt":"2026-07-27T15:41:13Z","master":"5ac0490461ca6fec2f0d2e45b4835cf9bc08de24","prs":[{"number":89,"state":"closed","merged":true,"head":"e0cd5848abb70a7450ed0eabfef9e8d04f4b41b3","merge":"111bea78eb5d0bc9b838eb52ac70a110c92254a7","base":"6461e4b37c29dc09a20dff35d9515889c4433874","verdict":"conformant"},{"number":90,"state":"closed","merged":true,"head":"896c32c92deee68dc4d10fc1132b62df20cccb6f","merge":"5ac0490461ca6fec2f0d2e45b4835cf9bc08de24","base":"6461e4b37c29dc09a20dff35d9515889c4433874","verdict":"conformant"},{"number":91,"state":"open","merged":false,"head":"a718915ddefa2f03a0126579601f59d8bd86f7c4","merge":"37b42558f60244e2694ee907676a014d2497cf61","base":"6461e4b37c29dc09a20dff35d9515889c4433874","verdict":"conformant"},{"number":92,"state":"closed","merged":true,"head":"c5cd06f7be6d4690b303949abb26e87ff62f4729","merge":"e0cd5848abb70a7450ed0eabfef9e8d04f4b41b3","base":"4593ce9e301ce098fd3dad64206fcd6f144fa7af","verdict":"conformant"}],"packages":[{"name":"@napplet/core","version":"0.29.0","source":"dd7b3a728eb9c838b7218fcec7bb7bb00e7cc88b","release":"60889f1c2476e063500c7ab6624af6abe0dbcbe5"},{"name":"@napplet/nap","version":"0.29.0","source":"dd7b3a728eb9c838b7218fcec7bb7bb00e7cc88b","release":"60889f1c2476e063500c7ab6624af6abe0dbcbe5"},{"name":"@napplet/shim","version":"0.27.0","source":"dd7b3a728eb9c838b7218fcec7bb7bb00e7cc88b","release":"60889f1c2476e063500c7ab6624af6abe0dbcbe5"},{"name":"@napplet/sdk","version":"0.25.0","source":"dd7b3a728eb9c838b7218fcec7bb7bb00e7cc88b","release":"60889f1c2476e063500c7ab6624af6abe0dbcbe5"},{"name":"@napplet/vite-plugin","version":"0.12.0","source":"dd7b3a728eb9c838b7218fcec7bb7bb00e7cc88b","release":"60889f1c2476e063500c7ab6624af6abe0dbcbe5"}]}
</script>
