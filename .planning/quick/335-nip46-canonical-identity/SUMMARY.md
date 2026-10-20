# PR 335 follow-up

Completed the plan: connect acknowledgements are ignored and canonical get_public_key is always requested, validated, and cached. Encrypted fake-bunker regressions cover inline user keys, distinct transport keys, hex secrets, request ordering/caching, and invalid canonical replies even with a hex-shaped connect result. Changeset updated; no new legacy path or NAP wire change.

Conformance: NIP-46 46.md ba59df89a3d6fdaab067b16da9f9c003de22566a and napplet/naps NAP-IDENTITY.md 19de5ce1cea40cd4c76089cdd8126e9f87648049 checked; canonical user-key resolution is conformant.

Validation: focused 9/9; full units 176 files / 2238 tests; build and type-check pass; docs:check passes (initial concurrent attempt raced build declarations, serial retry passed). aislop@0.12.0 CI passes at 95/100, with five existing complexity warnings outside changed files and no AI-slop findings. Changed-files scan is 100/100. Config unchanged.

Local E2E attempted twice: default /usr/bin/chromium missing; cached Chromium also cannot launch because libnspr4.so is missing. No browser-test assertions executed; updated-head CI must provide browser verification. Playground duplicate-client fix remains explicitly out of scope.
