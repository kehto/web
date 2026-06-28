# Alpha Status

Kehto is an early runtime implementation for NIP-5D napplets. It is not *the*
runtime for the napplet ecosystem, and it should not be described as the only
runtime. It is currently the first known implementation and may become a useful
reference implementation for other runtimes.

## What Is Still Moving

- The NIP-5D specification is still under development.
- NAP contracts are not final.
- Capability names, `requires` declarations, injected-domain behavior, class
  posture, connect/resource behavior, and error envelopes may change.
- Package APIs may change to track the protocol.

## How To Use These Docs

Use Kehto when you want to experiment with the current host-side shape of
NIP-5D napplet hosting: sandboxed iframe loading, gateway artifacts,
capability enforcement, service routing, and reference host services.

Treat examples as implementation guidance for the current draft, not as a
promise that the protocol or packages are stable.

## Language Rule

When describing Kehto, use:

- "a runtime implementation"
- "an early runtime"
- "the first known implementation"
- "a potential reference implementation"

Do not use:

- "the runtime"
- "the runtime half of the ecosystem"
- wording that implies there will only be one napplet runtime
