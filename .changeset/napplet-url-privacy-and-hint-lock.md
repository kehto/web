---
"@kehto/shell": minor
"@kehto/paja": minor
---

Keep the shell URL away from napplets and close CSP-exempt resource hints (kehto/web#381).

- `@kehto/shell` adds `denyNappletReferrer`, `renderNappletReferrerPolicyMeta`, `renderNappletHostBase`, `hasNappletReferrerPolicy` and `hasNappletReferrerPolicyMeta`. A `srcdoc` napplet otherwise reads the host URL from `document.referrer` and, query and fragment included, from `document.baseURI`. `ShellBridge.observeFrame` warns once when a frame has no `referrerpolicy="no-referrer"` or its host page has no referrer meta.
- New opt-in experimental flag `resourceHintLock`: rejects `<link rel="dns-prefetch" | "preconnect" | "prerender">` on every string sink and attribute writer (browsers act on these outside the napplet CSP), with `assertNappletHasNoResourceHint` / `nappletMarkupHasResourceHint` for static markup. It shares the Trusted Types `default` policy with `nestedContextLock`.
- `nestedContextLock` now removes `XSLTProcessor` and rejects namespace-prefixed frame tags; both minted child frames past the lock in Chromium, Firefox and WebKit (XSLT, and `DOMParser` XML parsing plus `adoptNode`), and the bridge revokes a locked napplet whose Window holds a child frame (new `NappletRevocationReason` `nested-context`; `observeFrame` takes `{ nestedContextLock }` for hosts that prepare the srcdoc themselves).
- `@kehto/paja` sets the referrer meta, a `<base href="./">` and per-frame `referrerpolicy`, and applies the resource-hint lock whenever its nested-context lock resolves on, refusing napplets that ship a static hint link.
