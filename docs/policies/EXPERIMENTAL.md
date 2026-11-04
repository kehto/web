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

### In `@kehto/shell` (library embedders)

`prepareNappletSrcdoc` takes a boolean per flag — the resolved decision for one
napplet:

```ts
const srcdoc = prepareNappletSrcdoc(verifiedHtml, {
  domains,
  experimental: { nestedContextLock: true },
});
```

### In Paja (developers)

Paja is the usual place a developer turns a policy on or off, so its setting is
a tri-state rather than a bare boolean:

| Value | Behavior |
|-------|----------|
| `on` | Always apply the lock. |
| `off` | Never apply it. |
| `auto` (default) | Apply it only to a napplet granted a **privacy-sensitive** NAP domain, where exfiltration by an untrusted app has real consequences. |

Privacy-sensitive domains today: **`dm`** (NAP-DM — decrypted direct messages).
The set is intentionally small and lives in `@kehto/paja`
(`resolveNestedContextLock`).

```bash
# CLI
kehto paja --target-url http://127.0.0.1:5173 --nested-context-lock on
```

```json
// paja config file (--config)
{ "experimental": { "nestedContextLock": "auto" } }
```

```ts
// programmatic runtime-pointer host config
const config = createPajaRuntimeHostConfig({
  experimental: { nestedContextLock: 'auto' },
});
```

Paja resolves `auto` per napplet at load time against the domains the host
actually grants, so a messaging napplet gets the lock while a plain viewer does
not, without the developer choosing per app.

#### GUI switch (deployed runtime)

A deployed Paja runtime cannot be reconfigured by a CLI flag, so its host-page
Security sidebar carries a **Frame-creation lock** control (Host default / Auto /
On / Off). The choice persists in that host origin's `localStorage` and applies
on the next napplet load. Precedence: a GUI choice wins over the serialized host
config; "Host default" clears the override and defers to the config (CLI /
config file / `auto`). Turning the lock off for a private-data napplet lowers its
exfiltration protection, which the control states inline.
