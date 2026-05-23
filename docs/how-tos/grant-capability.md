# How-to: Grant a Capability

Use this when a napplet has loaded and the host wants to allow a specific action.

## Steps

1. Resolve the session identity.
2. Confirm the capability is supported by the host.
3. Grant the capability on runtime ACL state.
4. Persist according to host policy.

```ts
const entry = bridge.runtime.sessionRegistry.get(windowId);
if (!entry) throw new Error(`No session for ${windowId}`);

bridge.runtime.aclState.grant(
  entry.pubkey,
  entry.dTag,
  entry.aggregateHash,
  'relay:write',
);
```

Use capability names from `@kehto/acl` and package docs. Grant only what the manifest requires or the user explicitly accepted.
