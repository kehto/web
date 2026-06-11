# Summary

## Result

The lower playground relay panel now shows the current relays touched by the shell relay runtime, ordered by most recent access and capped to five rows. It no longer exposes the synthetic NIP-66 fixture suggestion list in the visible playground chrome.

## Changed

- Added relay activity tracking to the playground relay runtime for subscriptions, requests, publishes, and received relay events.
- Added a private monotonic access sequence so relay ordering remains deterministic when multiple accesses share one timestamp tick.
- Replaced the visible NIP-66 suggestions panel with a `relay activity` panel showing `events / subscriptions / requests / publishes` counters.
- Exposed the activity reader through playground demo hooks and wired the panel polling to the real runtime.
- Replaced the NIP-66 suggestions e2e with relay activity e2e coverage, and added unit/static guards for the runtime activity contract.

## Verification

- `pnpm vitest run tests/unit/playground-relay-service.test.ts tests/unit/playground-gateway-guard.test.ts` - 2 files, 14 tests passed.
- `pnpm --filter @kehto/playground build` - passed.
- `pnpm type-check` - passed.
- `pnpm test:e2e -- relay-activity.spec.ts relay-subscribe.spec.ts` - full build plus 3 Chromium tests passed.
- `pnpm lint` - command passed, but Turbo reported no lint tasks executed.
- `git diff --check` - passed.

## Remaining Risk

- The Applesauce relay pool wrappers used here report events without the source relay URL, so `eventsReceived` is counted against the selected relay set for that subscription/request rather than a per-socket origin.
- `pnpm lint` is currently a no-op because no package lint tasks ran, so lint-specific coverage is not meaningful for this quick task.
