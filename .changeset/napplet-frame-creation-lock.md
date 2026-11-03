---
"@kehto/shell": minor
"@kehto/paja": minor
---

Add an experimental, opt-in lock that prevents a napplet from creating a nested
browsing context (iframe/frame/object/embed/portal/fencedframe). Off by default,
so downstream hosts are not forced into its opinions.

Establishes a Kehto **experimental namespace** convention (see
`docs/policies/EXPERIMENTAL.md`): opinionated host policies that are off by
default, namespaced under an `experimental` options object, unstable (may change
without a major bump), and distinct from the NAP `x-` extensions (which are
experimental protocol domains). `NappletExperimentalOptions.nestedContextLock`
is its first member.

When a host sets `experimental: { nestedContextLock: true }` (on
`prepareNappletSrcdoc` / `NappletSrcdocOptions`, or the Paja host config):

- The verified napplet srcdoc CSP carries
  `require-trusted-types-for 'script'; trusted-types default`, and the prelude
  registers the single admitted `default` Trusted Types policy before any napplet
  script. It passes canonical HTML through and rejects any string carrying a
  frame tag, closing `innerHTML`, `DOMParser`, `document.write` and the other
  string sinks.
- The prelude pins `Document.prototype.createElement` / `createElementNS` and
  `DOMImplementation.createDocument`, non-configurable, to reject frame tag
  names — the only element factories on the platform.
- The new `assertNappletHasNoFrame` / `nappletMarkupHasFrame` reject a napplet
  whose own static markup declares a frame; `@kehto/paja` runs that scan on the
  verified runtime-pointer path, fail-closed.

The lock is opinionated: it requires Trusted Types in the napplet CSP (so it is
incompatible with frameworks that register their own Trusted Types policy, e.g.
Angular) and a string sink carrying a literal frame-tag token is rejected even
in text or an attribute. Canonical string-sink use is unaffected (the default
policy passes non-frame HTML through). The contract change is tracked as
`NIP5D_TRUSTED_TYPES_REQUIRED` in docs/compatibility.md and applies only to hosts
that opt in. The new `nappletMarkupHasFrame` / `assertNappletHasNoFrame` exports
and the `experimental` option are always available; nothing changes for existing
hosts that do not set the flag.
