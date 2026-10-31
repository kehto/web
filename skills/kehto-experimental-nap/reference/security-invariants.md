# Security invariants for experimental NAPs

Kehto enforces these. Your extension must not try to work around them, and your
tests should prove that the behavior you depend on matches.

## Enforced by kehto

- **Source-bound sessions.** Messages route only from a registered, live frame.
  Identity comes from the host's creation-time registration, never from the
  message.
- **Blocked identities** get nothing: no requests and no pushes.
- **ACL.** Each declared `x-<domain>:<action>` capability is checked for the
  real source on every request, and again before every response and push.
- **Firewall.** The capability is the firewall `opClass`; block rules and
  `deny` policies drop the message.
- **Response pinning.** A response must be in your domain and goes only to the
  requesting window. It is dropped after re-registration, teardown or
  revocation.
- **Pushes** are delivered only for types you declared in `pushCapabilities`,
  only in your own domain, and only through your handler's own context. Your
  context can't send built-in pushes (`theme.changed`, `llm.delta`, …).
- **Trust boundary.** Your module runs in the host page (Paja or your shell),
  not in a napplet. Kehto protects napplets from it, but it does not sandbox it
  from the host. Ship only code you'd ship in the host itself.
- **One reply per request.** For `x-` domains the reply callback accepts
  exactly one `<type>.result`. Use `pushCapabilities` for anything else.
- **Scoped context.** Your context only sees windows granted your domain and
  answers `hasCapability` only for your own capabilities.
- **Collisions** throw `ShellExtensionError`: reserved domains, `x-` aliases of
  them, duplicate domains, `ShellAdapter.services` keys, built-in capability
  strings and other domains' capabilities.

## Your obligations

1. **No secrets cross into napplets.** Never put credentials, API keys, signer
   material, LLM vault contents, user pubkeys you were not asked for, or other
   domains' data into a response or push. Your service receives only its own
   messages and the narrow `ServiceRuntimeContext`.
2. **No shadowing.** Do not register your domain under a built-in name, and do
   not reimplement a built-in domain behind an `x-` name.
3. **No borrowed capabilities.** Use `null` only when the operation truly needs
   no grant. Otherwise use your own capability, never `relay:read` or similar
   as a stand-in.
4. **No invented denial envelopes.** On ACL or firewall denial, kehto sends
   nothing, and your code must not fake one. Errors in your own `.result`
   (`not-configured`, `invalid-request`) are fine because they are your contract.
5. **Validate every payload** in `handleMessage`; napplet input is untrusted.
6. **Keep the binding self-contained.** It is serialized into the prelude, so
   it can't close over secrets or module state.
