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
