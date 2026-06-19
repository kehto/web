---
quick_id: 260619-tmr
slug: napplet-web-cache-strategy
status: in_progress
created_at: 2026-06-19T19:20:07Z
---

# Napplet Web Cache Strategy

## Goal

Identify a technically sound path to caching napplets on the web with sensible
eviction policies. Avoid IndexedDB and localStorage unless the evidence shows
there is no viable alternative.

## Reader

Internal Kehto maintainer or host implementer deciding where napplet artifact
caching belongs.

## Deliverable

- Presentable concepts document under `docs/`.
- Linked from docs navigation and reader entry points.
- Recommendation grounded in Kehto content-addressed loading and current browser
  storage behavior.

## Verification

- Cold-read the document for a fresh reader.
- Run docs validation for link/config correctness if available.
