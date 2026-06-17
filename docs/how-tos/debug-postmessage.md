# How-to: Debug postMessage Traffic

Use this when a napplet appears loaded but no NAP request or response is visible.

## Checklist

1. Confirm the iframe uses `sandbox="allow-scripts"` without `allow-same-origin`.
2. Confirm the shell registered the iframe source before message handling.
3. Confirm messages are plain objects with a string `type`.
4. Confirm `MessageEvent.source` matches a registered iframe window.
5. Confirm ACL grants exist for the requested capability.
6. Confirm the target service is registered.

## Temporary trace

Add a temporary listener in a local debug branch:

```ts
window.addEventListener('message', (event) => {
  console.debug('[napplet message]', {
    source: event.source,
    origin: event.origin,
    data: event.data,
  });
});
```

Remove debug traces before shipping. Source validation and ACL denial behavior should be tested, not bypassed.
