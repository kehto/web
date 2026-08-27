---
'@kehto/paja': patch
'@kehto/services': patch
---

Let Paja resolve OUTBOX-carried Blossom resources from event-local server hints, hinted authors' and the verified event publisher's BUD-03 lists, and the active shell user's published list before configured runtime fallbacks, independently of upload mode. Resource resolvers now receive the authenticated source window as private runtime context, and OUTBOX hosts can select a source-scoped router for every event-returning read.
