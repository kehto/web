# Paja NAP-DM and NAP-FS implementation authority

## Goal extension

The Paja advertised-domain closeout now includes `dm` and `fs`. A domain is
complete only when Paja conditionally registers it over a real runtime-owned
backend, the injected NIP-5D API matches the authoritative wire contract, ACL
and lifecycle boundaries are enforced, backend effects are observed by tests,
and unavailable or fixture-only configurations omit the domain entirely.

## Exact specification authority

- NAP-DM: `napplet/naps` PR #74, head
  `a0a48588b3c9caca9540cccec19635b85231a00f` (`naps/NAP-DM.md`).
- NAP-FS: `napplet/naps` PR #88, head
  `b640cf337c0481f0f9a0216c00843f797a5c6df6` (`naps/NAP-FS.md`).
- Packaged wire types: `@napplet/core@0.31.1` and `@napplet/nap@0.31.2`.

Both specifications are open drafts. Their exact heads are the working
authority under Kehto's bleeding-edge policy; PR state is not a blocker.

## Baseline

### DM

Kehto already has a generic `createDmService`, NIP-17/NDR/Cordn adapters, DM ACL
mapping, runtime dispatch, and an injected `window.napplet.dm` projection. Paja
does not register a DM service. The NIP-17 adapter performs real signing,
encryption, relay publication, and live unwrap, but its normalized store is an
in-memory cache and it is not wired to Paja's live relay/signer lifecycle.

### FS

The installed Napplet packages expose the complete NAP-FS napplet API and wire
types, but Kehto has no FS runtime handler, ACL mapping, shell projection,
reference service, or Paja backend. Paja explicitly defers and omits `fs`.

## Required DM proof

1. Register `dm` only when a live relay backend and a real NIP-17-capable Paja
   signer/key boundary are available; removing either removes advertisement.
2. Keep secret keys, NIP-44 plaintext/encryption, NIP-59 wrapping, raw relay
   state, and storage handles outside the napplet.
3. Validate recipients, encrypt and sign real kind-14 rumors/kind-13 seals/kind-
   1059 gift wraps, publish through configured live relays, and retain a sender
   copy so relay persistence can reconstruct history.
4. Fetch/decrypt persisted relay history into a normalized cache before serving
   conversations/messages, deduplicate events, validate signatures and sender
   identity, and expose only NAP-DM result shapes.
5. Scope subscriptions to their owning window, never fan out a subscription
   through another window, return one same-ID result per request, and clean
   relay subscriptions on unsubscribe/window destruction/service disposal.
6. Error results omit success fields; `dm.message` has a subscription id and no
   request id. Unknown messages remain silent.

## Required FS proof

1. Register `fs` only when a real browser filesystem backend exists. Paja uses
   origin-private file storage for its durable virtual root; picker operations
   use real browser File System Access handles when those APIs are present.
2. Expose virtual absolute paths only. Reject empty segments, `.`, `..`, control
   and bidi formatting characters, backslashes, host paths, file URLs, and
   normalization/case collisions before authorization.
3. Keep host paths, native handles, storage implementation, mount identifiers,
   usernames, device names, and provider details out of `info`, picker results,
   metadata, errors, and change events.
4. Enforce independent read/write/create/delete/list/watch policy on the
   runtime-bound napplet identity and final resolved object for every operation.
   Picker hints never grant authority.
5. Implement info, four pickers, stat, list, range read, atomic replace/append/
   patch writes, revision/absence preconditions, mkdir, removal, move, watch,
   unwatch, and scoped `fs.changed` pushes.
6. Accept only canonical RFC 4648 padded base64 and count decoded bytes. Enforce
   read/write/watch/in-flight limits and return the closed NAP-FS error set.
7. Successful responses omit `error` and include all success fields; failures
   include `error` and omit success fields. Every request gets exactly one
   same-ID result; pushes have no request id.
8. Clean watches, picker grants, and backend resources by window and on service
   disposal. A watch id from another window is indistinguishable from unknown.

## Cross-surface closure

- Add `fs:read` and `fs:write` ACL capabilities without reusing persisted bits.
- Wire runtime dispatch, shell live-domain resolution, injected FS projection,
  Paja service registration, capability controls, parity declarations, tests,
  docs, and package changesets together.
- Extend the existing PR rather than claiming completion from service-only or
  wire-only code.

