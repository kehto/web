# How-to: Register a Service

Register services on the runtime before napplets start sending NAP messages.

```ts
import { createNotifyService } from '@kehto/services';

bridge.runtime.registerService('notify', createNotifyService({
  present: ({ notificationId, message, emit }) => renderToast({
    notificationId,
    title: message.title,
    onClick: () => emit({ type: 'notify.clicked', notificationId }),
  }),
  dismiss: (_windowId, notificationId) => dismissToast(notificationId),
  requestPermission: (_windowId, channel) => promptForNotifications(channel),
}));
```

## Checklist

- Register under the NAP domain name: `identity`, `relay`, `keys`, `media`, `notify`, `theme`, `config`, `resource`, or host-specific extension.
- Keep host callbacks behind service options.
- Register before iframe navigation when the domain is declared in a current NIP-5D `R` tag (`manifest.requires` after parsing).
- Tear down host-owned subscriptions when the shell bridge is destroyed.
- Do not register a service merely to advertise a capability: a backendless
  notify service rejects delivery and permission requests by design.

Current manifests use `O` tags for optional integrations. Their absence must not
block loading, and neither `R` nor `O` grants capabilities. The `requires` wire
tag belongs only to legacy aggregate-manifest compatibility.

## Domains outside the built-in dispatcher

A registered name alone supplies metadata and attachment hooks. To route a host
extension, declare its exact inbound types with `messageCapabilities` and provide
an `isDomainAllowed(windowId, domain)` hook that returns `true` only for sources
exposed to that domain. Static `RuntimeAdapter.services` and dynamic
`registerService` use the same rules.

```ts
import type { ServiceHandler } from '@kehto/runtime';

// Illustrative private contract, not a standardized NAP.
const example: ServiceHandler = {
  descriptor: { name: 'example', version: '1.0.0' },
  messageCapabilities: {
    'example.ping': null,
  },
  handleMessage(_windowId, message, send) {
    if (message.type === 'example.ping') send({ type: 'example.pong' });
  },
};
runtime.registerService('example', example);
```

Each map value is an existing Kehto ACL capability, such as `state:read`, an
`x-<domain>:<action>` extension capability owned by the same `x-` domain, or
explicit `null` when the operation needs no additional ACL grant. Choose that
mapping from the operation's actual authority requirements. Do not invent
capability strings or reuse an unrelated capability to simulate authorization.
An absent map or absent key gives no extension route. Inherited keys and invalid
capability values also give no route. Keys are exact, not prefix or wildcard
matches, and only types in the registered domain can reach the handler.

Extension requests require a live source-bound session, an unblocked identity,
the declared capability grant, an explicit domain grant, and firewall admission.
Unknown types are dropped before firewall evaluation. ACL and firewall denials
produce no invented extension error envelope; firewall audit and consent still
run. The extension's contract owns payload validation, wire direction, responses,
and any additional authorization beyond the built-in ACL vocabulary.

The response callback is restricted to the same source and domain. Before sending,
it rechecks the registration, source lifecycle, domain grant, block state, and
request capability. Replacement, removal, source re-registration, window teardown,
and runtime destruction invalidate pending callbacks. Unsolicited messages for
non-`x-` custom domains are not enabled through
`ServiceRuntimeContext.sendToEligibleNapplet`. An `x-` handler may push the
exact types it declares in `pushCapabilities`, through its own context only.

Built-in NAP domains ignore extension maps and retain their own routing and ACL
mapping. `shell` remains adapter-owned; the removed `signer` route cannot be
revived. INC topics never select an extension service.

For an experimental domain, prefer the shell-level declaration in
[Build an experimental NAP](./experimental-nap.md). `ShellAdapter.extensions`
takes an `x-` domain, its own `x-<domain>:<action>` capabilities, pushes, a
prelude binding and a tri-state. Paja and the playground wire it end to end.

For a browser host, registration does **not** inject `window.napplet.example`.
The host must implement the owning domain contract, inject its granted binding
before app scripts run, and enforce that same availability through its trusted
source mapping. The stock Paja/playground bindings expose only declared `x-` extensions
(see [Build an experimental NAP](./experimental-nap.md)). Neither manifest `R`/`O` tags nor `shell.init.services` grants access.
Without an exposed binding, napplets must treat the domain as unavailable.

`routeServiceMessage` is a low-level, policy-free selection primitive. It does not
check sessions, message declarations, ACLs, domain grants, or firewall policy.
Never use it as a fallback for untrusted host ingress; use `Runtime.handleMessage`.

This host API is bounded by [NIP-5D at `020cb8b`](https://github.com/dskvr/nips/blob/020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7/5D.md)
and [NAP-SHELL at `3fdba1a`](https://github.com/napplet/naps/blob/3fdba1accd508ab54939b277d426127c5af8faf8/naps/NAP-SHELL.md).
No `example` NAP exists in the checked registry. The example demonstrates routing
policy only and establishes no standardized extension protocol.
