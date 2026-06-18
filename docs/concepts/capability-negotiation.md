# Capability Negotiation

Kehto uses two complementary capability checks:

1. The NIP-5A manifest declares required NAPs through `requires`.
2. Hosted napplets call `window.napplet.shell.supports()` to check host capabilities at runtime.

Required capabilities should fail early at load time when unsupported. Optional capabilities should degrade gracefully inside the napplet.

Do not rely on static helper-package knowledge as the hosted contract. The shell should answer from the capabilities it actually provides.
