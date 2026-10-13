---
status: complete
---

# Controller tester

Built `apps/gamepad-test` from the maintained CLI scaffold and initialized its deployment metadata with `napplet init`. The single-file app displays controller slots/indices, axes, analog buttons, focus and availability, pushed snapshots, and observations of live input and neutral focus loss. Native device access, network access, browser storage, and wire transport remain outside the napplet. Cached startup values are rendered but do not count as received evidence. Optional theme failures leave a usable fallback. Listener teardown is covered.

Authority checked and rechecked: napplet/naps PR 108, `0b28f77e3dfa0f07dd7c0f9d61a7090ee99f3a5e`, `naps/NAP-GAMEPAD.md`; NAP-THEME at merged master `d73f6f9480dcec1d75712cf4eafbe70337fe1e42`; NIP-5D PR 2303 head `020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7`. Result: conformant to the proposed snapshot API. Kehto PR 297 is merged. The upstream SDK wrapper is still pending in napplet/web PR 242, so this example uses the shipped injected API with local structural types. No new messages or compatibility fallback were added. Native API replacement remains outside this demo and the runtime's documented spec-gap policy is unchanged.

Validation:

- `pnpm build`: 33 tasks passed.
- `pnpm type-check`: 19 tasks passed.
- `pnpm test:unit --maxWorkers=4`: 169 files, 2,116 tests passed. An initial unconstrained run passed all assertions but reported two asynchronous transport-test errors; the bounded rerun is clean.
- `pnpm test:e2e`: 126 passed. After the final app refinement and teardown regression, the focused GAMEPAD run passed all seven tests against the rebuilt artifact.
- `pnpm --filter @demo/gamepad-test verify`: guidance, type-check, and single-file build passed.
- Generic conformance: five passed, zero failed, six skipped. Its published runner predates GAMEPAD and supplies an incomplete theme mock; optional-theme failure handling keeps startup usable. The skips do not prove GAMEPAD, manifest signatures, or teardown; dedicated artifact and browser tests cover hash/R/O tags, actual controller delivery, focus isolation, native denial, and listener closure.
- `pnpm docs:check`: passed.
- AI-slop 0.12.0: changed files 100/100, no findings; full repository 95/100, with five pre-existing complexity findings in unchanged runtime files. Configuration unchanged.
- Real Chromium sandbox at 200x160, 320x560, 900x600, and 2400x1200, both light and dark: no document or horizontal content overflow; focus control reachable. Screenshots inspected.
- Paja at `http://127.0.0.1:5187`: no-controller native state delivery and focus verified. A separate automated browser page supplied a deterministic host-native reader sample and verified live values then neutralization in the real Paja service/bridge path. No physical controller was available; manual USB/Bluetooth validation remains for the user.

Use `pnpm --filter @demo/gamepad-test dev` after the root build. The script uses this checkout's CLI, avoiding old global runtime pins. Source and artifact paths are documented in the app README. No package changeset: only a private example, tests, and documentation changed. Node 22 was used for verification because this machine's Node 25/26 networking returned EBADF. The shared checkout's rebrand branch and dirty package.json remain untouched.
