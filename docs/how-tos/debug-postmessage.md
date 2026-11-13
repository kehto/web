# How-to: Debug postMessage Traffic

Use this when a napplet appears loaded but no NAP request or response is visible.

## Checklist

1. Confirm the iframe uses `sandbox="allow-scripts"` without `allow-same-origin`.
2. Confirm the shell registered the iframe's `contentWindow` before the napplet's
   bootstrap runs. The bootstrap sends a single window-level `napplet.hello`
   carrying one `MessagePort`
   ([NIP-5D port-bound identity](../policies/NIP-5D-CONFORMANCE.md#port-bound-identity-transport)).
3. Confirm the hello bound a port: `originRegistry.getPort(windowId)` is defined.
   Every NAP request and response travels over that port, not as window-level
   `message` events.
4. Confirm the napplet was not revoked. `ShellAdapter.onNappletRevoked` reports a
   second hello, any other window-level message, a second load, or a closed port.
   A napplet that also imports `@napplet/shim` on a Kehto host sends a second hello.
5. Confirm messages are plain objects with a string `type`.
6. Confirm ACL grants exist for the requested capability.
7. Confirm the target service is registered.

## Temporary trace

Observe port traffic through the host adapter in a local debug branch:

```ts
const hooks: ShellAdapter = {
  ...adapter,
  onNappletMessage: (windowId, message) => console.debug('[napplet->shell]', windowId, message.type),
  onNappletRevoked: ({ windowId, reason, detail }) => console.debug('[revoked]', windowId, reason, detail),
};
```

Window-level `message` listeners only ever see the `napplet.hello` handoff.

Remove debug traces before shipping. Source validation and ACL denial behavior should be tested, not bypassed.
