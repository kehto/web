# Alpha Status

kernl is an early toolkit and protocol kernel for implementing NIP-5D napplet
runtimes. It does not define one mandatory runtime policy for the ecosystem.
bench is the concrete reference developer runtime built from kernl; the
playground is a visualization and integration fixture.

## What Is Still Moving

- The NIP-5D specification is still under development.
- NAP contracts are not final.
- Capability names, `requires` declarations, injected-domain behavior, class
  posture, connect/resource behavior, and error envelopes may change.
- Package APIs may change to track the protocol.

## How To Use These Docs

Use kernl when you want to implement the current host-side shape of NIP-5D
napplet hosting: sandboxed iframe loading, gateway artifacts, capability
enforcement, service routing, and host-service tools. Use bench when you want to
exercise one concrete reference runtime.

Treat examples as implementation guidance for the current draft, not as a
promise that the protocol or packages are stable.

## Language Rule

When describing kernl, use:

- "a runtime toolkit"
- "an unopinionated protocol kernel"
- "host-side implementation tools"

When describing bench, use "the reference developer runtime". When describing
the playground, use "a visualization" or "an integration fixture".

Do not use:

- "the runtime"
- "the runtime half of the ecosystem"
- "the kernl reference runtime"
- "the playground reference runtime"
- wording that implies there will only be one napplet runtime
