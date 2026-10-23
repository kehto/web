---
'@kehto/playground': patch
---

The playground relay service now runs on applesauce v7: it uses a RelayLiveness-backed pool, loads kind-10002 mailboxes through the address loader, and relies on pool-owned request and publish timeouts. NAP-RELAY wire behavior is unchanged.
