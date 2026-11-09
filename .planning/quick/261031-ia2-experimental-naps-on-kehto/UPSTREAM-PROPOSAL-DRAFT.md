# DRAFT (not filed): napplet/naps — experimental domains and a not-configured state

Target: `napplet/naps` README "Registry & governance" and `projections/web.md`.
Checked against master `43cb3a4e855570ec4b90b9cc05f0c721e5ad0aab`.

## Problem

Runtimes and napplet authors want to try a capability before it has a registry
entry. Today they must either pick a bare domain name, which risks colliding
with a future registry domain, or keep the experiment private. Separately,
hosts expose some domains whose backend needs user setup first (for example a
model connection for `llm`). The specs have no word for "exposed but not yet
usable", so each NAP invents its own first-call error.

## Proposal 1 — reserved `x-` prefix for experimental domains

- Domains beginning with `x-` are reserved for experiments and are never assigned
  by the registry.
- An `x-` domain MUST NOT be `x-<registered domain>`, so `x-relay` is not an
  alias of `relay`.
- Discovery is unchanged: presence of `window.napplet.<domain>` in the web
  projection, plus `capabilities.domains` and `supports(domain)` in NAP-SHELL.
- An experiment that graduates is re-specified under a registry domain. Runtimes
  SHOULD NOT advertise both names for the same contract.
- Runtime authorization for experiments is runtime-defined. Kehto uses
  `x-<domain>:<action>` grants that cannot reuse other domains' grants.

## Proposal 2 — `not-configured` interface state

- A runtime MAY expose a domain whose backend still needs user configuration.
- Operations that need the missing configuration SHOULD fail with error code
  `not-configured` and a human-readable message, rather than a generic error.
- Wire advertisement stays binary (the domain is present). The configured or
  not-configured distinction is a host UI concern, and napplets learn it from
  the error.

## Kehto prior art

Kehto PR (this branch) implements both as bounded local policy:
`ShellAdapter.extensions`, `RESERVED_NAP_DOMAINS`, `validateExtensionDomain`,
`getShellDomainState → supported | unconfigured | disabled`, and the `x-echo`
fixture. See `docs/how-tos/experimental-nap.md`.
