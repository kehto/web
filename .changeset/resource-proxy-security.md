---
"@kehto/paja": minor
---

Route resource fetches through a protected one-hop transport with public-address
pinning, bounded bodies and deadlines, disconnect cancellation, and redirect
metadata for per-destination authorization. Reject direct proxy access from
untrusted frames before DNS or network activity.

Authorize Paja BUD-03 discovery relay sockets individually, preserve NIP-65 author routing, and scope discovery caches to a live source-window generation so cancellation or source replacement cannot deliver stale server lists. Refresh signer-derived bootstrap relays at host signer lifecycle boundaries, then use that cache during resource requests instead of invoking external signer hooks.
