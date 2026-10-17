# Controller input

This non-normative integration guide defers to [NAP-GAMEPAD at `napplet/naps@19de5ce1`](https://github.com/napplet/naps/blob/19de5ce1cea40cd4c76089cdd8126e9f87648049/naps/NAP-GAMEPAD.md) and [NIP-5D PR #2303 at `5560820f`](https://github.com/nostr-protocol/nips/pull/2303).

`@kehto/services` exports `createGamepadService` and `browserGamepadOptions`. Add one service to a host's registry and resolve the active iframe through the trusted origin registry:

```ts
const gamepad = createGamepadService(browserGamepadOptions(window, target => originRegistry.getWindowId(target)));
const hooks = { ...hostHooks, services: { ...hostHooks.services, gamepad } };
```

Before assigning any napplet document, call `denyNappletControllerAccess(frame)` from `@kehto/shell`. It retains unrelated Permissions-Policy entries and denies `gamepad`, `hid`, and `usb`. The runtime binds incoming subscriptions to the frame's registered source and approves the host-private `gamepad:input` resource before starting the reader. The NAP has no device handle, so this grant covers the one shared input surface. Paja and the playground install this service and apply the policy to their frames.

Only the visible, focused host's input owner receives live axes, buttons, and timestamps. Other subscribers receive connected-controller metadata with neutral controls and timestamp zero. Host focus/visibility and connection events refresh immediately; active subscriptions share one display-frame polling loop. Denial emits an unavailable state with `reason: "blocked"`. Unsubscribe, permission revocation, window destruction, and service removal stop delivery and release polling. Local listener closure removes that listener; frame lifecycle cleanup ends its wire subscription.

Non-browser hosts can install the service without a native reader; subscribers receive `available: false` with `reason: "unavailable"`. Permissions denial reports `"blocked"`. The host rate limits repeated subscriptions per window while always honoring unsubscribe.

The injected API provides cached `getGamepads()`, `available`, `focused`, and `onChange(handler)`. It preserves null slots and controller indices, copies snapshots for callers, and accepts state only from the parent. Keep a keyboard or pointer fallback. Treat lost focus as idle and establish a fresh button baseline on regained focus so already-held buttons do not become new presses.

The native browser Gamepad API is left untouched. The proposal permits an optional compatibility replacement, but NIP-5D currently limits runtime injection to `window.napplet`; that conflict needs specification clarification before implementing replacement. Haptics, raw HID access, and remapping are outside this NAP.
