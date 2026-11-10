---
"@kehto/mocks": patch
---

The relay mock now implements the runtime's planned-execution relay contract (`planRelayOperation` / `executeRelayOperation`) with local-only plans, so the Firewall approval runtime routes relay traffic to it instead of denying it as a legacy relay service.
