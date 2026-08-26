---
'@kehto/services': minor
'@kehto/shell': minor
'@kehto/paja': minor
---

Adopt the NAP-RESOURCE Blossom server-hint contract across the injected shell API, reference service, and Paja runtime. Single requests now carry optional advisory servers, bulk requests use per-resource request objects, and Paja validates, caps, and tries accepted hints before host defaults.
