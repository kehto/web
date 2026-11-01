---
"@kehto/shell": minor
"@kehto/paja": patch
---

Lock napplet frames to their verified `srcdoc`. NIP-5D's replacement evidence (a second `load` or `napplet.hello`, the port closing) cannot see a napplet that navigates its frame before its own first `load`: only the replacement fires `load`, and browsers fire no MessagePort `close` event, so a `data:` or `blob:` document with script could run in the frame. `@kehto/shell` exports `NAPPLET_FRAME_POLICY` (`frame-src 'none'`), `renderNappletFramePolicyMeta()` and `hasNappletFramePolicy()`, and `ShellBridge.observeFrame` warns once when the host page lacks the policy. Browsers check every navigation of a child frame against the embedding page's `frame-src`, including one the frame starts itself, while an unfetched `srcdoc` still loads. The Paja host page now carries the policy, and Paja refuses to load a napplet on a host page without it.
