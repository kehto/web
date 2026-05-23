# How-to: Register a Service

Register services on the runtime before napplets start sending NUB messages.

```ts
import { createNotifyService } from '@kehto/services';

bridge.runtime.registerService('notify', createNotifyService({
  onChange: (items) => renderBadge(items.length),
}));
```

## Checklist

- Register under the NUB domain name: `identity`, `relay`, `keys`, `media`, `notify`, `theme`, `config`, `resource`, or host-specific extension.
- Keep host callbacks behind service options.
- Register before iframe navigation when the service is required by manifest `requires`.
- Tear down host-owned subscriptions when the shell bridge is destroyed.
