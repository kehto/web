# Experimental NAP checklist

## Name

- [ ] `x-<name>`, lowercase, `a-z0-9` with single hyphens, at most 64 characters
- [ ] `validateExtensionDomain('x-<name>') === null` (rejects `llm`, `x-llm`, `x-relay`, …)
- [ ] The name doesn't duplicate a registry NAP in `napplet/naps` (if it does, implement that NAP in kehto instead)

## Contract

- [ ] Each request `x-<name>.<action>` has an `id` and a `.result` with the same `id`
- [ ] Results carry either the success fields or `error: { code, message }`
- [ ] Each push type is listed in `pushCapabilities`
- [ ] Each inbound type is listed in `messageCapabilities` (absent keys aren't routed)

## Capabilities

- [ ] Each capability is `x-<name>:<action>` and passes `validateExtensionCapability(cap, 'x-<name>')`
- [ ] Each one has a label and a description for ACL panels
- [ ] Any `null` mapping is justified in a code comment

## Implementation

- [ ] `service.descriptor.name === domain`
- [ ] The binding is self-contained (no outer variables) and uses only `kit.*`
- [ ] `state()` reports `unconfigured` until required settings exist
- [ ] Paja module: `export default (context) => createEchoExtension(...)` (from `templates/x-echo.js`); `export const settings = [...]`
- [ ] The module has no bare runtime imports (type-only JSDoc imports are fine), so the browser can load it raw

## Tests

- [ ] Unit: advertisement, `not-configured`, success, push, ACL denial, collision rejection
- [ ] Vitest is scoped to `*.test.ts`, so it does not collect the Playwright spec
- [ ] Paja Chromium spec: unconfigured toggle, settings save, `supported`, a round trip in `#napplet-frame`
