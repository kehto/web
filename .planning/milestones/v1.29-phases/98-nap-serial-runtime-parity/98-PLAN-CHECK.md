# Plan Check 98: NAP-SERIAL Runtime Parity

## Scope Check

Pass. The plan implements one NAP only: `serial`.

## Contract Check

Pass. The plan covers all outbound request types in `@napplet/nap@0.20.0`:

- `serial.open`
- `serial.write`
- `serial.close`

It also preserves the runtime-pushed event direction as shell-owned behavior and does not expose raw handles.

## Risk Check

- Main risk: confusing deterministic demo behavior with real Web Serial support. Mitigation: docs and commit message must say reference hooks are host-owned and no real browser serial backend is added.
- Secondary risk: device APIs create permission/security assumptions. Mitigation: the service accepts host hooks and never returns browser/native handles.
- Stack risk: PR depends on #73. Mitigation: branch from `feat/nap-lists-parity` and open PR against that branch.

## Verification Check

Pass. The planned evidence includes runtime, shell, service, playground, Paja, static guard, e2e, docs, slop, diff, and full gates.
