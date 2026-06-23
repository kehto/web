# @kehto/cli

## 0.2.1

### Patch Changes

- 4e0f4b9: Add NAP-LINK runtime parity for the current `@napplet/nap` contract.

  The runtime now dispatches the `link` domain, `@kehto/services` exports a reference `link.open` service, shell capabilities can advertise NAP-LINK, and Paja/playground hosts register link support. Package peer ranges now track the current `@napplet` 0.20 line.

- cacab69: Pin internal `@kehto/*` dependencies to explicit caret version ranges instead of
  the `workspace:*` protocol, so published packages (npm and JSR) carry correct,
  resolvable dependency versions. The ranges mirror the existing `jsr.json` imports.
- Updated dependencies [7dbbdf8]
- Updated dependencies [7c7b019]
- Updated dependencies [4e0f4b9]
- Updated dependencies [4fd5e37]
- Updated dependencies [b37337b]
- Updated dependencies [272277a]
- Updated dependencies [cacab69]
  - @kehto/paja@0.3.0

## 0.2.0

### Minor Changes

- 07a4733: Add the initial Paja single-window development runtime package and the top-level `kehto paja` CLI command with a typed option model, framework-agnostic target URL contract, real Kehto shell/service wiring, and configurable development environment simulation.

### Patch Changes

- Updated dependencies [07a4733]
  - @kehto/paja@0.2.0
