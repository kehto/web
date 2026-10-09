# Capability Negotiation

Kehto uses two complementary capability checks:

1. The current NIP-5D manifest declares required domains through `R` tags and optional integrations through `O` tags.
2. Hosted napplets check injected `window.napplet.<domain>` presence to confirm
   which required or optional domains the host exposed before authored code ran.

Required capabilities should fail early at load time when unsupported. Optional capabilities should degrade gracefully inside the napplet.

Do not rely on static helper-package knowledge as the hosted contract. The shell
should expose only the domains it actually provides, and napplet code should
treat absence of `window.napplet.<domain>` as unavailable.

Kehto normalizes these declarations to `manifest.requires` and
`manifest.optional`. The old `requires` wire tag is accepted only for legacy
aggregate manifests. Neither schema grants access through declarations.
