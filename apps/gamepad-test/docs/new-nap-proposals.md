# New NAP Proposal Guidance

Use this when a napplet feature appears to need a named NAP interface or a
numbered wire format that does not already exist.

Default answer: do not invent a new wire format inside this app. Use an existing
NAP surface, keep the behavior app-local, or open a proposal PR to
`https://github.com/napplet/naps` when the need is genuinely protocol-level.

## Decision Path

1. **Check existing NAPs first.** Read `docs/package-surfaces.md`, the relevant
   package README, and current `napplet/naps` specs. Current package domains are
   relay, identity, storage, inc, theme, keys, media, notify, config, resource,
   cvm, outbox, upload, intent, ble, webrtc, link, count, lists, serial, common,
   and dm. Prefer the highest-level domain that owns the intent.
2. **Classify the need.** If it is only UI state, app business logic, a local
   helper, or one app's private convention, keep it in app code. It is not a NAP.
3. **Try composition.** Combine existing NAPs before adding a new one. Examples:
   use `config` for user-editable settings, `storage` for durable app state,
   `resource` for read-only external bytes, `outbox` for normal social reads and
   publishes, and `inc` for inter-napplet events that do not need a new
   shell-mediated protocol.
4. **Prototype without wire authority.** If a shape is uncertain, write a local
   adapter or exploratory doc. Do not assign a NAP name, number, or shell
   conformance language yet.
5. **Open a NAP PR only when required.** When the feature needs a new
   shell-mediated capability, cross-shell interoperability, or a reusable
   napplet-to-shell contract, propose it in `napplet/naps`.

## PR Threshold

Open a PR to `https://github.com/napplet/naps` only when all of these are true:

- Existing NAPs cannot express the behavior without semantic abuse.
- The capability crosses the napplet/shell boundary.
- At least two independent napplet or shell implementations could use the same
  contract.
- The shell must enforce, authorize, persist, route, or mediate something the
  napplet cannot safely own.
- The proposal has clear failure modes, lifecycle rules, and graceful
  degradation behavior.
- The proposal can name its security and privacy boundary in one paragraph.

If any item is false, keep the work out of the NAP repo for now.

## Superfluous Wire Format Guardrails

Do not submit a new wire format for:

- App-local UI events.
- Convenience wrappers over existing SDK calls.
- Payloads that can stay inside relay events, storage records, or config values.
- One-off integrations with a single endpoint or shell.
- Experiments whose lifecycle, security boundary, or implementer audience is
  still unclear.
- A desire for nicer naming when an existing NAP already owns the semantics.

Do not allocate a new name, number, or message domain in this repository. Names
and numbers belong in `napplet/naps` after review.

## What A Good NAP PR Contains

A useful PR to `napplet/naps` should include:

- Problem statement and non-goals.
- Why existing NAPs are insufficient.
- Named interface or numbered wire-format identifier being proposed.
- Napplet-to-shell and shell-to-napplet message shapes, if wire is required.
- Domain operations, payload compatibility, and fallback behavior.
- Security, privacy, and consent model.
- Lifecycle rules: startup, teardown, retries, idempotency, and error handling.
- Compatibility notes for shells that do not implement it.
- Minimal examples from both napplet and shell perspectives.

Keep the first PR as small as possible. Prefer one capability with a tight
contract over a broad bundle of loosely related messages.

## Boilerplate Rule

This boilerplate may use a living proposed NAP when its canonical proposal
defines the surface and published `@napplet` packages expose it; cite the open
proposal instead of implying final acceptance. It must not ship runtime code
that depends on invented, withdrawn, or deferred surface. Until both a living
proposal and package support exist, keep experiments behind local adapters and
avoid naming them as supported protocol features.
