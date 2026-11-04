---
"@kehto/services": minor
"@kehto/shell": minor
---

Adopt the NAP-RESOURCE draft's canonical exact `url`/ordered `urls` requests and
padded base64 result bytes. Resource authorization now covers the immutable
resource URL plus every resolver-reported HTTP(S) or WebSocket destination, with cancellation,
live revocation, and stale completion handling at the service boundary.
