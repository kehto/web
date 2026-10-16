# Paja Events review fixes — complete

Fixed all four review findings: receipt callbacks now run on each verified, filter-matching relay delivery before read-local deduplication; attribution comes from that callback instead of historical seenOn or requested-set fallback; canonical identities coalesce equivalent panel URLs; authorless hinted live outbox reads retain hint-or-fallback routing.

Added actual AbstractRelay receive-path coverage for A/B/A duplicates, silent sources, historical attribution, overlapping-filter query arrivals, malformed/nonmatching events, EOSE, timeout, bounded reads, abort, auth retry and concurrent-read cleanup. Added real browser receipt regression. Independent review caught a double-close lifecycle issue; repaired it and covered ongoingOperations on concurrent reads and auth cleanup. Re-review found no remaining concrete blocker.

Authority: napplet/naps NAP-RELAY PR #2 at 9f30b3505335a52c574ff570576687d6467021ff and NAP-OUTBOX PR #32 at 8865f73d52a4864afee145f28d26520476273927. No wire delta; preserved deduplicated delivery and restored routing policy, conformant within this change's scope.

Verification:
- pnpm build: pass
- pnpm type-check: pass
- pnpm test:unit: 2186 passing / 172 files
- pnpm docs:check: pass
- aislop@0.12.0: 95/100, same five existing warnings, no new rule disables
- Full two-file Playwright run: 18 passed, existing CVM discover.result network-dependent failure, 9 skipped after serial failure
- Both Paja Playwright files excluding that documented failure: 27/27 passed after final changes
- git diff --check: pass

Unrelated concurrent host-page.ts and host-page.test.ts footer-collapse edits and untracked PAJA-EVENTS-PANEL.md were left untouched and excluded from staging. Existing PR #318 updated rather than opening another PR.
