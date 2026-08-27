---
status: resolved
trigger: "Paja on GitHub Pages reports Blossom blocked-by-policy even after NAP-RESOURCE server-hint support shipped"
created: 2026-08-26
updated: 2026-08-27
---

# Paja Blossom server discovery

## Expected

Paja should resolve a canonical `blossom:sha256:<hash>` resource obtained from
an OUTBOX event without requiring a shell-wide upload-server override. The
request's explicit server hints remain first, followed by the event's explicit
Blossom server hints. Paja then uses hinted authors' and the event publisher's
BUD-03 kind-10063 server lists, the active shell user's published list, and
configured runtime fallbacks. This
read-side discovery must work independently of whether NAP-UPLOAD is enabled
and should reuse Paja's OUTBOX routing so NIP-65 relay selection remains
centralized.

## Actual

The deployed Pages configuration uses `upload.mode = "memory"`, has no explicit
upload servers, and disables upload discovery. `createPajaAdapter` consequently
does not create the Blossom upload runtime. The only existing kind-10063
discovery lives in that upload runtime, so NAP-RESOURCE receives no default
servers and rejects the request as `blocked-by-policy`.

## Reproduction

1. Open the deployed Paja GitHub Pages shell.
2. Load `/Users/sandwich/Develop/gbcolor-napplet`.
3. Let the napplet request a canonical Blossom ROM URL without explicit server
   hints.
4. Observe `resource.bytes.error` with `blocked-by-policy`.

The deployed `/paja/__kehto/config.json` currently contains an anonymous
identity, live relays, `upload.mode = "memory"`, `upload.servers = []`,
`upload.discoverServers = false`, and no target pointer Blossom servers.

## Confirmed root cause

- `packages/paja/src/browser-adapter.ts` creates `uploadRuntime` only for
  Blossom upload mode.
- Its resource default callback reads discovered servers only from that optional
  upload runtime.
- `packages/paja/src/browser-upload.ts` also returns early from identity refresh
  unless upload mode is Blossom.
- Therefore read-side BUD-03 discovery is accidentally controlled by the
  NAP-UPLOAD configuration.

This is separate from the resolved request-hint and published-package issues:
request-provided `servers` now reach the loader, but GBColor sends no such hint.

## Protocol authorities checked

- NAP-RESOURCE draft head
  `9511232f69313aa7953d110e35d32cc28d506f66`: explicit request servers are
  first, runtime/user defaults are second, and public fallbacks are third.
- NAP-OUTBOX PR 32 head
  `4589a8f9a16d8aa29b3740e2b3b0cdca11e0976e`: OUTBOX may depend on RESOURCE and
  may pre-resolve resource sidecars, but does not define lazy Blossom-server
  hints for arbitrary event authors.
- Blossom BUD-03 master
  `b5bd2801d1763aa635fc8fea7a76597e0eb18990`: kind 10063 is the ordered Blossom
  server list; clients should consult the relevant user's list before public
  fallback servers.

## Implementation policy

The author is the publisher of the event that carried the resource, not the
shell user. A bare NAP-RESOURCE request has no author field, so Paja will retain
bounded, per-window resource context when its OUTBOX query returns an event.
That context maps canonical Blossom URLs to event-local servers and the event
publisher. When the same window later asks NAP-RESOURCE for that URL, Paja will:

1. try request-provided and event-local server hints;
2. lazily query hinted authors' newest kind-10063 lists through the same
   verified OUTBOX router;
3. query the event publisher's newest kind-10063 list through that router;
4. query the active shell user's kind-10063 list through that router;
5. try explicit Paja runtime fallbacks.

This avoids speculative sidecar prefetch, so merely listing events does not
contact every resource host. It also avoids a Kehto-only NAP-RESOURCE wire
field: the service supplies the authenticated source `windowId` only as private
runtime context. The event context is collected for one-shot queries,
single-event reads, and subscriptions, so the discovery path does not depend on
which NAP-OUTBOX read delivered the ROM. `PAJA_UPLOAD_SERVERS` remains an
explicit fallback override, not a discovery prerequisite.

## Next action

Ship the verified source change, then confirm the released packages and Pages
deployment resolve GBColor's live ROM event without an upload-server override.

## Resolution

root_cause: Paja coupled read-side Blossom defaults to its optional upload
  runtime. With Pages configured for memory uploads, a canonical ROM URL had no
  server candidates even though the event publisher could advertise them.
fix: Retain bounded source-window context for Blossom references delivered by
  every event-returning NAP-OUTBOX read. Preserve explicit event hints first,
  then lazily query hinted authors and the verified event publisher for their
  newest BUD-03 kind-10063 list through the base NIP-65-aware router, query the
  active shell user's list through the same fanout, then use configured runtime
  fallbacks. Pass authenticated `windowId` as private resource-resolver
  context; user and publisher discovery remain functional without upload mode.
verification: `pnpm build`; `pnpm type-check`; `pnpm test:unit` (147 files,
  1716 tests); `pnpm docs:check`; `pnpm test:e2e` (84 tests); AI-slop 100/100.
files_changed: Paja OUTBOX/resource adapter and event resolver; Services
  source-scoped read/resource contexts; focused, integration, conformance, and
  browser tests; package/policy docs; changesets.
