# How-to: Handle Unsupported Requires

Use manifest `requires` as the load-time compatibility contract.

## Steps

1. Fetch the NIP-5A manifest.
2. Parse required NAP names.
3. Compare them with shell capability inventory.
4. Reject loading or show a clear compatibility warning before treating the napplet as usable.

```ts
const unsupported = manifest.requires.filter(
  (name) => !bridgeSupports(name),
);

if (unsupported.length > 0) {
  showCompatibilityWarning(unsupported);
  return;
}
```

Do not load a napplet and then silently fail required NAP calls. Optional features should use hosted `supports()` checks inside the napplet.
