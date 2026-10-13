# Napplet Design Patterns

## Bootstrap

The runtime injects `window.napplet` before app code runs. Use SDK helpers in
napplet code.

```ts
import { outbox, storage, identity } from '@napplet/sdk';
```

SDK methods read `window.napplet` at call time. This lets app modules import SDK
helpers freely while preserving runtime-owned injection.

## Feature Detection

Use injected domain property presence for optional surfaces.

```ts
const supportsResource = Boolean(window.napplet?.resource);
const supportsOutbox = Boolean(window.napplet?.outbox);
```

Support checks are advisory. A user-triggered call can still fail because the
shell denied a grant, disconnected a signer, hit a quota, or rejected a policy
input. Always surface operation errors.

## Storage

Use storage for durable app state.

```ts
await storage.setItem('draft', value);
const value = await storage.getItem('draft');
```

Storage is scoped by napplet identity and aggregate hash on the shell side.
Do not add browser storage fallbacks without a deliberate privacy review.

## Configuration Schema Gap

The living [NAP-CONFIG proposal](https://github.com/napplet/naps/pull/14)
defines runtime `config.registerSchema`, but it does not currently define a
manifest tag or HTML-meta encoding for build-time schemas. This starter does not
use vite-plugin `configSchema`; do not treat its private `config` tag or
`napplet-config-schema` meta as interoperable protocol. Recheck the living
proposal before adding settings.

## Applet Layout

The controller tester begins with a focus control and status, followed by a scrollable controller grid. Narrow frames retain the focus control and all readings in the scroll region. Wide frames show multiple controllers and axis columns. The runtime theme paints html, body, and the app root through shared color tokens. There is no minimum size.

## Text Selection

The starter treats the napplet surface like app chrome: static text does not
show accidental selection highlights by default. The default is plain CSS in
`src/styles.css`, not a shell or protocol rule.

Use one of these app-local overrides when copy/select behavior is part of the
napplet UX:

```html
<pre data-napplet-select="text">copyable output</pre>
<code data-napplet-select="all">nostr:...</code>
```

For a text-heavy napplet, set the root variable instead:

```css
:root {
  --napplet-text-selection: text;
}
```

## OUTBOX-First Nostr Access

Use OUTBOX for normal social event reads and publishes so the runtime owns relay
discovery, fallback, deduplication, signing, and fanout.

```ts
const { events } = await outbox.query([{ kinds: [1], limit: 5 }]);
const sub = outbox.subscribe([{ kinds: [1], limit: 20 }]);
sub.on('event', (result) => renderEvent(result.event));
sub.close();
```

Keep subscriptions tied to UI lifecycle and close them on teardown.

## Relay-Local Escape Hatch

Use RELAY only when the feature needs semantics tied to one named relay, such as
a NIP-29 group relay, raw relay diagnostics, or protocol tooling OUTBOX cannot
express. Document that reason next to the call.

```ts
import { relay } from '@napplet/sdk';

const sub = relay.subscribe(
  [{ kinds: [9, 10, 11, 12], limit: 50 }],
  (result) => renderGroupEvent(result.event),
  () => markCaughtUp(),
  { relay: 'wss://groups.example.com' },
);
sub.close();
```

## Resource Fetching

Use `resource.bytes()` for external read-only bytes. The shell applies its
resource policy before bytes reach the iframe.

```ts
const blob = await resource.bytes('https://example.com/avatar.png');
```

For images, prefer `bytesAsObjectURL()` and revoke the handle when the element is
done using it.

## Deferred NAPs (direct network access, security class)

NAP-CONNECT direct-network grants and NAP-CLASS shell-assigned security posture
are currently **deferred** on the [NAPs track](https://github.com/napplet/naps).
They are not part of the active surface: the `connect`/`class` domains, their
SDK helpers, and the vite-plugin `connect` option have been removed. Do not
depend on them. For read-only external bytes, use `resource.bytes()`. If your
napplet genuinely needs a capability the active NAPs do not cover, propose it on
the track first (see below) rather than reaching for removed surface.

## Missing Protocol Surface

Do not create a new JSON envelope domain in app code when a named NAP interface
or numbered wire format is missing. First check whether existing NAPs can be
composed. If the feature really needs a reusable shell-mediated contract, follow
`docs/new-nap-proposals.md` and open a focused PR to
`https://github.com/napplet/naps`.
