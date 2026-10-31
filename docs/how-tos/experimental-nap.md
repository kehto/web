# How-to: Build an experimental NAP

This guide takes a toy NAP, `x-echo`, from nothing to running in Paja and
the playground. You don't change any kehto package to do it. You write one
ES module and register it through public `@kehto/*` APIs.

Use this route for an **out-of-tree experiment**: a domain you want to try in
real napplets before anyone has specified it. If the domain is an
upstream-specified NAP (in the `napplet/naps` registry or an open draft), it
belongs in kehto itself. Follow the [NAP-LLM wiring](../llm.md) instead.

| | Out-of-tree experiment (this guide) | In-tree NAP ([NAP-LLM](../llm.md)) |
|---|---|---|
| Domain | `x-<name>`, reserved for experiments | Registry name such as `llm` |
| Capabilities | `x-<name>:<action>`, ACL extension decisions | Built-in bits in `@kehto/acl` |
| Where code lives | Your repo, one module | acl, runtime, services, shell, Paja, playground |
| Binding | Your factory, serialized into the prelude | Shell prelude factory |
| Registration | `ShellAdapter.extensions` / Paja `extensions` | Adapter hooks + `registerService` |

## Spec status

[NIP-5D](https://github.com/nostr-protocol/nips/pull/2303) and the web
projection ([`projections/web.md`](https://github.com/napplet/naps/blob/43cb3a4e855570ec4b90b9cc05f0c721e5ad0aab/projections/web.md)
at `napplet/naps` master `43cb3a4`) define discovery: a domain is available when
`window.napplet.<domain>` is present. [NAP-SHELL](https://github.com/napplet/naps/blob/43cb3a4e855570ec4b90b9cc05f0c721e5ad0aab/naps/NAP-SHELL.md)
lists exposed domains in `capabilities.domains` and answers `supports(domain)`
locally. Extensions follow both rules unchanged.

The checked specs don't define three things this guide relies on. Kehto treats
each one as a **spec gap** with a bounded local policy:

1. **Experimental domain naming.** Experiments must use the `x-` prefix. A domain
   can't be a registry or in-tree name (`RESERVED_NAP_DOMAINS`), and it can't be
   an `x-` alias of one, so `x-llm` and `x-relay` are rejected.
2. **Extension capabilities.** These are `x-<domain>:<action>`, owned by their
   own domain. They can't redefine a built-in capability (`llm:generate`, for
   example) and can't borrow another domain's capability.
3. **The unconfigured state.** The host-facing `getShellDomainState` reports
   `supported`, `unconfigured` or `disabled`. On the wire, advertisement stays
   binary.

## 1. Choose a domain and check it

```ts
import { validateExtensionDomain, validateExtensionCapability } from '@kehto/shell';

validateExtensionDomain('x-echo');                       // null: acceptable
validateExtensionDomain('x-llm');                        // 'x-llm aliases the reserved NAP domain llm'
validateExtensionCapability('x-echo:send', 'x-echo');    // null
```

## 2. Write the wire contract

`x-echo` has one request/result pair and one push:

| Direction | Type | Fields | Capability |
|---|---|---|---|
| napplet → shell | `x-echo.say` | `id`, `text` | `x-echo:send` |
| shell → napplet | `x-echo.say.result` | `id`, `text` or `error: { code, message }` | (same request) |
| shell → napplet | `x-echo.heard` | `text` | `x-echo:listen` |

## 3. Implement the extension module

The complete module is
[`tests/fixtures/experimental-nap/x-echo.js`](https://github.com/kehto/web/blob/main/tests/fixtures/experimental-nap/x-echo.js).
The skill template ships a byte-identical copy. It has five parts:

- **`service`**: a `ServiceHandler` whose descriptor name is the domain.
  `messageCapabilities` maps each inbound type to an own capability or `null`.
  `pushCapabilities` declares each outbound push type.
- **Push**: `context.sendToEligibleNapplet(windowId, { type: 'x-echo.heard', … })`
  uses the context that `onRegistered` received. The runtime delivers only
  declared types in the extension's own domain. Each push needs a live session,
  a domain grant, an unblocked identity, `x-echo:listen` and firewall admission.
- **`capabilities`**: labels and descriptions shown in the ACL panels.
- **`binding`**: a self-contained factory `(kit) => ({ … })`. The shell
  serializes it into the host-owned prelude to build `window.napplet['x-echo']`.
  It is never part of the signed artifact bytes. `kit.request`, `kit.send` and
  `kit.on` only produce or accept `x-echo.*` messages from the parent window.
  The result is frozen, and napplet code can't replace it.
- **`state`**: returns `unconfigured` until a prefix setting exists. While
  unconfigured, `say` answers `{ error: { code: 'not-configured' } }`.

```js
export function createEchoExtension({ getPrefix }) {
  return {
    domain: 'x-echo',
    service,             // ServiceHandler with messageCapabilities + pushCapabilities
    capabilities: [{ capability: 'x-echo:send', label: 'Echo send' }, { capability: 'x-echo:listen', label: 'Echo listen' }],
    binding: (kit) => ({ say: (text) => kit.request('say', { text }).then(/* … */), onHeard: (cb) => kit.on('heard', (m) => cb(m.text)) }),
    state: () => (getPrefix() ? 'supported' : 'unconfigured'),
  };
}
export default (paja) => createEchoExtension({ getPrefix: () => paja.settings.get('prefix') });
export const settings = [{ key: 'prefix', label: 'Echo prefix' }];
```

## 4. Run it in Paja

List the module in your Paja config. Paths are relative to the config file:

```json
{
  "targetUrl": "http://127.0.0.1:5173",
  "extensions": [
    { "module": "./x-echo.js", "settings": { "prefix": "echo: " }, "enabled": true, "deniedDTags": [] }
  ]
}
```

An entry is either a module path string (`"./x-echo.js"`) or the object form
above. Paja serves each module from its own origin at
`/__kehto/extensions/<n>.js` and imports it before the shell bridge starts. It
then validates the result with the shell extension policy. Here is what you see:

- `x-echo` appears in **Interfaces** with the same toggle as built-ins: yellow
  `⚠ x-echo` while unconfigured, plain once a prefix is saved, and off when
  clicked.
- **Extensions** renders the module's `settings`, and shows load failures such
  as a module that tries to claim `llm`.
- **ACL** gains `x-echo:send` and `x-echo:listen` toggles.
- **Messages** logs `paja.extension.loaded`, `paja.extension.error` and
  `paja.extension.configured`, alongside the `x-echo.*` traffic.
- `deniedDTags` withholds the domain from those targets through
  `resolveEnvironment`, and `--firewall-mode deny` drops its requests.

A module must be a browser ES module with no bare imports. Type-only JSDoc
imports from `@kehto/shell` are fine, as the fixture shows.

## 5. Run it in your own host (and the playground)

Any `ShellAdapter` host passes the same declaration:

```ts
import {
  createShellBridge, getShellExtensionBindings, prepareNappletSrcdoc, resolveShellEnvironment,
} from '@kehto/shell';
import { createEchoExtension } from './x-echo.js';

const hooks = { ...requiredAdapters, extensions: [createEchoExtension({ getPrefix: () => settings.prefix })] };
const bridge = createShellBridge(hooks); // throws ShellExtensionError on collisions

// Per frame: the same environment drives the prelude, isDomainAllowed and shell.init.
const environment = resolveShellEnvironment(hooks, identity);
iframe.srcdoc = prepareNappletSrcdoc(verifiedHtml, {
  domains: environment.capabilities.domains,
  extensions: getShellExtensionBindings(hooks.extensions, environment.capabilities.domains),
});
```

The playground does exactly this in `apps/playground/src/playground-extensions.ts`.
Its shell controls show the `x-echo` toggle and prefix field, and each napplet's
ACL panel lists the `x-echo` capabilities. It narrows per napplet through
`capabilities.resolveEnvironment`.

## 6. Test it

- **Unit**: drive `createShellBridge` with your extension. The pattern is in
  `tests/unit/experimental-nap.test.ts`. Assert advertisement, `shell.init`,
  request/response, the push, unconfigured → supported, ACL deny, firewall
  block, `resolveEnvironment` denial and collision rejection.
- **Browser**: start Paja with `startPajaServer({ options: { configPath } })` and
  call `window.napplet['x-echo']` inside `#napplet-frame`.
  `tests/e2e/experimental-nap.spec.ts` covers Paja and the playground.

## Security invariants

These hold for every extension and are covered by regression tests:

- Requests need a live, source-bound session, an unblocked identity, the
  declared capability, a domain grant and firewall admission. Denials are
  silent: kehto invents no error envelope.
- Responses stay pinned to the requesting source and domain. They are rechecked
  before send, and teardown or re-registration invalidates them.
- Pushes go only through the owning handler's context, only for declared
  `x-<domain>.*` types, and under the same checks.
- An extension receives its own messages and a narrow context (`resolveDTag`,
  `listWindowIds`, `hasCapability`, `sendToEligibleNapplet`). It never receives
  credentials, signer secrets, Paja LLM vault contents or other domains'
  messages.
- An extension can't shadow, alias or override a built-in, registry or in-tree
  domain or capability, or a `ShellAdapter.services` entry.

## Promote it

Once the experiment works, draft a `napplet/naps` proposal (see the
`kehto-experimental-nap` skill). When the NAP is accepted, move it in-tree under
its registry name and remove the `x-` module.

Related: [Register a service](./register-service.md) · [Language models (in-tree NAP)](../llm.md) ·
[Compatibility register](../compatibility.md)
