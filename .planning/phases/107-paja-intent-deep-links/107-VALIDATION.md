---
phase: 107
status: planned
nyquist_compliant: true
wave_0_complete: false
---

# Validation

Each implementation commit runs its affected Vitest suites. Protocol migration verifies request normalization, exact contracts, publisher collisions, recommendations/default precedence, sender trust, asynchronous delivery and old-path diagnostics. URL tests include encoded delimiters, unicode, literal plus, duplicate decoded keys, malformed UTF-8/percent encodings, null/primitive JSON and size limits. Browser tests exercise full copy-link to cold and reused delivery, review cancellation/edit/retry, no replay, and accessible narrow layout. Final gates are build, type-check, full unit, Playwright, docs and AI-slop; final verification maps LINK-01..12 to concrete tests/files and PR state.
