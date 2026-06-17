---
"@kehto/shell": minor
---

Add an optional `ShellAdapter.onUnroutedMessage` observability hook.

`ShellBridge.handleMessage` previously dropped any inbound postMessage it could not
route to a registered napplet window **silently** — no signal when a message arrived
from a window with no `MessageEvent.source`, or from a source `Window` absent from
`originRegistry`. That silence is what made the FEED-02 / hyprgate#21 class of bug
("a napplet's `outbox.subscribe` never reaches the runtime") hard to diagnose.

Hosts can now pass `onUnroutedMessage(info)` to observe these drops. `info` is the new
exported `UnroutedMessageInfo` (`{ type?: string; origin: string; reason: 'no-source-window' | 'unregistered-window' }`).
The hook is observe-only (routing behavior is unchanged — the message is still dropped),
optional (no behavior change for hosts that don't set it), adds no console output of its
own, and swallows host-hook errors so observability can never break message handling.
