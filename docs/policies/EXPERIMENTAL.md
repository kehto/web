# Experimental namespace

Kehto's **experimental namespace** is a convention for opinionated, opt-in host
policies that are not part of the NIP-5D baseline. It lets Kehto explore
solutions without imposing them on downstream consumers.

## Rules of the convention

- **Off by default.** Enabling a policy is a deliberate host choice. Nothing in
  the experimental namespace changes behavior unless a host opts in.
- **Namespaced.** Policies live under an `experimental` options object
  (`NappletExperimentalOptions` in `@kehto/shell`, surfaced on
  `prepareNappletSrcdoc`/`NappletSrcdocOptions` and on Paja's host config), each
  a named boolean key.
- **Unstable.** An experimental policy may change behavior or be removed without
  a major version bump. Hosts should treat it as provisional.
- **Documented cost.** Each policy documents what it changes and what it may
  break, because experimental policies are opinionated by design.
- **Tracked.** A policy that changes the napplet execution contract records a
  `docs/compatibility.md` entry describing the contract change, conditioned on
  opt-in.

## Not the same as NAP `x-` extensions

The NAP `x-` extensions (`ShellAdapter.extensions`) are experimental *protocol
domains* a napplet negotiates and calls. The experimental namespace is for host
*hardening and behavior policies* that a napplet does not speak to and cannot
negotiate. Keep the two separate: a new protocol capability is an `x-` NAP; a new
opinionated host policy is an experimental flag.

## Current policies

| Flag | Package(s) | What it does | Cost |
|------|------------|--------------|------|
| `nestedContextLock` | `@kehto/shell`, `@kehto/paja` | Prevents a napplet from creating any nested browsing context (iframe/frame/object/embed/…): a Trusted Types `default` policy plus pinned element factories reject frame elements in the realm, and the host rejects static frame markup before load. See [NIP-5D conformance](./NIP-5D-CONFORMANCE.md#nested-browsing-contexts). | Requires Trusted Types in the napplet CSP (`NIP5D_TRUSTED_TYPES_REQUIRED` in [compatibility](../compatibility.md)); incompatible with frameworks that register their own Trusted Types policy (e.g. Angular); a string sink carrying a literal frame-tag token is rejected even in text or an attribute. |

## Enabling a policy

```ts
// @kehto/shell
const srcdoc = prepareNappletSrcdoc(verifiedHtml, {
  domains,
  experimental: { nestedContextLock: true },
});

// @kehto/paja host config
const config = createPajaRuntimeHostConfig({
  experimental: { nestedContextLock: true },
});
```
