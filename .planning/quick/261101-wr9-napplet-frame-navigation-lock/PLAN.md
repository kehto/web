---
quick_id: 261101-wr9
slug: napplet-frame-navigation-lock
date: 2026-11-01
status: complete
---

# Lock napplet frames to their verified srcdoc

The NIP-5D port binding from #378 revokes a napplet on a second `load`, a second `napplet.hello` or the port closing. None of these can see a napplet that navigates its frame before its own first `load`: only the replacement fires `load`, and Chromium has no MessagePort `close` event. Without a page policy, a `data:` or `blob:` document with script runs in the frame (measured on napplet.run's player, which uses the same model; napplet/web#305).

1. `@kehto/shell`: `NAPPLET_FRAME_POLICY` (`frame-src 'none'`), `renderNappletFramePolicyMeta()` and `hasNappletFramePolicy()`; `observeFrame` warns once when the host page lacks the policy.
2. `@kehto/paja`: the host page `<head>` carries the policy, and `navigateFrame` refuses to load a napplet without it.
3. Tests, READMEs, changeset. This is host page policy, not protocol surface.
