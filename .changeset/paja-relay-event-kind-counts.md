---
"@kehto/paja": minor
---

Add a collapsible **Events** section to the Paja console below **Messages**. It
accumulates one `kind - count` row per Nostr event kind pulled from a live
relay, with the session total in the section header. Counting happens in the
relay backend before delivery, so napplet subscriptions and Paja's own
background fetches (social cache, relay lists, Blossom lookups, upload
discovery) are included, while simulated memory-mode fixtures and Paja's own
publishes are not. Counts accumulate for the host session and reset on reload.
