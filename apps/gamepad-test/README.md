# Controller tester

A single-file napplet for testing the controller API shipped in Kehto PR #297. It displays each controller's index, device description, axes, analog button values, pressed/touched state, timestamp, and focus state. Nothing is simulated in the napplet.

## Run locally

From the Kehto repository root:

```sh
pnpm install
pnpm build
pnpm --filter @demo/gamepad-test dev
```

Open **http://127.0.0.1:5187** (Paja). Port 5186 serves app assets; use the Paja URL for testing. The script uses this repository's built CLI so an older globally installed CLI cannot silently select a runtime without GAMEPAD.

1. Connect a USB or Bluetooth controller. Click **Focus**, then press a controller button; browsers often hide controllers until the first gesture.
2. Move both sticks and press buttons/triggers. Confirm values change and **Live input** gets a check.
3. Keep a button held and click Paja's sidebar, another browser tab, or another app. This view should show **Idle**, zero axes/button values, and timestamp zero while retaining connected controller metadata. **Neutral on blur** records that transition.
4. Return to the napplet. Held buttons may appear pressed; the inspector observes state and does not generate game actions.
5. Unplug/reconnect the controller. Empty slots must remain visible and controller indices must stay intact.

Open the Paja URL in two browser windows to compare active and inactive views. Only the focused host should show live values. For two frames sharing one runtime, the automated browser test loads two copies through the real shell and service.

The three check marks report observations, not a full conformance certificate. Empty/disconnected snapshots do not count as proof of neutralization. Cached startup values render immediately but do not increment the evidence checks. The snapshot counter counts pushed states, not animation frames; unchanged input need not produce more messages. **Reset checks** clears the local observations. Expand **Latest snapshot** to inspect the received data. No sign-in is needed.

## Artifact and protocol boundary

`dist/index.html` is the portable self-contained artifact. `.napplet/config.json`, created by `napplet init`, owns deployment metadata; publishing relays and Blossom servers are deliberately unconfigured for local testing.

Hard requirement: `gamepad`. Optional enhancement: `theme`, with a dark local palette when absent. No relay, network, browser storage, signing, haptics, or native device access is used. Device descriptions are rendered as text. The shell denies native controller access and owns focus and polling.

Spec checked: [NAP-GAMEPAD](https://github.com/napplet/naps/blob/0b28f77e3dfa0f07dd7c0f9d61a7090ee99f3a5e/naps/NAP-GAMEPAD.md), the exact open proposal #108 head, and [NAP-THEME](https://github.com/napplet/naps/blob/d73f6f9480dcec1d75712cf4eafbe70337fe1e42/naps/NAP-THEME.md). The demo conforms to the draft's snapshot API. SDK GAMEPAD wrappers are pending in napplet/web PR #242; this demo uses the already-shipped Kehto injected API directly. The local types describe only that surface. Theme uses the published SDK. No unpublished dependency or replacement protocol is bundled.

## Verification

```sh
pnpm --filter @demo/gamepad-test verify
pnpm --filter @demo/gamepad-test test:conformance
pnpm exec vitest run tests/unit/gamepad-test-napplet.test.ts
pnpm test:e2e -- tests/e2e/gamepad-demo.spec.ts
```

The generic published conformance runner predates GAMEPAD; its absent-domain smoke check cannot establish controller delivery. The dedicated browser regression exercises the built artifact through Kehto's real bridge, binding, focus handling and Permissions-Policy using a deterministic host controller sample. A physical controller is still required for the manual device check.

Agent guidance: `npx skills add napplet/napplet`. Follow `AGENTS.md` and the parent repository lifecycle.
