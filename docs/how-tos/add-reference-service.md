# How-to: Add a Reference Service

Reference services live in `@kehto/services` and implement the runtime `ServiceHandler` contract.

## Steps

1. Check the owning NAP specification for the domain, message types, direction, and authorization requirements.
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

For a domain outside Kehto's built-in dispatcher, follow the explicit
[extension routing contract](/how-tos/register-service#domains-outside-the-built-in-dispatcher):
declare exact inbound `messageCapabilities`, provide source-bound domain policy,
and implement the browser binding in the host. Registration alone cannot expose
a new NAP. A private example without an owning NAP remains a host extension,
not a standardized protocol.
