# @kehto/demo

## 0.0.13

### Patch Changes

- Updated dependencies
  - @kehto/runtime@0.12.1
  - @kehto/shell@0.11.2
  - @kehto/services@0.10.2

## 0.0.12

### Patch Changes

- Updated dependencies [ac0bf74]
  - @kehto/runtime@0.12.0
  - @kehto/services@0.10.1
  - @kehto/shell@0.11.1

## 0.0.11

### Patch Changes

- Updated dependencies [ecd1ab3]
- Updated dependencies [dd65bec]
- Updated dependencies [de0bdc3]
- Updated dependencies [d37ef25]
- Updated dependencies [d37ef25]
- Updated dependencies [5015a33]
  - @kehto/nip@0.3.0
  - @kehto/services@0.10.0
  - @kehto/shell@0.11.0
  - @kehto/runtime@0.11.0

## 0.0.10

### Patch Changes

- Updated dependencies [968e664]
- Updated dependencies [f5e3089]
  - @kehto/runtime@0.10.0
  - @kehto/shell@0.10.0
  - @kehto/nip@0.2.0
  - @kehto/services@0.9.1

## 0.0.9

### Patch Changes

- Updated dependencies [50a3241]
- Updated dependencies [f5148a3]
  - @kehto/runtime@0.9.0
  - @kehto/services@0.9.0
  - @kehto/shell@0.9.0

## 0.0.8

### Patch Changes

- Updated dependencies
  - @kehto/runtime@0.8.0
  - @kehto/services@0.8.0
  - @kehto/shell@0.8.0

## 0.0.7

### Patch Changes

- Updated dependencies [0e1f4c3]
  - @kehto/runtime@0.7.0
  - @kehto/services@0.7.0
  - @kehto/shell@0.7.0

## 0.0.6

### Patch Changes

- Updated dependencies [3ed7d04]
  - @kehto/runtime@0.6.0
  - @kehto/services@0.6.0
  - @kehto/shell@0.6.0

## 0.0.5

### Patch Changes

- Updated dependencies [4e0c4db]
  - @kehto/runtime@0.5.0
  - @kehto/services@0.5.0
  - @kehto/shell@0.5.0

## 0.0.4

### Patch Changes

- Updated dependencies
  - @kehto/runtime@0.4.0
  - @kehto/services@0.4.0
  - @kehto/shell@0.4.0

## 0.0.3

### Patch Changes

- Updated dependencies
  - @kehto/runtime@0.3.1
  - @kehto/services@0.3.1
  - @kehto/shell@0.3.1

## 0.0.2

### Patch Changes

- 10b119b: **DECRYPT-DEMO-01/02/03 (v1.10 Phase 51/52)** — move decrypt-demo onto the `@napplet/nap@0.3.0` `identityDecrypt` helper and retire its old `0.2.1` shim/vite-plugin graph.

  The demo now calls `identityDecrypt(event)` from `@napplet/nap/identity/sdk` instead of constructing local request IDs, pending response maps, and raw `window.parent.postMessage({ type: 'identity.decrypt', ... })` envelopes. The Playwright-covered DOM sentinels for NIP-04, NIP-44, NIP-17, and class-2 forbidden behavior remain unchanged.

- 002598f: Fix stale port label `:5174` → `:4174` in `apps/playground/napplets/resource-demo/index.html:61` h2 (POLISH-01). The actual `GRANTED_URL` constant in the same file correctly points at `:4174` (the playground preview port); only the visible h2 label was stale. Cosmetic only; no behavioral change.
- ff4009f: Add `tests/e2e/topology-lines.spec.ts` — Layer-B regression spec for BUG-02. Phase 42 / Plan 42-01.

  BUG-01 (topology connector lines absent in `pnpm preview`) was fixed in commit `4f02c1e` by vendoring `leader-line.min.js` to `apps/playground/public/vendor/` and updating the script tag in `apps/playground/index.html`. This spec asserts the UMD remains loadable in the built preview and at least one `svg.leader-line` element renders, preventing silent regressions if the vendor file or script tag is touched again.

  E2E baseline: 72 → 73.

- Updated dependencies [4c3a3eb]
- Updated dependencies [0fa11f1]
- Updated dependencies [6b01607]
- Updated dependencies
- Updated dependencies [239fa70]
- Updated dependencies [03c293c]
- Updated dependencies [c0f1a44]
- Updated dependencies [55cb07f]
- Updated dependencies [d885328]
- Updated dependencies [93224cd]
- Updated dependencies [93224cd]
- Updated dependencies [93224cd]
- Updated dependencies [3059719]
- Updated dependencies [8890904]
- Updated dependencies [8890904]
- Updated dependencies [8890904]
- Updated dependencies [b7032ab]
- Updated dependencies [b7032ab]
- Updated dependencies [b7032ab]
- Updated dependencies [597dbdb]
- Updated dependencies [e3cc899]
  - @kehto/shell@0.3.0
  - @kehto/services@0.3.0
  - @kehto/runtime@0.3.0
  - @kehto/nip66@0.2.0

## 0.0.1

### Patch Changes

- Updated dependencies [226cdca]
- Updated dependencies [226cdca]
- Updated dependencies [226cdca]
- Updated dependencies [97b7bc8]
- Updated dependencies [41b12b9]
- Updated dependencies [41b12b9]
  - @kehto/runtime@0.2.0
  - @kehto/services@0.2.0
  - @kehto/shell@0.2.0
