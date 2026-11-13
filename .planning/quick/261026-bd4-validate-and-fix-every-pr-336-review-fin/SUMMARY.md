---
status: complete
---

# PR 336 review follow-up

Reviewed every numbered and low-priority finding against `d59fdaf8`. The core
enforcement/lifecycle findings were confirmed; item 6 requires a protocol
qualification. See [the assessment](./ASSESSMENT.md) for each item.
The CSP concern is valid, but Chromium 152 rejects the same-nondefault-port
HTTP-to-HTTPS upgrade asserted by the reviewer. The optional planning split was
not taken: protocol decisions and verification history remain with their code.

## Implementation

- Merge `0ba257bb` integrates main `8c437f4e` without dropping Firewall admission
  or released snapshot/share behavior.
- `511c3784` binds relay queries to immutable approval plans and held cancellation;
  scopes persistent revocation to its principal; restores local-domain budgets;
  verifies both legacy relay diagnostics.
- `d4c706ca` authorizes OUTBOX getEvent/query, closes planned queries on cancellation,
  fails closed when planning/publish destination hooks are missing, adds terminal
  denials and six bounded compatibility warning tests. Existing planning helpers
  moved unchanged to keep the router below the configured size gate.
- `a5f45dfd` prevents delayed theme replies from reaching a replacement source.
- `4bfe29ab` redirects alias-host HTML to the canonical Paja origin, preserves
  resource deadlines after approval, and documents/tests browser CSP matching.
- `18d7d9fb` records diagnostics and actual tests, links the resource proxy policy,
  fixes PR-wide whitespace and breaking 0.x changeset severity, and updates fixtures.
- Full browser validation found Paja decorators stripping planning hooks; that
  integration correction is committed in `4b9ea579`, preserving planned transport,
  social cache augmentation, and source-bound Blossom observation. The browser
  fixture now tests authored and fallback reads as separate approved operations.

- `b7ac109f` restores canonical throttling replies and source checks while
  preserving cleanup and mandatory CONFIG/INC response paths. `f8d2768d` records
  the residual CONFIG denial/backpressure gap explicitly.

## Protocol authority

Rechecked the current exact refs rather than treating review text as authority:

| Contract | Source |
| --- | --- |
| NIP-5D | nostr-protocol/nips PR2303 / dskvr/nips `5560820fa4f37f45b8ab742a11aeb3001b17dc67`, `5D.md` |
| NAP-RELAY | napplet/naps PR2 `9f30b3505335a52c574ff570576687d6467021ff` |
| NAP-OUTBOX | napplet/naps PR32 `8865f73d52a4864afee145f28d26520476273927` |
| NAP-RESOURCE | napplet/naps PR80 `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc` |
| NAP-THEME, IDENTITY, INC, SHELL | napplet/naps master `19de5ce1cea40cd4c76089cdd8126e9f87648049` |
| NAP-STORAGE | napplet/naps PR3 `4f4cf0ca7ecbd24c284a5d63bcd85e3de6af37ca` (supersedes the initially inspected PR43 `298ee4792c1ee8bf8163ae12ccc42c903cc972e1`) |
| NAP-CONFIG | napplet/naps PR14 `bed9cb5b1e7c9b5babee8870aa18b12949af1d62` |

Temporal budgets and browser CSP source matching are host policy. CONFIG
get/subscribe/schema ACKs and INC channel listings have mandatory replies but
no defined throttling denial. Those calls remain diagnostic-only. Repeated
CONFIG schema registration can still validate and persist values; existing
depth checks are not a total work/size bound. Full rejection/backpressure is
intentionally deferred as a documented upstream spec gap. This qualifies the
blanket recommendation in review item 6; it is not claimed fully enforced.
The existing relay.query relay hint remains a bounded Kehto extension; the
current NAP query wire specifies filters only. `identity.getPublicKey` returns
an empty pubkey on denial without inventing the error field its NAP forbids.

The CSP browser tests use a real localhost parent and disposable TLS fixture.
They prove allowed HTTP/HTTPS bodies and blocked sibling ports. Default-port
upgrade acceptance is proven by the exact CSP violation list against `.invalid`,
not by claiming successful transport from that intentionally nonexistent host.
Firefox, WebKit, physical devices, and production relays were not exercised.

## Validation

Final combined checks on the reviewed implementation (Node 24.21.0, Chromium 152):

- `pnpm build` (also run by type-check and E2E): passed.
- `pnpm type-check`: all 18 tasks passed.
- `pnpm test:unit`: 213 files, 2,733 tests passed.
- `CI=1 KEHTO_HARNESS_PORT=43473 pnpm test:e2e`: all 159 tests passed in 7.5 minutes,
  with no retries or skipped cases in the final run.
- `pnpm docs:check`: package docs, routes, TypeDoc, and docs wiring passed.
- `npx --yes aislop@0.12.0 scan -d`: 100/100, no unsuppressed findings.
- `pnpm changeset status`, `git diff --check`, and the complete
  `git diff --check origin/main...HEAD`: passed.
- Relevant upstream NAP/NIP heads were rechecked unchanged immediately before
  shipping. Main `8c437f4e` is an ancestor of this branch.

The initial browser integration run exposed missing Paja plan-hook forwarding;
that was fixed and the entire browser suite rerun. The current evidence does
not rely on the earlier failing run or on fixtures bypassing authorization.

`pnpm lint` exits successfully but executes no package tasks; the pinned AI-slop
scan supplies actual lint/static analysis. No quality rules or test thresholds
were weakened, and no runtime dependency was added.
