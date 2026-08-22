# Alpha Status

Kehto is an early toolkit and protocol kernel for implementing NIP-5D napplet
runtimes. It does not define one mandatory runtime policy for the ecosystem.
Paja is the concrete reference developer runtime built from Kehto; the
playground is a visualization and integration fixture.

## What Is Still Moving

- The NIP-5D specification is still under development.
- NAP contracts are not final.
- Capability names, `requires` declarations, injected-domain behavior, class
  posture, connect/resource behavior, and error envelopes may change.
- Package APIs may change to track the protocol.

## How To Use These Docs

Use Kehto when you want to implement the current host-side shape of NIP-5D
napplet hosting: sandboxed iframe loading, gateway artifacts, capability
enforcement, service routing, and host-service tools. Use Paja when you want to
exercise one concrete reference runtime.

Treat examples as implementation guidance for the current draft, not as a
promise that the protocol or packages are stable.

## Language Rule

When describing Kehto, use:

- "a runtime toolkit"
- "an unopinionated protocol kernel"
- "host-side implementation tools"

When describing Paja, use "the reference developer runtime". When describing
the playground, use "a visualization" or "an integration fixture".

Do not use:

- "the runtime"
- "the runtime half of the ecosystem"
- "the Kehto reference runtime"
- "the playground reference runtime"
- wording that implies there will only be one napplet runtime
