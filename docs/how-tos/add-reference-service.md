# How-to: Add a Reference Service

Reference services live in `@kehto/services` and implement the runtime `ServiceHandler` contract.

## Steps

1. Pick the domain name and message types.
2. Implement host behavior behind options or bridge interfaces.
3. Return a `ServiceHandler`.
4. Export the factory and option types from `packages/services/src/index.ts`.
5. Register the service in the host.

```ts
bridge.runtime.registerService('config', createConfigService({
  getValues: () => currentValues,
  registerSchema: (schema) => schemas.set(schema.id, schema),
  openSettings: () => openSettingsPanel(),
}));
```

Keep runtime dispatch generic. Do not special-case service behavior inside the shell bridge.
