---
name: add-service
description: Use when implementing and registering a direct-domain ServiceHandler with the napplet runtime.
---

# Adding a Service to the Napplet Runtime

## Overview

A service is a shell-side handler for a direct NIP-5D envelope domain. The
runtime selects it by the exact `message.type` domain: a `weather.get` message
reaches the registered `weather` service. INC is not a service bus. Its topics
are opaque, queryless identities matched only by exact equality, and an
`inc.emit` is owned by the INC runtime rather than a generic service handler.
The runtime attaches the sender to delivered INC events from the authenticated
endpoint; a service must not fabricate such deliveries. Follow the living
[NAP-INC PR #89](https://github.com/napplet/naps/pull/89) and [web projection
PR #90](https://github.com/napplet/naps/pull/90) for protocol details.

## Prerequisites

- `@kehto/shell` installed in the host project
- A working shell bridge (see `skills/integrate-shell/SKILL.md`)
- A published or locally defined direct-domain envelope contract

## Step 1 — Define the descriptor

```ts
import type { ServiceDescriptor } from '@kehto/shell';

const descriptor: ServiceDescriptor = {
  name: 'weather',
  version: '1.0.0',
  description: 'Host-provided weather lookups',
};
```

The descriptor name must be the exact domain before the dot in the service's
messages. Do not derive it from an INC topic.

## Step 2 — Implement `ServiceHandler`

```ts
import type { NappletMessage, ServiceHandler } from '@kehto/shell';

export function createWeatherService(): ServiceHandler {
  return {
    descriptor,

    handleMessage(_windowId: string, message: NappletMessage, send): void {
      if (message.type !== 'weather.get') return;

      send({
        type: 'weather.get.result',
        id: message.id,
        temperatureC: 18,
      } as NappletMessage);
    },
  };
}
```

Handle only documented direct message types. Preserve correlation IDs for
operations that define results, and emit only result or push envelopes defined
by that domain's NAP. Do not inspect, split, prefix-match, or reinterpret INC
topics; do not create `inc.event` messages.

## Step 3 — Register the service

```ts
import { createShellBridge } from '@kehto/shell';
import { createWeatherService } from './weather-service.js';

const bridge = createShellBridge({
  // ... required hooks ...
  services: {
    weather: createWeatherService(),
  },
});

// Or register after bridge creation for lazy initialization:
bridge.runtime.registerService('weather', createWeatherService());
```

## Common pitfalls

- Register the exact direct-domain name, not a colon-form topic or a convention URI.
- Check `message.type` for exact supported operations; validate each operation's payload.
- Keep INC out of service dispatch. Subscribe or emit through `window.napplet.inc` instead.
- Do not fabricate INC events or sender identity; only the authenticated runtime can deliver them.
- Implement `onWindowDestroyed` when the service keeps per-window state.
- Do not throw from `handleMessage`; return the domain's defined error result when applicable.
