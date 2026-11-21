---
"@kehto/paja": patch
---

Paja no longer freezes when a napplet reads from hundreds of relays. The message log and the Events panel used to re-render for every message and every relay receipt. Each message-log render rebuilt up to 120 rows and forced a layout, and each Events render rebuilt every relay row and author chip. A feed following many authors produces thousands of those within seconds, and that froze the host for close to a minute. Logged data still updates immediately, but each panel now re-renders at most once per animation frame. On a synthetic load of 700 authors across 128 relays, half the notes now reach the napplet in 2.8 s instead of 26 s.
