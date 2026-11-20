# NIP-5D Conformance Policy

Status: active for current NIP-5D conformance guardrails.

Authoritative NIP-5D source:
`https://github.com/nostr-protocol/nips/pull/2303/`

Port-bound identity transport: `nostr-protocol/nips#2303` at
`51ef0cd33a5694784306f3260d90b1872545fdee`; see
[Port-bound identity transport](#port-bound-identity-transport).

Current injected-domain clarification:
`https://github.com/dskvr/nips/pull/4` (merged into the NIP-5D branch behind
PR #2303 on 2026-06-26)

Repo-local pointer: `specs/NIP-5D.md`

## Authority

Only the current upstream NIP-5D PR defines the core NIP-5D contract. Kehto's
repo-local spec file is intentionally a pointer so stale mirrors do not become
implementation authority. `RUNTIME-SPEC.md` is internal runtime guidance.

### Published convention authority

- **NAP-INTENT:** draft PR #106 `napplet/naps@fc121fc264615482143eda86125863d2e1f741a2` (the working authority for this implementation).
- **NAP-INC:** merged `napplet/naps` master
  `377bf939c6c906817084b43dd21d424de646dbc2`.
- **NAP-IDENTITY / NAP-THEME / NAP-SHELL:** merged `napplet/naps` master
  `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`.
- **NAP-RELAY:** open PR #2 at
  `0be8abce18beb46ca37bd4ddd042f58d30b4eedc`.
- **Published packages:** NAP-INTENT authority
  `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`; napplet/web#199 source
  `3037200c932488f14f7f369b8583c39c9c16510a`, merged as
  `b3f0007867eac109fa4917fac9c285d3b7cc6155`; and Version Packages #198 head
  `a79e7f4638f70f4557d4183faee9348847bb8cc7`, merged as release source
  `dc1d24153c759152b6ba31a6ec9bea967798f2df`. The exact fixture-napplet line is core
  `0.32.0`, nap `0.32.0`, shim `0.30.0`, SDK `0.28.0`, and Vite plugin `0.16.2`; host
  packages develop on core `0.45.0` and nap `0.45.0`.

### Current event schema and retained compatibility

Checked NIP-5D `dskvr/nips@020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7/5D.md`
and NAP-INTENT/NAP-SHELL at
`napplet/naps@a040914b4bbd3a5cd8a14b0f316a723c968ebfb2`. Current writer source:
`napplet/web@831d3dd5056b84bc03982966279ed8b9167152f8` (Vite plugin 0.15.0);
the adopted writer is Vite plugin 0.16.2 from
`napplet/web@f6839146afda77944d12ecdc371630905c9474f6`.
The schema was rechecked at `dskvr/nips@6e24617cde507c0a87fa170af9ed6b2b46545b2d`
for the source and presentation media amendments; see
[Source pins and presentation media](#source-pins-and-presentation-media).
Current `x` artifact hashes, `content`, `z`/`i`, and `R`/`O` are authoritative.
Legacy `path`/aggregate events remain a temporary compatibility extension,
isolated in `packages/nip/src/5d/legacy-manifest.ts`. Never retry malformed current
events through that adapter. Keep paired-schema tests until it is removed.
See [migration and removal policy](../migrations/NIP-5D-EVENT-SCHEMA.md).

### Legacy path collisions

Checked NIP-5D at `nostr-protocol/nips#2303` head
`f60550c3409d6d81a875088ec83e660571e10504`, which has no `path` schema: "A
napplet is a single self-contained `/index.html`" with "exactly one `x` tag".
NIP-5A at `nostr-protocol/nips@bec0fc89e75645e77a06d145598246efca844457` only
says "The host server SHOULD look for a `path` tag where the second element
matches the requested path" and "MUST fall back to using the `index.html`
filename" for a request without one. Neither text covers duplicate `path`
tags, so this is a bounded Kehto policy for the legacy adapter (kehto/web#525):

- The legacy parser (`assertUniquePaths` in
  `packages/nip/src/5d/legacy-manifest.ts`) refuses with `invalid-manifest` any
  event whose `path` entries collide after canonicalisation. The only aliasing
  the resolver applies is `/`, `index.html` and `/index.html` as the entry
  document; every other path compares exactly.
- `resolveNapplet` checks again before fetching, so its file map and its
  index lookup use one key per entry. Kehto never picks one of two colliding
  entries. Otherwise readers of the first entry would see bytes other than the
  ones the host runs.
- Current single-artifact events carry one synthesized `/index.html` entry and
  never reach this branch.

### Shell CSP enforcement

CSP authority is [NIP-5D at
`24711d9c47bbdd07908bf1d52bf677d9cbc530f0`](https://github.com/dskvr/nips/blob/24711d9c47bbdd07908bf1d52bf677d9cbc530f0/5D.md).
The composition was also checked against [NAP-SHELL on master at
`a040914b4bbd3a5cd8a14b0f316a723c968ebfb2`](https://github.com/napplet/naps/blob/a040914b4bbd3a5cd8a14b0f316a723c968ebfb2/naps/NAP-SHELL.md).
CSP is a NIP-5D web-binding concern; it adds no NAP domain, message, or permission.

`@kehto/shell` owns CSP preparation. Paja's admitted verified and development
launches use `admitBrowserDocument` with the closed approved-browser policy;
`prepareNappletSrcdoc` remains the preparation API for other hosts.
The Paja policy was checked against NIP-5D draft PR 2303 at
`5560820fa4f37f45b8ab742a11aeb3001b17dc67`. On the admitted path,
explicit `csp.connectOrigins` entries become exact network approval requests;
relay and Blossom hints do not grant iframe network access, and legacy
`csp.directives` overrides are not applied. The table below describes the
`prepareNappletSrcdoc` API.

| Requirement | Shell treatment | Host choice |
| --- | --- | --- |
| CSP first in head before authored resources (SHOULD) | Enforced by preparation, without searching authored comments/scripts for insertion points | No opt-out on this path |
| Exact granted connection origins; avoid wildcard/scheme-wide sources (MAY/SHOULD) | Explicit HTTP(S)/WS(S) origins only; normalize, deduplicate, validate | Grant origins; narrow `connect-src`, including `'none'` |
| No broad `'unsafe-eval'` merely for WASM (MUST NOT) | Always rejected as Kehto policy | Keep or remove the default `'wasm-unsafe-eval'` |
| Verify artifacts before policy injection, exclude injection from hashes (MUST) | Reference hosts resolve and verify before preparing a rendered copy | Keep original verified bytes and identity; preparation does not authenticate raw HTML |
| Namespace before authored scripts (MUST) | CSP then mandatory bootstrap; reject script overrides that suppress its inline execution | Choose optional domains and compatible script directives |
| Conservative example source lists | Shared defaults; not promoted wholesale to protocol MUSTs | Override supported directives for styles, images, media and other resources |
| Meta cannot enforce `frame-ancestors`, `sandbox`, `report-uri` | Reject unsupported directive names; omit ineffective directives | Set appropriate HTTP response headers and the required iframe sandbox attribute |

Existing authored CSP is preserved as an additional restriction. An inherited
host response policy can also restrict `srcdoc`; the shell cannot relax it.
The inline bootstrap currently requires `'unsafe-inline'` in `script-src` and
any explicit `script-src-elem`, without overriding nonce/hash/`strict-dynamic`
expressions. `script-src-attr` may independently deny inline event handlers.

Low-level namespace render/injection utilities do not apply CSP. Paja's
target-URL development wrapper is now admitted using its normalized URL and
fetched artifact hash as an unsigned identity. Verified production hosts must
verify bytes and source identity before either CSP preparation entry point.

### Resource host projection exception

`RESOURCE_HOST_PROJECTION` applies to Kehto-owned resource consumers, including
test fixtures. They use the
`window.napplet.resource` binding injected by Kehto before authored scripts.
They must not import `@napplet/shim@0.30.0`, whose resource helper replaces that
binding and sends the retired object-form `requests` payload.

The working authority is [NAP-RESOURCE PR #80 at
`ae5b9c64ab8a4d8909f288829a01e99d6bd713bc`](https://github.com/napplet/naps/blob/ae5b9c64ab8a4d8909f288829a01e99d6bd713bc/naps/NAP-RESOURCE.md).
Bulk wire requests use ordered `urls`; wire results carry canonical padded
base64, which the web binding validates and converts to `Blob`. Consumers call
that binding rather than creating a separate message receiver or wire adapter.
This is a bounded dependency-drift exception, not permission to weaken the
runtime contract. Reintroduce the packaged binding only after it preserves this
contract and the real browser regression remains green.

`tests/unit/nip5d-conformance-guard.test.ts` registers this exception and prevents
the stale import from returning. `tests/e2e/nap-resource.spec.ts` proves the
actual injected API, runtime service, bulk bytes, and image rendering together;
static source assertions alone do not prove this path works. Resource exposure
still requires the host isolation work tracked in the Firewall migration.

### Direct WebRTC egress

Spec-gap decision (defense-in-depth beyond the current NIP-5D text). No CSP
directive covers WebRTC: `connect-src 'none'` does not stop `RTCPeerConnection`,
so an opaque-origin napplet can open a data channel and exfiltrate with no
policy recourse. Validated by [napplet/evil](https://github.com/napplet/evil)
finding #1 and described in [Delta Chat's webxdc security
write-up](https://delta.chat/en/2023-05-22-webxdc-security). The proposed W3C
`webrtc` CSP directive (`block`/`allow`) is not reliably implemented and is not
enforceable from a `<meta>` policy, so CSP cannot close this today.

Kehto's injected prelude removes the whole WebRTC constructor surface from the
napplet realm before any napplet script runs: every global whose name starts
with `RTC` (`RTCPeerConnection`, `RTCDataChannel`, `RTCSessionDescription`,
`RTCIceCandidate`, `RTCRtp*`, …) plus the legacy `webkit`/`moz`-prefixed aliases,
each set to a non-writable, non-configurable `undefined`. NAP-WEBRTC is unaffected: its `RTCPeerConnection`
runs in the shell realm (`packages/paja/src/browser-webrtc.ts`), and the napplet
reaches it only through the mediated `window.napplet.webrtc` domain, never the
raw constructor.

Bounded limitation, not yet closed: nested browsing contexts. The napplet CSP
already carries `child-src 'none'` and `frame-src 'none'`, which block every
fetched child frame (`data:`, `blob:`, `http(s):`), but `about:srcdoc` and
`about:blank` documents involve no navigation request, so those directives never
apply to them. This is the same browser behaviour the host-page `frame-src`
lock (`NAPPLET_FRAME_POLICY`) relies on to let the verified napplet `srcdoc`
load. A `srcdoc` or `about:blank` grandchild therefore loads, inherits the
napplet CSP (which has no WebRTC directive), and runs in a fresh realm the
prelude sweep never touched, so it has a working `RTCPeerConnection`. Measured
in Chromium 147 with the napplet CSP in place: a `data:` grandchild is blocked
with a `frame-src` violation, while a `srcdoc` grandchild loads and
`createDataChannel()` succeeds (napplet/evil finding #9).

Upstream fix: a shipped `webrtc` CSP directive. Unlike the prelude sweep, an
inherited CSP reaches every `srcdoc` and `about:blank` descendant, so it is the
only mechanism that closes the nested-realm case for good. Kehto cannot ship
it; browsers have to. Per-napplet process isolation is not an end state for a
web shell: a page cannot request process placement, and giving each napplet its
own origin to obtain it would make the serving origin the identity authority
again, contradicting `srcdoc` provenance and content-addressed identity. A
process-wide control (the Chromium per-process connection cap) is also ruled
out: napplet frames share it with the shell's own NAP-WEBRTC and it is not
reliably reclaimable.

Kehto-side mitigation: prevent the nested context in the first place, so no
fresh realm (and no un-swept `RTCPeerConnection`) ever exists, available as the
opt-in `experimental.nestedContextLock`. See "Nested browsing contexts" below. The `webrtc` CSP directive remains the portable
end state for the day a shipped directive can reach descendant realms directly;
until then the nested-context lock denies the realm that would carry the egress.

Regression for the shipped part: `tests/e2e/shell-csp.spec.ts` (real opaque
iframe) and the prelude unit tests in
`packages/shell/src/napplet-namespace.test.ts`.

### Nested browsing contexts

Spec-gap decision (defense-in-depth beyond the current NIP-5D text).
**Opt-in and off by default**, via the experimental namespace flag
`experimental.nestedContextLock` (see [Experimental namespace](./EXPERIMENTAL.md)).
It is opinionated — it requires Trusted Types in the napplet CSP and is
incompatible with frameworks that register their own Trusted Types policy — so
it is never imposed on downstream hosts. The rest of this section describes what
the lock does when a host enables it.

A napplet is untrusted and has no legitimate use for a child frame. The CSP already denies
every *fetched* child frame (`child-src 'none'`, `frame-src 'none'`), but
`about:srcdoc` and `about:blank` children involve no navigation request, so CSP
never applies to them, and such a child is a fresh realm the prelude's
capability sweep never touched — most importantly it has a live
`RTCPeerConnection` (see "Direct WebRTC egress"). Kehto closes the two, and only
two, ways an iframe element can be minted, enforced by the browser and by the
shell, never by napplet cooperation:

1. **HTML string sinks.** Every napplet CSP carries
   `require-trusted-types-for 'script'; trusted-types default`, which the napplet
   cannot loosen (a page cannot widen its own CSP). The prelude registers the
   single admitted `default` Trusted Types policy before any napplet script; it
   passes canonical HTML through untouched and rejects any string carrying a
   frame tag, so `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `DOMParser`,
   `document.write`, `Range.createContextualFragment`, `setHTMLUnsafe` and the
   rest are closed.
2. **Element factories.** `Document.prototype.createElement` and
   `createElementNS` are the only element-creating *methods* on the platform
   (verified by enumerating every `create*` method on `Document`, `Element` and
   `Node` in Chromium, Firefox and WebKit — all others create non-element
   nodes). The prelude pins both, non-configurable, to reject frame tag names,
   along with `DOMImplementation.createDocument`.
3. **XSLT.** `XSLTProcessor.transformToFragment` builds result elements from an
   XSL stylesheet DOM, which a napplet can assemble with `createElementNS` in the
   XSL namespace (not a frame tag) and no string sink. The first cut of this lock
   missed it: re-measured for kehto/web#381, an `<xsl:element name="iframe">`
   template minted a live child frame under the lock in Chromium 147, Firefox 148
   and WebKit 26.4 (`window.length` went to 1). The lock now removes
   `XSLTProcessor` from the realm, pinned as a non-writable, non-configurable
   `undefined`, and the bypass battery carries an XSLT vector.
4. **Namespaced XML.** `DOMParser` in `application/xml` mode turns
   `<h:iframe xmlns:h="http://www.w3.org/1999/xhtml"/>` into a live XHTML
   iframe once the node is adopted, and the frame-tag check only matched an
   unprefixed tag name, so this also got past the first cut (measured in all
   three engines). The `default` policy now matches an optional namespace prefix
   on frame tags. A string check alone cannot close XML parsing, though: a DTD
   internal entity (`<!ENTITY e "&#60;h:iframe …/&#62;">`) hides the markup
   until the parser expands it, which also minted a frame under the lock in all
   three engines. So the prelude pins `DOMParser.prototype.parseFromString` to
   inspect the parsed document (template content and shadow roots included) and
   throw when it holds an XHTML frame element. The battery carries both the
   prefixed and the entity vector.

Node movement (`cloneNode`, `importNode`, `adoptNode`) needs a pre-existing
frame node, and every creation route above is closed, so there is no bootstrap.
Escaping the pins needs a fresh realm, whose only sources are a child frame
(closed here), a popup (the `allow-scripts`-only sandbox denies `allow-popups`)
or a worker (not a browsing context, no DOM). The XSLT miss is a reminder that
this enumeration is an argument, not a proof: its residual is a browser
implementation bug *or a platform element source the enumeration has not
named*, which is why the tripwire below exists.

**Tripwire backstop.** Under the lock a napplet has no legitimate child frame,
so the shell revokes the binding (`NappletRevocationReason` `nested-context`)
when the napplet Window reports `length > 0`. The check runs on events the
transport already handles, the frame's `load` and each envelope from the bound
port, so there is no polling, and it never runs for unlocked napplets (no false
positive for a canonical napplet that uses a child frame).
`admitBrowserDocument` marks locked admissions itself; hosts that call
`prepareNappletSrcdoc` directly pass
`bridge.observeFrame(frame, windowId, { nestedContextLock: true })`. Detection,
not prevention: a child created and removed between two of those events goes
unseen, and one that is seen has already run once.

A napplet's own *static* `<iframe>` is instantiated by the HTML parser, which is
not a Trusted Types sink, so the shell scans the verified bytes and refuses any
that declare a frame element (`nappletMarkupHasFrame` / `assertNappletHasNoFrame`
in `@kehto/shell`; Paja runs it on the verified runtime-pointer path before the
bytes become a document). The scan parses with the host's own `DOMParser`, a
superset of what the live sandboxed parser instantiates (zero misses across 22
parser-differential evasions in all three engines), with a conservative lexical
backstop for non-browser hosts.

Compatibility: when enabled, requiring Trusted Types changes the napplet
execution contract. A napplet that assigns plain strings to HTML sinks is
unaffected (the `default` policy passes them through), but one that registered
its own `default` policy would collide; tracked as
`NIP5D_TRUSTED_TYPES_REQUIRED` in [docs/compatibility.md](../compatibility.md).
Because the lock is opt-in, this contract change applies only to hosts that set
`experimental.nestedContextLock`.

Regression: `tests/e2e/shell-csp.spec.ts` (real opaque iframe, scripted bypass
battery including XSLT, and the byte scan), the prelude unit tests in
`packages/shell/src/napplet-namespace.test.ts`, `napplet-realm-lock.test.ts`,
`napplet-csp.test.ts`, `napplet-frame-scan.test.ts`, the tripwire tests in
`nip5d-port-binding.test.ts`, the Paja rejection test in
`packages/paja/src/browser-target-frame.test.ts`, and the conformance guard in
`tests/unit/nip5d-conformance-guard.test.ts`.

### Resource hints

Spec-gap decision (defense-in-depth beyond the current NIP-5D text, which says
nothing about resource hints; checked against nostr-protocol/nips#2303 at
`f60550c`). **Opt-in and off by default**, via `experimental.resourceHintLock`.

CSP3 (w3c/webappsec-csp editor's draft at `e3461f7`) gives `prefetch` and
`prerender` initiators the `default-src` directive and governs `preconnect` by
the union of a policy's source lists, so under Kehto's `default-src 'none'` none
of these should reach the network. Measured from a sandboxed `srcdoc` napplet
under Kehto's CSP (attempted-and-blocked separated from real egress with a raw
TCP sink, Chromium net-log resolver jobs and Firefox `nsHostResolver` logs):

| Hint | Chromium 147 | Firefox 148 | WebKit 26.4 |
|---|---|---|---|
| `rel=prefetch` | blocked by `default-src` (CSP violation logged) | blocked by `default-src` | no request (none top-level either) |
| `rel=prerender` | **GET egress** (`Sec-Purpose: prefetch`), static and scripted; no host CSP, header or `x-dns-prefetch-control` stops it | no request (unsupported) | no request (unsupported) |
| `rel=preconnect` | **DNS + TCP** with network prediction on (the browser default; off in Playwright's default context) | not measurable (no top-level control fired) | **TCP connect**, scripted or a static link whose `href` is rewritten |
| `rel=dns-prefetch` | **DNS resolution** with prediction on | **DNS resolution** with prediction prefs on | not measured (no resolver log) |
| speculation rules / `<a ping>` | no request / blocked by CSP | no request / not measured | no request / not measured |

So the napplet/evil `evil-02` "prefetch hints" observation was the blocked
`rel=prefetch` attempt (Chromium's `Fetching content … violates … "default-src
'none'"` console line, which Paja shows): attempted and blocked, not egress. Its
`dns-prefetch` link left no console trace, and in a regular browser profile it
does resolve. The real channels are the three rows in bold; each carries
napplet-chosen data in the URL or host name, and a static hint becomes one as
soon as a script rewrites its `href`.

No host-side control closes them without touching verified bytes: neither the
napplet CSP, a host-page CSP, a `Referrer-Policy`, nor an injected
`<meta http-equiv="x-dns-prefetch-control" content="off">` (still resolved in
Chromium), and `document.featurePolicy` exposes no hint feature. Kehto layers
the closure like the nested-context lock:

1. The shared Trusted Types `default` policy parses each string-sink input in
   an inert document (descending into nested `<template>` content) and rejects
   it when a `<link>` would carry `dns-prefetch`, `preconnect` or `prerender`;
   a `document.write` chunk that ends inside a tag is rejected so a hint cannot
   be split across chunks (this also rejects a chunk of plain text with an
   unmatched `<`), and any namespace-prefixed `link` tag is rejected because
   `DOMParser`'s XML modes make it a live XHTML link. The shared
   `parseFromString` pin rejects a parsed document holding an XHTML hint link,
   which closes DTD-entity tricks the string check cannot see.
2. The prelude pins every attribute writer that can set a link's `rel`: the
   `rel` setter, `relList` `add`/`toggle`/`replace`/`value`, `setAttribute(NS)`,
   `setAttributeNode(NS)`, `NamedNodeMap.setNamedItem(NS)` and the `Attr`
   `value`/`nodeValue`/`textContent` setters. `XSLTProcessor` is removed.
3. The host refuses verified bytes whose own markup declares a hint link
   (`nappletMarkupHasResourceHint` / `assertNappletHasNoResourceHint`).

Canonical link relations (`stylesheet`, `icon`, `next`, …) and canonical HTML
are unaffected. Paja enables the hint lock whenever its nested-context lock
resolves on (same CLI flag, config key and Security switch), since both need
Trusted Types. Compatibility: the same Trusted Types contract change as the
nested-context lock (`NIP5D_TRUSTED_TYPES_REQUIRED`), plus refusal of napplets
that ship a static hint link; both apply only to hosts that opt in.

Residual with the lock off (the default): the bold rows above stay open. The
upstream fix is browser conformance with CSP3's resource-hint rules.

Regression: `tests/e2e/shell-resource-hints.spec.ts` (Chromium prerender egress
control, a 24-vector scripted battery of which 23 create live hint links in
Chromium without the lock (`execCommand` does not) and none with it, and a
zero-request sink assertion), the same battery and the frame battery run
cross-engine for this change with a throwaway three-project Playwright config
(Chromium 147, Firefox 148, WebKit 26.4: zero hint links and zero frames under
the locks in all three), `packages/shell/src/napplet-hint-scan.test.ts`,
`napplet-realm-lock.test.ts`, the Paja rejection test in
`packages/paja/src/browser-target-frame.test.ts`, and the guard in
`tests/unit/nip5d-conformance-guard.test.ts`.

### Embedding URL

Spec-gap decision (beyond-spec Kehto host policy; NIP-5D at `f60550c` is silent
on referrers and base URLs). A verified napplet is an `about:srcdoc` document,
which inherits the embedding page's referrer and its fallback base URL. Without
host policy a napplet reads the shell URL from `document.referrer` and the full
URL, path, query and fragment included, from `document.baseURI`. Paja keeps the
opened pointer (`?naddr=`) and intent links (`?intent=`) in its query, so every
napplet tab could read them (napplet/evil finding #2).

Measured from a sandboxed `srcdoc` napplet on a host page at
`/shell/secret-path?token=…` (so `./` and `/` differ):

| Channel | No control | iframe `referrerpolicy="no-referrer"` | host `<meta name="referrer">` / `Referrer-Policy` | host `<base href="./">` |
|---|---|---|---|---|
| `document.referrer`, Chromium 147 | host origin | empty | empty | — |
| `document.referrer`, Firefox 148 | empty | empty | empty | — |
| `document.referrer`, WebKit 26.4 | host origin | **host origin** (ignored for srcdoc) | empty | — |
| `document.baseURI`, all three | full host URL | full host URL | full host URL | host directory only (`/shell/`) |
| `location.ancestorOrigins` | host origin | Chromium/WebKit: host origin; Firefox: `"null"` | host origin | host origin |
| subresource `Referer` | none sent | none | none | none |

A `<base>` injected into the napplet document hides the fallback only until the
napplet removes it (measured in all three), so the base belongs on the host
page. `@kehto/shell` exports the controls, none of which touch verified bytes:
`denyNappletReferrer(frame)` (iframe attribute, set before `srcdoc`),
`renderNappletReferrerPolicyMeta()` (the portable control, WebKit included) and
`renderNappletHostBase()` (drops file name, query and fragment from the
inherited base). `ShellBridge.observeFrame` warns once when a frame lacks the
attribute or its host page lacks the referrer meta (`hasNappletReferrerPolicy`,
`hasNappletReferrerPolicyMeta`). Paja's host page and frames, and the e2e harness, apply all
three. A host-page `<base href="./">` changes how the host's own fragment-only
and query-only references resolve; Paja has none.

Residual: `location.ancestorOrigins` still exposes the host origin in Chromium
and WebKit, and the host page's directory stays in `document.baseURI`. Neither
carries Paja state. No host control removes them.

Regression: `tests/e2e/napplet-url-privacy.spec.ts` (Paja with a secret query
and fragment, and the harness), `packages/shell/src/napplet-url-privacy.test.ts`,
`nip5d-referrer-warning.test.ts` and `packages/paja/src/host-page.test.ts`.

### Red-team residuals

`tests/e2e/evil-suite.spec.ts` runs the [napplet/evil](https://github.com/napplet/evil)
suite through Paja when `KEHTO_EVIL_SUITE_DIR` points at a local checkout; it is
skipped otherwise and never fetches the suite. It fails on any `armed` row that
is not a documented residual here:

- `evil-07-fingerprint`, every row: passive fingerprinting, which NIP-5D does
  not protect against.
- `evil-08-wasm-timing` `wasm-compile` and `timer-resolution`: NIP-5D's baseline
  CSP grants `'wasm-unsafe-eval'` and makes no timer promise.
- `evil-02-csp-egress` `webrtc-grandchild`, unless the nested-context lock is
  on (`KEHTO_EVIL_SUITE_LOCK=on`).

### Active NAP-RELAY boundary

Kehto follows [NAP-RELAY PR #2 at
`0be8abce18beb46ca37bd4ddd042f58d30b4eedc`](https://github.com/napplet/naps/pull/2).
For `relay.publish`, a napplet supplies an unsigned `EventTemplate`; the shell
signs it, sends only the signed event to relay services, and returns
`relay.publish.result` with `ok`, the full signed `event`, and `eventId` on
success or `error` on failure. Runtime, `createRelayPoolService`,
`createCoordinatedRelay`, and Paja must consume the same signed
event and result contract. Failed publications are not delivered through the
runtime's successful-event buffer.

The released `@napplet/nap@0.32.0` SDK accepts `EventTemplate`, but the package's
`RelayPublishMessage.event` declaration still names `NostrEvent`. That is
recorded upstream drift, not authority to let a napplet bypass shell signing.

### Active NAP-INC boundary

NAP-INC is governed by merged
[`naps/NAP-INC.md`](https://github.com/napplet/naps/blob/377bf939c6c906817084b43dd21d424de646dbc2/naps/NAP-INC.md)
on `napplet/naps` master
`377bf939c6c906817084b43dd21d424de646dbc2`. The document remains marked
draft, but the merged path supersedes the earlier stacked PR heads as protocol
authority.

The released package projection owns query-to-text-payload transposition in the
shared, runtime-provided INC binding. Kehto runtime routing then uses an exact
stable convention topic identity. It rejects query-bearing normalized wire or
discovery identities, while routing arbitrary opaque strings (including `?` and
`#`) by their complete exact text. It must not add prefix, wildcard, or
query-aware matching, service-over-INC prefix dispatch, synthetic senderless
events, or runtime payload-kind inference. The runtime attaches a
**runtime-attested endpoint identifier** to
delivered events, does not accept caller `sender`, keeps payloads and IDs
opaque, and excludes the source endpoint from topic fan-out.

`target`, `sender`, and `peer` are runtime-assigned endpoint identifiers: opaque text, one per live registered
endpoint, taken from the injected `crypto.randomUUID`, and carrying no manifest `d` tag, artifact hash, window ID,
instance ID, or ordering. An identifier is assigned on first use, lasts until that registration is replaced or
unregistered, and is never reused; a replacement registration is a new endpoint whose old channels close as
`peer destroyed`. Root and snapshot manifests without a `d` tag get identifiers like any other endpoint. A `d` tag is
never resolved as a channel target (`KEHTO_INC_DTAG_TARGET_RETIRED` in
[the compatibility register](https://github.com/kehto/web/blob/main/docs/compatibility.md)). Napplets learn a peer
from an attested `sender`/`peer`; a host selects one with `Runtime.getIncEndpointId(windowId)`.
Firewall, ACL, and permission records stay keyed by the verified principal (`dTag` plus artifact hash); only the INC
wire identity changed. `@napplet/nap@0.40.0` INC types described `sender`, `target`, and
`inc.channel.open.result.peer` as napplet identities (comment text only; the field shapes match).
`@napplet/nap@0.43.0` (napplet/web#341) describes them as runtime-attested opaque endpoint identifiers, so that
upstream drift is closed.

Merged NAP-INC and released `@napplet/nap@0.32.0` both define
`on(topic, callback)` with one `IncEvent`.

INC channel authorization is open-only: ACL and target liveness are evaluated
at open, with no per-message authorization. The merged spec requires equivalent handles
for opener and target, target `inc.channel.opened` before the opener result,
`channel.onOpened`, per-handle `onClosed`, retained inbound/early/terminal
lifecycle data in order, bounded overflow closure, and deterministic teardown.
`channel.list` is informational only. The downstream tracker remains
[`kehto/web#203`](https://github.com/kehto/web/issues/203), including [the
upstream-resolution reply](https://github.com/kehto/web/issues/203#issuecomment-5060904495);
the superseded opener-only view must not be restored.

### Intent delivery and invocation boundary

Checked NAP-INTENT PR #106 at `napplet/naps@fc121fc264615482143eda86125863d2e1f741a2` and NIP-5D PR #2303 at `dskvr/nips@020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7`. Paja uses verified manifest contracts, opaque publisher-safe catalog IDs, parent-attested sender identity, exact convention matching, and one `intent.deliver` after source-bound readiness. A success result records retained delivery responsibility only; no completion result is sent to the source.

`@napplet/nap@0.32.0` (the fixture line) is behind the checked NAP. Host packages take the intent value types from `@napplet/core@0.41.0`, which matches the checked draft (napplet/web#329): `packages/services/src/intent-types.ts` only re-exports them under the existing `@kehto/services` names and declares no local contract. The shell's injected `window.napplet.intent` receiver stays Kehto-owned because the host must install it before `shell.ready`. Like the `@napplet/nap@0.40.0` binding, it drops deliveries without a non-empty string sender and never forwards a delivery ID. `sourceWindowId` is internal host correlation and never wire data. Legacy INC fallback remains separately tracked as `KEHTO_COMPAT_INTENT_INC`; legacy object invoke is tracked as `KEHTO_COMPAT_INTENT_OBJECT_INVOKE`.

NIP-5D bytes are verified before `srcdoc` execution; injected bootstraps are deliberately outside the signed artifact hash and unknown `MessageEvent.source` values are dropped. Paja's external URL uses a signed ephemeral launcher to provide an authenticated source. Opening a shared link follows ordinary verified-pointer navigation policy and opens the app directly. A conflicting applicable saved default and verified link hint require a named-app choice; a one-time choice never changes the default. Persisted catalog pointers are discovery inputs that must be reverified independently of open tabs. A replacement offered for a `nevent` whose event is gone is discovery only: nothing is fetched or framed until the user picks it, and the pick is a fresh verified `naddr` load. A native external host source has no verified iframe endpoint and remains a deferred upstream spec gap.

### Active NAP-IDENTITY and NAP-THEME boundary

Kehto checks NAP-IDENTITY and NAP-THEME at `napplet/naps` master
`5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`. Kehto documents its projection
and policy rather than extending the wire contract.

- `identity.getPublicKey` always settles with one correlated
  `identity.getPublicKey.result`; `pubkey: ""` is the no-signer/failure
  sentinel. Other supported readonly identity reads retain their matching safe
  primary field. Unknown identity actions are silent. `identity.changed` is
  automatic for actual connect/sign-out transitions only, including `pubkey:
  ""`; it is neither an INC event nor an intent delivery.
- `theme.get` always returns a complete theme with `colors.background`,
  `colors.text`, and `colors.primary`. Kehto deliberately reconciles the draft
  error-only example by returning one fixed non-sensitive complete normal
  `theme.get.result` without `error` for ACL-denied, firewall-denied, or
  unavailable reads. This is a Kehto policy/spec-gap reconciliation, not a
  mixed `theme` + `error` extension or a separate theme error message.
- `theme.changed` is an automatic change push. The injected surface is
  `theme.get()` and `theme.onChanged()` only; no theme subscribe/unsubscribe
  wire protocol exists.
- Host changes target only authenticated live source-bound sessions whose
  frozen environment includes the matching domain and whose recipient
  capability is currently granted. The protected injected identity/theme
  objects are readonly and accept results or changes only from `window.parent`.
  A theme update stores complete state before its single eligible-recipient
  push.

Phase 105 completed published Napplet package adoption. This policy records the
selected released line without turning Kehto-local policy into protocol authority.

### Port-bound identity transport

Authority: [NIP-5D at
`51ef0cd33a5694784306f3260d90b1872545fdee`](https://github.com/nostr-protocol/nips/blob/51ef0cd33a5694784306f3260d90b1872545fdee/5D.md)
(`nostr-protocol/nips#2303`, from `dskvr/nips#14`), packaged by
`napplet/web#302` (`180297b`) in `@napplet/core@0.37.0`, `@napplet/nap@0.36.0`,
`@napplet/shim@0.35.0` and `@napplet/conformance@0.24.0`. Result: conformant.

- The Kehto prelude (`packages/shell/src/napplet-namespace.ts`) creates a
  `MessageChannel` before any napplet script runs. It keeps `port1` private to
  its closure and transfers `port2` once with
  `window.parent.postMessage({ type: 'napplet.hello' }, '*', [port])`. All NAP
  traffic in both directions uses the port, and inbound messages are trusted
  only when `event.currentTarget` is that port.
- `ShellBridge.handleMessage` accepts a hello only from the `contentWindow` of a
  registered iframe carrying exactly one port. It binds the verified
  `(dTag, aggregateHash)` to that port and dispatches NAP only from it. Replies
  go through `originRegistry.postToNapplet`, never `iframeWindow.postMessage`,
  and the shell never transfers a port into the iframe.
- A second hello, any other window-level message, an invalid hello, a second
  iframe `load` (`ShellBridge.observeFrame`), or the port closing or failing
  closes the port. It also revokes the binding, sessions, subscriptions and
  frozen environment, and calls `ShellAdapter.onNappletRevoked` so the host
  removes the frame. `originRegistry.register` refuses a spent `Window`. Hosts
  create a fresh iframe for every navigation; Paja and the e2e harness do.
- Kehto's host packages develop on `@napplet/core` 0.45.0 and `@napplet/nap` 0.45.0;
  published peers are per package (core `<0.46.0`, nap `<0.46.0`; `@kehto/services` and
  `@kehto/paja` and `@kehto/cli` floor core at 0.42.0 because services re-exports core's no-ID
  intent types and selector-based CVM registry types, and keep the nap floor at 0.37.0;
  `@kehto/mocks` floors core at 0.44.0 and nap at 0.43.0 because its declarations use the
  NAP-WEBRTC and NAP-MEDIA types first packaged there). Fixture napplets, `@napplet/shim` 0.30.0,
  `@napplet/sdk` 0.28.0 and `@napplet/vite-plugin` 0.16.2 stay on their exact pins
  (kehto/web#364). Kehto implements both sides of the handoff itself and needs no
  newer shim API.
- Spec-gap decision: NIP-5D says a reload "is handled as a navigation" and the
  shell MAY create a fresh iframe from the verified bytes. Kehto removes or
  replaces the frame but does not reload it automatically. Paja leaves the tab
  in an error state until the user reloads it, so a self-navigating napplet
  cannot loop.

### Window-level host message allowlist

After the hello, NIP-5D treats any other window-level message from a napplet
frame as evidence that the document was replaced. Exceptions must be listed
here with a matching guard in `tests/unit/nip5d-conformance-guard.test.ts`.

| Host | Frame | Messages | Why it is bounded |
|------|-------|----------|-------------------|
| Paja | Verified intent launcher (`packages/paja/src/intent-launcher.ts`, signed manifest `paja-intent-launcher`) | `paja.intent.launcher.ready`, `paja.intent.launcher.result` (launcher → host); `paja.intent.launch` (host → launcher) | Shell-authored, content-addressed bytes whose signing key is not in this repository, so its host protocol cannot move into the signed artifact without re-signing. `browser-nip5d-host.ts` handles these two types itself, never forwards them to the bridge, and accepts them only while the launcher's window is registered with a bound port. A second load revokes the frame, and any other window-level message still reaches the bridge and revokes it. `paja.intent.launch` is not a NAP message. |

### Conformance harness exceptions

`@kehto/conformance` (kehto/web#187) drives a real Kehto runtime with a probe
napplet, so its first-party target deliberately does a few things a host
must not do in production. Each site is pinned by the
`keeps the conformance harness exceptions bounded` guard in
`tests/unit/nip5d-conformance-guard.test.ts`; nothing else in
`packages/conformance/src` may post to a frame window or assign `srcdoc`.

| Site | What it does | Why it is bounded |
|------|--------------|-------------------|
| `kehto/session.ts` `instrument()` | Inserts the host-owned wire tap (`renderWireTap`, which defines `window.__kehtoConformanceWire`) ahead of the injected bootstrap, only for probes loaded with `rawWire`. | The tap sits outside the verified artifact bytes like the prelude, and `nip5d/artifact-provenance` and `nip5d/injection-*` run on uninstrumented loads only, so the extra global never counts as NIP-5D evidence. |
| `kehto/session.ts` `loadRogue()` | Assigns unverified bytes to a sandboxed frame the runtime never registered, which then sends its own `napplet.hello`. | Its only purpose is to prove that an unregistered source is silently dropped (`nip5d/source-binding`, `shell/source-trust`). It never goes through `admitBrowserDocument` and is removed after the probe reports. |
| `kehto/legacy-admission.ts` `admitLegacyDocument()` | Loads a probe without `admitBrowserDocument`, binding identity at `napplet.hello` through `originRegistry`, for the scoped legacy-Firewall session of `catalog/firewall-denial` (kehto/web#494). | `admitBrowserDocument` requires the `permissions` coordinator, and the legacy Firewall gate only runs on a runtime without it, so a legacy-gate host cannot use canonical admission. The bytes are still verified first, the CSP and namespace prelude come from exported `@kehto/shell` APIs and sit outside them, and `session.ts` still assigns `srcdoc` inside the same commit callback. Every other probe load, and the uninstrumented NIP-5D evidence, goes through `admitBrowserDocument`. |
| `kehto/session.ts` `forge()`, `kehto/frames.ts` `signal()` / `postFromSibling()` | Posts window-level messages into a probe frame: harness signals (`kehtoConformanceSignal`) and forged `shell.init` from the parent or a sibling realm. | Harness signals are not NAP messages and are read only by the probe's own plan runner. Forged `shell.init` exists to prove the bootstrap ignores window-level NAP traffic. |

## Runtime Availability Policy

Current NIP-5D runtime availability is injected
`window.napplet.<domain>` presence before authored napplet scripts run.

- Injection must happen outside the signed napplet artifact bytes.
- Injection must be limited to `window.napplet`.
- Domain object presence is availability only; operation semantics, versions,
  errors, and diagnostics belong to the matching NAP spec.
- NAP-SHELL is optional and does not gate other domain calls. Trusted iframe creation identity and frozen environment grants establish routing independently of `shell.ready`. The optional namespace exposes `ready()`, local `supports(domain)`, read-only `services`, and `onReady()`; napplet artifacts are not required to bundle their own handshake. This non-normative guidance defers to the living [NAP-SHELL](https://github.com/napplet/naps/blob/master/naps/NAP-SHELL.md).
- GAMEPAD follows the proposed [NAP-GAMEPAD](https://github.com/napplet/naps/pull/108). The host denies native gamepad/HID/USB controller access before loading frames and supplies focus-scoped snapshots through the injected namespace. Optional native Gamepad API replacement is deferred because its permission in GAMEPAD conflicts with NIP-5D's restriction of runtime injection to `window.napplet`.
- LLM follows the draft [NAP-LLM](https://github.com/napplet/naps/pull/134) at `5e93bdfce0e84c0de728234cb7b3feed498f8635` (checked: conformant at that head, including tool calls and results, `thinking`, `content` parts, block deltas, `maxTokens`, `temperature`, `toolChoice` modes, usage extras and cases LLM-C01..C23). Domain presence is injected only when a host registers an `llm` service; configuration state is a host UI concern (`getShellDomainState`) and never changes the wire. The runtime binds handles, results and cancellation to the authenticated endpoint, obtains disclosure consent before each generation, keeps credentials and provider identifiers behind the host adapter, and performs provider communication itself. `@kehto/services` re-exports the record and envelope types from `@napplet/nap/llm/types` (nap 0.37.0 over core 0.38.0), so it no longer mirrors the draft. The runtime never executes a provider-returned tool call; it validates and relays it and the napplet owns execution.

### Paja local development targets

Manifest requirement admission applies only to verified pointer targets. Local
files have no signed manifest; embedded `napplet-requires` publishing metadata
neither blocks local loading nor grants capabilities. Both paths retain host
environment filtering and identity registration before `srcdoc` execution.
This boundary was rechecked against NIP-5D `020cb8b` and NAP-SHELL at
`napplet/naps@e5308ac92cfd49e4fb026812c60886571515e219` for the PR #278 merge fix;
local unsigned loading remains the intentional spec gap described below.

Paja runtime-pointer mode can open a local single-file `index.html` (file picker
or drag and drop). Checked on 2026-10-07 against NIP-5D PR #2303 head
`dskvr/nips@020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7` (`5D.md`) and NAP-SHELL
at `napplet/naps` master `a040914b4bbd3a5cd8a14b0f316a723c968ebfb2`, which is
byte-identical to the recorded `5ac0490461ca6fec2f0d2e45b4835cf9bc08de24`.

- **Conformant:** the identity is computed from the file's own bytes, never
  accepted from the host. It is registered against the frame `Window` before any
  code runs. The bytes load only through `srcdoc` under `sandbox="allow-scripts"`.
  The CSP meta and the `window.napplet` prelude (including enabled optional domains) are injected outside the
  hashed bytes.
- **Intentional spec-gap decision:** NIP-5D Identity steps 1-3 (resolve and
  verify a signed manifest, then fetch and verify its Blossom artifact) cannot
  apply to an unsigned local file. Local files are a Paja development-host
  affordance outside the NIP-5D resolution path, in the same category as
  target-URL authoring mode. They never enter Paja's verified installed catalog
  and are never intent delivery targets. The `dTag` comes from the NIP-5D
  `<meta name="napplet-id">` publishing metadata when present, otherwise
  `local-<file-stem>`. That metadata only labels an unverified development
  target. It is not a manifest claim.
- **Recorded drift, not changed here:** the current NIP-5D draft defines the
  artifact hash as the manifest's single `x` tag over `/index.html`. Kehto's
  `@kehto/nip/5d` resolver still verifies NIP-5A `path` tags plus an aggregate
  `x` tag. Local targets use the same NIP-5A single-path aggregate as that
  resolver, so a local file and its published single-file build share one
  identity.

## Extension Classification

| Surface | Classification | Contract |
|---------|----------------|----------|
| `connect` | Official Kehto NAP extension | Advertise as `nap:connect` only when the shell enforces the connect-origin policy and response/header behavior for the hosted napplet. |
| `class` | Official Kehto NAP extension | Advertise as `nap:class` only when the shell assigns the napplet class and applies class-specific policy before iframe use. |
| `nostrdb` | Out of scope for active NIP-5D conformance | Do not count as a required NAP until a Kehto NAP contract and shell capability advertisement exist. |
| `relay.publishEncrypted` | Official relay NAP operation | Allowed only when the shell performs encryption/signing policy. Napplets may submit cleartext intent; the shell must not sign or broadcast ciphertext supplied by a napplet. |

## Raw Envelope Policy

Raw envelopes are not automatically non-conformant. They are allowed only when
they are either:

- a documented NAP domain envelope whose SDK helper surface is incomplete; or
- a demo/test-only envelope listed in the milestone raw-envelope allowlist.

NAP-RESOURCE host projections follow PR #80 at exact ref
`ae5b9c64ab8a4d8909f288829a01e99d6bd713bc`: single requests carry `url`,
bulk requests carry ordered `urls`, and responses use canonical padded base64
before the projection decodes `Blob` values. The published shim/resource SDK at
the pinned dependency version retains the retired object-form `requests` wire
shape. Active resource consumers use the host-injected projection until that
upstream drift is resolved; they do not introduce a raw-envelope exception.

### Phase 58 Raw-Envelope Allowlist

The allowlist is currently empty. Its former rows covered only the demo
napplets of the retired playground (`KEHTO_PLAYGROUND_RETIRED` in the
[compatibility register](../compatibility.md)); that source is gone. A new raw
`window.parent.postMessage()` protocol envelope in any Kehto-owned napplet,
including test fixtures, must be added here with a concrete classification and a
matching static guard in `tests/unit/nip5d-conformance-guard.test.ts`.

## Naming Policy

Use "ready", "identity-bound", "registered", "connected", or "signer
authenticated" according to the actual state being described.

Do not use `AUTH`, `REGISTER`, `IDENTITY`, or "authenticated" to describe
NIP-5D protocol identity. Those words are allowed only when discussing
historical drift, NIP-42 relay behavior, or user/signer authentication outside
the napplet protocol identity path.

## Experimental domain admission in Paja

Rechecked NIP-5D PR #2303 head at
`nostr-protocol/nips@5560820fa4f37f45b8ab742a11aeb3001b17dc67` and
NAP-SHELL master at `napplet/naps@19de5ce1cea40cd4c76089cdd8126e9f87648049`.
Paja now prevents execution when a required available domain is
denied or unavailable. Denying an optional domain narrows the namespace and
services without blocking the app. Unknown experimental domains cannot gain an
implementation through declarations alone. The read-only `shell` host control
plane is offered when supported; NAP-SHELL is optional and does not gate other
domain calls. The older warn-and-continue Paja behavior is retired by the
shared pre-execution admission policy. Browser regressions cover required
denial, optional narrowing, verified manifests, and reload/replacement.

## Registered service extensions (#303)

Checked NIP-5D PR #2303 at `dskvr/nips@020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7`
and `napplet/naps@3fdba1accd508ab54939b277d426127c5af8faf8` (`naps/NAP-SHELL.md`,
`projections/web.md`). The runtime extension route is host policy, conformant with
source-bound identity, silent unknown types, and namespace-based domain grants.
It adds no wire fields, fallback error protocol, signing API, INC routing, or
namespace placeholders. The private `example` regression has no owning NAP in the
registry and is intentionally not claimed as NAP implementation conformance.

`ServiceHandler.messageCapabilities` lists exact inbound extension types and
existing ACL requirements (or explicit null). Routing additionally requires a
live unblocked source, an explicit host domain grant, and firewall admission.
Unknown types are silent before firewall accounting; extension denials retain
host audit/consent without emitting invented wire responses. Replies recheck
registration/source lifetime and current domain/ACL policy. Built-in NAPs retain
their dispatcher and capability mapping; neither metadata nor manifest tags can
change it. Browser extension hosts must supply the owning contract and inject a
corresponding granted binding before scripts execute. Stock Paja
bindings do not expose new domains merely because a service is registered.

Runtime regressions cover registration, replacement/removal, source isolation,
ACL/firewall denial and startup limits, silent unknown types, fixed-domain
precedence, and delayed replies after teardown or policy revocation. The full
browser suite guards existing host consumers without inventing an `example` NAP.

## Source pins and presentation media

Checked NIP-5D PR #2303 at `dskvr/nips@6e24617cde507c0a87fa170af9ed6b2b46545b2d`
(`5D.md` §Source, §Presentation media; content commit `d4f4d89`), the delta since
`020cb8b`. Upstream `napplet/web@ef915243` chased the same text in `@napplet/cli`,
`@napplet/conformance` and `@napplet/vite-plugin`, released by Version Packages
#273 at `napplet/web@f6839146afda77944d12ecdc371630905c9474f6` as Vite plugin
`0.16.2`, conformance `0.20.5` and CLI `0.13.1`. `@napplet/core` and
`@napplet/nap` are unchanged, so Kehto keeps its pinned runtime line and owns the
manifest parsing in `@kehto/nip/5d` (`source-metadata.ts`, `presentation-media.ts`).
Fixture napplet builds pin the published `0.16.2` writer;
`tests/unit/published-napplet-contract.test.ts` proves its `screenshot`,
`preview`, `source-commit` and `source-archive` output survives final-byte
signing and parses through `parseNappletManifest`.

Conformant. `parseNappletManifest` keeps one well-formed `source` in the accepted
HTTP(S), SSH, scp-like, Git or NIP-34 `nostr://` forms, one `source-commit` only
alongside a usable `source`, and one four-element HTTPS `source-archive`. It
parses `screenshot` and `preview` tags with NIP-92 `key value` fields, requires
exactly one `x`, drops malformed or repeated optional fields, preserves screenshot
order, and ignores the preview when several are declared. Malformed or repeated
source and media tags are ignored rather than rejecting the manifest, which the
amendment requires; the previous hard rejection of a repeated `source` tag is
gone. Legacy aggregate events stay frozen in `legacy-manifest.ts`.

Declarations are never verified media. `verifyPresentationMediaBytes` applies the
client checks (SHA-256, decodable PNG/JPEG/WebP or video container, declared `m`
equality) and returns the recognised format or `undefined`; it is a header check,
so a rendering host still relies on the browser decoder and keeps placeholder
artwork for anything that fails. No Kehto host renders screenshots, previews or
source links yet; Paja and `@kehto/services` project only NAP-INTENT
routing facts and `title` from the manifest, so they need no new fields.

Spec-gap decision: an HTTP(S) `source` may be a repository or an archive and the
location alone cannot distinguish them, so any accepted `source` retains an
otherwise valid `source-commit`. Regressions:
`packages/nip/src/5d/source-metadata.test.ts`,
`packages/nip/src/5d/presentation-media.test.ts`, and the manifest-level cases in
`packages/nip/src/5d/current-manifest.test.ts`.

## Shared host launch admission

Rechecked NIP-5D PR #2303 head
`5560820fa4f37f45b8ab742a11aeb3001b17dc67`, NAP-SHELL master
`19de5ce1cea40cd4c76089cdd8126e9f87648049`, NAP-RESOURCE PR #80 head
`ae5b9c64ab8a4d8909f288829a01e99d6bd713bc`, and NAP-CONNECT PR #19
head `ec81a3a4a1fc4da1ad2601215353b7f822e44b8f`. Paja registers
source-bound principals provisionally, awaits shared approval, then
prepends CSP and namespace bootstraps to a `srcdoc` copy. Signed artifact bytes
and hashes remain unchanged; gateway output cannot establish identity. Paja's
unsigned targets use development principals bound to exact target and byte hash.
The experimental nested-context lock passes through the same transaction: Paja
scans the verified bytes first, and admission adds the Trusted Types directives
and prelude pins.

The common CSP defaults to no remote sources. Verified artifacts
request none; Paja live development proposes canonical directive/origin pairs.
Those browser source expressions follow [CSP scheme matching](https://www.w3.org/TR/CSP3/#match-schemes)
and port matching: HTTP can match HTTPS, WS can match WSS/HTTP/HTTPS, and WSS
can match HTTPS. Nondefault ports stay bounded; default port upgrades follow
CSP. The Chromium 152 regression confirms the default-port HTTP upgrade and
its narrower rejection on the same nondefault port. It also verifies allowed
HTTP/HTTPS transport and sibling-port denial. The approval UI discloses these
browser-only rules. Mediated network authorization still requires exact canonical
origin equality. A direct source cannot use mediated `resource`; required conflicts block launch.
Paja's host-injected base URL may point only to an already approved exact
development origin. Frame, child, object, manifest, and form destinations
remain closed. This directive-specific CSP and base behavior are bounded Kehto
host policy, not a new NAP-CONNECT wire contract. A new host consumer must use the same shared admission
transaction and add a conformance guard before executing bytes.

### Target-URL documents that require `resource`

Checked for kehto/web#447 against NAP-RESOURCE PR #80 head
`ae5b9c64ab8a4d8909f288829a01e99d6bd713bc` (`naps/NAP-RESOURCE.md` and the
resource binding in `projections/web.md`); `napplet/naps` master
`377bf939c6c906817084b43dd21d424de646dbc2` has no NAP-RESOURCE yet. The binding
requires a browser policy that blocks direct `fetch`, XHR, WebSocket,
EventSource, beacon, and external subresource loads before `resource` is
exposed, and says the direct-network exception must not be applied to such a
napplet.

A live target-URL frame loads scripts, styles, images, fonts, media, workers, and
an HMR socket from its dev origin. Narrowing that to "assets only" would still
leave external subresource loads, and images or scripts are an egress channel to
a loopback origin that the resource policy itself must block. An opt-in flag
would expose `resource` to a frame the host knowingly cannot isolate. Neither is
conformant, so Kehto does neither.

- **Conformant:** when the fetched development document lists `resource` under
  `napplet-requires`, Paja admits it as a network-isolated snapshot. The Paja
  server fetches `index.html`; the frame gets those bytes through `srcdoc` with no
  remote sources and no host-injected base URL, under the same closed CSP as a
  local single-file target (`default-src 'none'`, `connect-src 'none'`,
  `img-src data: blob:`). `tests/e2e/paja-target-url-resource.spec.ts` proves in
  Chromium that fetch, XHR, WebSocket, EventSource, beacon, image, script, style,
  media, and worker requests reach neither the dev origin nor a third origin.
- **Unchanged:** `admitBrowserDocument` still returns `incompatible` for a
  required `resource` whenever any direct browser origin remains, and still omits
  an optional `resource` from a direct-network frame. Verified pointer and local
  file admission did not change.
- **Bounded host policy, not a NAP contract:** the snapshot does not hot-reload
  and loads no asset by URL. `planTargetNetwork` names the references that will
  not load; the CLI prints the decision at startup and the browser host logs
  `paja.target.network.isolated` or `paja.target.resource.omitted`. A target that
  wants live dev-server loading declares `resource` under `napplet-optional` and
  runs without it.

### Host dependency line: core 0.45 / nap 0.45

Host peer ranges admit core 0.45.x and nap 0.45.x; development builds and JSR maps use that line ([kehto/web#518](https://github.com/kehto/web/issues/518)). nap 0.45.0 depends on core `^0.45.0`. No peer floor moves: after the build, no emitted declaration uses a shape that 0.44 or 0.45 changed. `@kehto/mocks` and `@kehto/services` use `IntentAvailability` and `CvmServer`, which are unchanged; services' `CvmDiscoverResultMessage` is its own mirror; `@kehto/runtime` only passes `ResourceSidecarEntry` through. The floors from the core 0.44 / nap 0.43 section below stand.

Checked NAP-CVM PR #31 at `28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f`, NAP-INTENT at master `377bf939c6c906817084b43dd21d424de646dbc2`, NAP-RESOURCE PR #80 at `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc` and NAP-UPLOAD PR #33 at `f5cc981e527e2cc1572793a7a6e5082e5271ac49`; all were still the PR heads (and master) on 2026-11-20. What the releases change:

- nap 0.45.0 (napplet/web#360): `cvm.discover.result` is a union of a success shape (`servers` required) and an error shape (`servers` omitted), from NAP-CVM's "On a shell error, success payload fields MUST be omitted. On success, the operation's payload is required." `intent.available.result` `availability` and `intent.handlers.result` `handlers` are required, as the NAP-INTENT wire table lists them beside `error`?.
- nap 0.44.0 / core 0.45.0: NAP-RESOURCE wire bytes are `ResourceBytes`, canonical padded base64, on `resource.bytes.result`, `resource.bytesMany.result` items (`ResourceBytesWireItem`) and `ResourceSidecarEntry`. The shim routes `data:` through the runtime and decodes strictly; `hashtree` joins `htree` as a scheme name. Kehto already spoke that wire, since it implemented PR #80 at the same head. Kehto ships no Hashtree resolver, so scheme disclosure is unchanged.
- nap 0.44.0: comment-only changes in config and relay types.

Kehto wiring: the intent service, the runtime's intent policy denial and the intent mock sent a bare `error` on failure, which the NAP-INTENT table does not allow. They now send an empty availability (`available: false`, no candidates) or `handlers: []` with the `error`. The injected namespace was already error-first, so a reply that carries both rejects with the error. `@kehto/services` exports `CvmDiscoverResultMessage` as the same success/error union. The injected `cvm.discover` rejects a success reply without a `servers` list instead of resolving `[]`. Result: conformant at the wire for CVM, INTENT and RESOURCE. `catalog/package-field-drift` clears its CVM and INTENT rows.

NAP-UPLOAD stays open on napplet/naps#33. `upload.upload.result` `result` is a contradiction in the NAP text: the wire table requires `result`, `UploadResult.uploadId` is a required "Shell-generated upload identifier", and Error Handling says "The shell SHOULD return a top-level `error` when no upload was created." It is recorded in `FIELD_DRIFT_EXCEPTIONS` as a `contradiction`, so the check reports `spec-gap` for it, as for NAP-IDENTITY's `identity.getProfile.result` `profile` (napplet/naps#155). `upload.info.result` `info` and `upload.status.result` `status` are not contradictions: the table pairs `error?` with the required field and no sentence omits it. nap 0.45.0 still types both optional, so the full profile keeps failing `catalog/package-field-drift` on those two rows, and the check stays on the known-findings list. The runtime's upload denial still sends only `error` (kehto/web#494). An `info: { rails: [] }` denial would satisfy both the table and the types, but that change is not made here.

### Host dependency line: core 0.44 / nap 0.43

Core 0.44.0 / nap 0.43.0 moved the host line for the media, WebRTC and resource drafts. These checks are kept as history; the floors below still apply. `@kehto/services`, `@kehto/paja` and `@kehto/cli` floor core at 0.42.0 because services exposes core's CVM registry types and re-exports core's intent types. `@kehto/mocks` floors core at 0.44.0 and nap at 0.43.0 because its declarations also use the packaged `WebrtcSession` delivery fields, `bytes`/`stats` events and `MediaState.reason`. Other peer floors and the older fixture matrix remain supported.

Checked NAP-MEDIA PR #10 at `7806f438530251fce5129f8e6239d6b642278759`, NAP-WEBRTC PR #59 at `fb4dd6f0e6294e1837733d2af61931e3e114bd97` and NAP-RESOURCE PR #80 at `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc` (all still the PR heads on 2026-11-20). Core 0.44.0 / nap 0.43.0 (napplet/web#344, #345, #346) package `media.session.ended`, `onEnded` and the transition `reason`; `webrtc.sendBytes`, `bytes`/`stats` events, `ordered`/`maxRetransmits`/`maxPayloadBytes`; and a URL-string `resource.bytesMany` with `urls`, dropping `servers`, `ResourceBytesRequest` and `ResourceInfo.maxServers`. Kehto's runtime already spoke these wires. The injected `window.napplet.webrtc` gains `sendBytes`, so the 0.43 SDK's `webrtcSendBytes` reaches the shell and gets the NAP's `unsupported` instead of a missing method; the reference service had no byte transport then ([kehto/web#507](https://github.com/kehto/web/issues/507) adds it: canonical base64 `bytes` decoded onto the data channel, binary received as `bytes` events, `maxPayloadBytes` enforced; conformant with NAP-WEBRTC PR #59 at `fb4dd6f0e6294e1837733d2af61931e3e114bd97`). The legacy positional `media.sendCommand` / `media.onCommand` forms now carry `reason` too. The conformance catalog's `catalog/package-drift` passes against nap 0.43.0 ([kehto/web#496](https://github.com/kehto/web/issues/496)). Result: conformant at the wire. Remaining upstream drift: nap 0.43.0 still types the positional `sendCommand` / `onCommand(action, value, reason)` forms, while NAP-MEDIA's API table names `command(sessionId, MediaCommand)` and an object `onCommand` handler, so `KEHTO-MEDIA-SEND-COMMAND` / `KEHTO-MEDIA-COMMAND-CALLBACK` stay.

Field-level drift ([kehto/web#508](https://github.com/kehto/web/issues/508); the core 0.45 / nap 0.45 section above has the current rows): `catalog/package-field-drift` compares every payload field and its optionality between the nap 0.43.0 declarations and the wire tables at the refs pinned in `packages/conformance/src/authority.ts`. The full profile fails it on upstream package drift: nap 0.43.0 requires `servers` on `cvm.discover.result` (NAP-CVM PR #31 at `28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f` marks it optional) and makes optional the primary field of `upload.info.result`, `upload.status.result`, `upload.upload.result` (NAP-UPLOAD PR #33 at `f5cc981e527e2cc1572793a7a6e5082e5271ac49`), `intent.available.result` and `intent.handlers.result` (NAP-INTENT at master `377bf939c6c906817084b43dd21d424de646dbc2`), which those tables require. The minimal profile reports a spec gap: NAP-IDENTITY's table marks `identity.getProfile.result` `profile` optional while its prose always sends it. Differences a NAP sentence settles are quoted in `FIELD_DRIFT_EXCEPTIONS`. Kehto's runtime is not at fault in any of these rows; the check stays failing until upstream settles them.

### Host dependency line: core 0.42 / nap 0.41

Core 0.42.0 / nap 0.41.0 moved the host line for the CVM registry types. These checks are kept as history.

Checked NAP-CVM PR #31 at `28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f` (still the PR head on 2026-11-20). Core 0.41.0 / nap 0.40.0 exported the older family-only registry contract ([napplet/web#336](https://github.com/napplet/web/issues/336)). Core 0.42.0 and nap 0.41.0 (napplet/web#337) export `CvmRegistrySelector`, `schemaHashes` entries, required per-tool hashes, the `category` query hint and `selector` envelopes, field for field with the draft, so Kehto retired its local registry types ([kehto/web#441](https://github.com/kehto/web/issues/441)). That release changes no other NAP domain. Result: conformant. No family-only wire fallback exists; the injected string-family adapter stays as `KEHTO_CVM_FAMILY_SELECTOR`.

Checked NAP-INTENT PR #128 at `74f9bf85ebb83b50b7b2ad8308a835d5f3113cd9` alongside PR #106 at `fc121fc264615482143eda86125863d2e1f741a2`. The current proposal withdraws delivery IDs and nullable senders. Core 0.40.0 exported that withdrawn shape ([napplet/web#328](https://github.com/napplet/web/issues/328)). Core 0.41.0 and nap 0.40.0 (napplet/web#329) export the no-ID, string-sender delivery, so Kehto retired its local copy ([kehto/web#418](https://github.com/kehto/web/issues/418)). Result: conformant. No delivery-ID or null-sender fallback exists.

The new package subpaths do not imply host support. Paja records `blossom`, `catalog`, `navigation`, `soulseek` and `torrent` as deferred and does not inject or advertise those domains. This is an implementation coverage decision, not a spec gap or a blocker on the draft status. Existing resource/upload Blossom operations remain their own domains. The checked owning documents are:

- NAP-BLOSSOM PR #71: `5e74daa4808290a3efb8de117502d52ba2e0d2a5`.
- NAP-CATALOG PR #95: `1020ae53884a177b7ffc58a679126bc8800d0c6d`.
- NAP-NAVIGATION PR #126: `9a4b179ea5fe76e90ae986b2fbf77a3f8b84672d`.
- NAP-SOULSEEK PR #135: `892ed8d4909c28ab5c1a469ef8984721b75d6c8f`.
- NAP-TORRENT PR #72: `bc99787e3cf049229da5e6bde55362a040724096`.

`packages/paja/src/parity.test.ts` verifies the installed export inventory and the resolved environment's domain/service absence. Existing shell and Paja browser regressions cover canonical intent shape, parent trust, readiness buffering and exactly-once delivery.

## Unrecognized message types (#465)

Checked NIP-5D PR #2303 at `dskvr/nips@f60550c3409d6d81a875088ec83e660571e10504`
(`5D.md`): "Messages with an unrecognized `type` MUST be silently ignored." and
"Unrecognized message types are silently ignored, preventing capability
probing." Conformant. No runtime handler, `@kehto/services` reference service,
ACL/firewall denial or Paja multiplayer stub replies to a type its owning NAP
does not define. Known types with malformed payloads keep their NAP's failure
result. A `webrtc.stats` request is treated as unknown because NAP-WEBRTC #59 at
`fb4dd6f0e6294e1837733d2af61931e3e114bd97` defines `stats` only as a pushed
event; `storage.clear` is unknown because NAP-STORAGE #3 at `4f4cf0ca` does not
define it. The per-domain request tables used by the denial path cite their
NAP refs in `packages/runtime/src/policy-denials.ts`.

`tests/unit/nip5d-conformance-guard.test.ts` is behavioural: it drives every
`create*Service` export, the runtime with and without ACL denial and every NAP
mock with undefined types and fails on any reply or push. It has no allowlist.
The legacy `createNotificationService` still answers `notify.create/list/read`,
which are tracked in [the compatibility register](../compatibility.md); its
unknown types are silent and the guard covers it. Host diagnostics and the
retired replies are recorded under `KEHTO_UNRECOGNIZED_MESSAGE_TYPE` there.

