# Summary

- `@kehto/runtime`: `Runtime.hasService(name)`; host-side `[KEHTO_UNROUTED_SERVICE_DOMAIN]` diagnostic. The service registry stays a creation-time copy and the host's object is never mutated (tested).
- `@kehto/shell`: `createShellBridge` binds its adapter to its runtime, so `buildShellCapabilities`, `resolveShellEnvironment` and `getShellDomainState` only count a declared service that is routed. Late adapter entries are withheld with `[KEHTO_SERVICE_NOT_REGISTERED]`.
- Paja: no source change; #442 already registers through the runtime. Added a unit regression for the signer-gated webrtc path.
- Docs: how-to section "Services that arrive late", package docs and READMEs, `docs/compatibility.md` entry, changeset (runtime and shell minor).

## Decisions a maintainer may want to overrule

- Withhold and warn rather than auto-register late adapter entries from inside the advertisement getters.
- `registerService()` alone still advertises nothing; the adapter entry stays the host's declaration.
- No wire error for a domain with no handler, per NIP-5D. A frame admitted before an unregister keeps its namespace and gets silence; hosts reload frames, as Paja does.
- A replaced handler object under the same name is not detected by the shell (name-level check only).
