---
quick_id: 261009-ctx
status: complete
completed: 2026-10-09
---
# Copilot review resolution — PR #277

All six inline claims were validated, corrected, replied to with evidence, and resolved on the existing PR. No findings were dismissed. Commits: `8fd7f06` (host eligibility and regressions), `d9c44ce` (active documentation).

## Specification check

Rechecked after implementation on 2026-10-09:
- NIP-5D PR #2303 / `dskvr/nips@020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7`, `5D.md`.
- `napplet/naps@a040914b4bbd3a5cd8a14b0f316a723c968ebfb2` current master, `naps/NAP-INTENT.md` and `naps/NAP-INC.md`.

Corrections are conformant with these refs. Required/optional declarations do not grant INC; optional absence permits loading. Named intent routing requires an actual host INC environment. Root/snapshot artifacts still execute normally, but event-coordinate intent routing is outside this dTag-based host policy. No upstream semantic blocker was found.

## Findings and disposition

| Comment | Assessment and correction | Reply |
|---|---|---|
| 4231740389 | Valid: playground candidates now use the target identity's resolved environment; optional INC defaults to unavailable without host policy. | [Evidence](https://github.com/kehto/web/pull/277#discussion_r4232266713) |
| 4231740447 | Valid: the minimal-host example now prepends a restrictive CSP after verification and before namespace injection. | [Evidence](https://github.com/kehto/web/pull/277#discussion_r4232267280) |
| 4231740495 | Valid: nameless records never enter the named catalogs or notify listeners; signed roots/snapshots still load. | [Evidence](https://github.com/kehto/web/pull/277#discussion_r4232267854) |
| 4231740551 | Valid: Paja resolves per-target INC availability from its complete adapter before discovery or selection. | [Evidence](https://github.com/kehto/web/pull/277#discussion_r4232268412) |
| 4231740603 | Valid: active capability guides teach R/O, normalized properties, and legacy-only requires tags. | [Evidence](https://github.com/kehto/web/pull/277#discussion_r4232268865) |
| 4231740650 | Valid: fixture documentation now matches plugin 0.15.0 and the required description option. | [Evidence](https://github.com/kehto/web/pull/277#discussion_r4232269463) |

## Verification

- `pnpm build`: 32 tasks passed.
- `pnpm type-check`: 17 tasks passed.
- `pnpm test:unit`: 1,872 tests in 152 files passed, including optional INC policy transitions, invocation rejection, nameless catalog isolation, and optional-INC frame admission.
- `pnpm test:e2e`: all 89 tests passed (2.0 minutes).
- `pnpm docs:check`: strict TypeDoc, VitePress, and nine public package documentation sets passed.
- Direct Chromium execution of the documented CSP helper: policy first, standards mode retained, authored scripts and mandatory shell present, fetch/Worker/remote images blocked without outbound requests.
- `aislop@0.12.0 ci --json`: passed, 99/100, zero errors. Sole warning remains the unchanged services CVM transport file size; no rule or configuration changes.
- `git diff --check`: passed.

The first browser run exposed an import-order initialization cycle. Re-exporting the environment helper through the existing shell-host entry restored boot; the complete browser suite then passed. The static conformance guard's source boundary was updated when intent composition moved to the complete adapter.

Existing package changesets remain intact, with Paja behavior included. The unrelated primary checkout package.json edit is untouched. PR #277 remains open; no merge or release was requested.
