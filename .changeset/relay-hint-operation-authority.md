---
"@kehto/runtime": minor
"@kehto/services": minor
"@kehto/paja": patch
---

Require destination operation authority before napplet-supplied relay hints open
network connections. Runtime scoped subscriptions and its existing query hint
extension now reject unapproved legacy hint execution, validate WebSocket URLs,
and detach filters and destination plans before approval waits. Revocation and
source replacement prevent stale subscription execution and delivery.

Standalone OUTBOX requests with explicit relay hints now require a permission-enabled
runtime and immutable planning. Its default router rejects unconfigured local/private
destinations and malformed or credential-bearing URLs. Host-configured development
relays remain supported. Paja rejects trailing-dot private hostnames too.

Unhinted legacy host routing remains temporarily available with documented,
bounded migration warnings. Relay network approval does not authorize NIP-42
signing; hosts must keep automatic-authentication pools out of napplet-directed
traffic.
