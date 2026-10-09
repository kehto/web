# How-to: Handle Unsupported Requires

Current NIP-5D manifests declare required domains with repeated `R` tags and
optional integrations with repeated `O` tags. Kehto normalizes these to
`manifest.requires` and `manifest.optional`. The old `requires` wire tag is
supported only by the legacy aggregate-manifest compatibility parser.

## Steps

1. Resolve and verify the NIP-5D manifest.
2. Read the complete normalized required-domain set (`R`).
3. Compare it with the host-resolved environment for this napplet; `shell` is mandatory.
4. Reject loading or show a clear compatibility warning before treating the napplet as usable.

```ts
const unsupported = manifest.requires.filter(
  (name) => name !== 'shell' && !environment.capabilities.domains.includes(name),
);

if (unsupported.length > 0) {
  showCompatibilityWarning(unsupported);
  return;
}
```

Do not load a napplet and then silently fail required NAP calls. Optional
features should check the matching injected `window.napplet.<domain>` before
using a NAP helper.

Missing `O` domains must not prevent loading. Neither `R` nor `O` grants access;
the host decides which domain objects to inject.
