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

## Services that arrive late

The runtime copies `services` from the adapter once, when `createShellBridge()`
(or `createRuntime()`) runs. A handler you add to that object afterwards is not
routed. If a service only exists once something else is ready, such as a signer
connecting, register and retire it through the runtime:

```ts
signer.onConnect(() => {
  adapter.services.webrtc = webrtcService;                 // what the shell advertises
  bridge.runtime.registerService('webrtc', webrtcService); // what the runtime routes
  reloadNappletFrames();                                   // new frames get the domain
});
signer.onDisconnect(() => {
  delete adapter.services.webrtc;
  bridge.runtime.unregisterService('webrtc');
  reloadNappletFrames();
});
```

Both halves matter. The shell advertises a declared service only while the
bridge's runtime routes it (`bridge.runtime.hasService(name)`), so `shell.init`
and injected domains never promise a domain nothing answers. If the adapter
lists a service the runtime does not route, the shell leaves it out and logs
`[KEHTO_SERVICE_NOT_REGISTERED]` once per service per bridge.
`registerService()` on its own still advertises nothing: the adapter entry is
the host's declaration.

A frame keeps the namespace it was created with, so reload or replace frames
after a change. A request for a service-only domain with no registered handler
gets no reply, because [NIP-5D at `f60550c`](https://github.com/dskvr/nips/blob/f60550c3409d6d81a875088ec83e660571e10504/5D.md) requires unrecognized types to be silently ignored.
The runtime logs `[KEHTO_UNROUTED_SERVICE_DOMAIN]` once per domain so the host
can see it; the napplet-supplied type is not logged. Once a domain is exposed
and registered, its own contract applies, for example the result-per-request
rule in the [NAP-WEBRTC draft at `fb4dd6f`](https://github.com/napplet/naps/blob/fb4dd6f0e6294e1837733d2af61931e3e114bd97/naps/NAP-WEBRTC.md).

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

Each map value is an existing Kehto ACL capability, such as `state:read`, or
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
and runtime destruction invalidate pending callbacks.

Unsolicited shell -> napplet pushes into a custom domain go through
`ServiceRuntimeContext.sendToEligibleNapplet` only when the handler declares the
exact push type in `pushCapabilities`, mapped to the recipient's required ACL
capability or explicit `null`:

```ts
const example: ServiceHandler = {
  descriptor: { name: 'example', version: '1.0.0' },
  messageCapabilities: { 'example.ping': null },
  pushCapabilities: { 'example.changed': null },
  onRegistered(context) {
    // Later: context.sendToEligibleNapplet(windowId, { type: 'example.changed', ... })
  },
  handleMessage() {},
};
```

A push is delivered only when the handler is the registered service for that
domain, the recipient is a live unblocked source, `isDomainAllowed` grants the
domain to that window, and the declared capability (if any) is currently
granted; the boolean result reports the verdict. Undeclared types, absent maps,
invalid capability strings, and built-in domains are refused: built-in NAP
domains keep their canonical recipient capability mapping regardless of
`pushCapabilities`.

Built-in NAP domains ignore extension maps and retain their own routing and ACL
mapping. `shell` remains adapter-owned; the removed `signer` route cannot be
revived. INC topics never select an extension service.

For a browser host, registration does **not** inject `window.napplet.example`.
The host must implement the owning domain contract, inject its granted binding
before app scripts run, and enforce that same availability through its trusted
source mapping. The stock Paja bindings do not expose arbitrary
extensions. Neither manifest `R`/`O` tags nor `shell.init.services` grants access.
Without an exposed binding, napplets must treat the domain as unavailable.

`routeServiceMessage` is a low-level, policy-free selection primitive. It does not
check sessions, message declarations, ACLs, domain grants, or firewall policy.
Never use it as a fallback for untrusted host ingress; use `Runtime.handleMessage`.

This host API is bounded by [NIP-5D at `020cb8b`](https://github.com/dskvr/nips/blob/020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7/5D.md)
and [NAP-SHELL at `3fdba1a`](https://github.com/napplet/naps/blob/3fdba1accd508ab54939b277d426127c5af8faf8/naps/NAP-SHELL.md).
No `example` NAP exists in the checked registry. The example demonstrates routing
policy only and establishes no standardized extension protocol.
