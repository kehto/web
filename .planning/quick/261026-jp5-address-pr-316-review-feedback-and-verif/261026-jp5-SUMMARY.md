---
status: complete
---

# PR 316 review revision

Implementation/integration commit: 4fcf564d.

- Removed the merge conflict by merging main, preserving reviewed history.
- Kept main's audit verbatim; the already-landed CVM prerequisite has no PR diff.
- Scoped HTTP UUID guidance, improved browser diagnostics and UUID test labels,
  and covered non-callable randomUUID. No helper abstraction or dependency added.
- Filed remaining identifier assumptions as https://github.com/kehto/web/issues/351.
- Build (32 tasks), type-check (17 tasks), unit (2,277 tests / 178 files), docs
  (9 packages), and Playwright (150 Chromium tests) passed.
- Lint succeeds with zero configured workspace tasks. AI-slop: PR diff 100/100;
  repository 95/100 from five unchanged size/complexity warnings. Rules unchanged.
- Browser proof covers event injection on real HTTP and HTTPS crypto capabilities;
  session/cache fallbacks remain unit-only. Other browser engines were not tested.

Authority: NAP-SHELL and web projection at napplet/naps@1e1046bcadabbc552804f6d3354f565184f9fefb;
NIP-5D PR #2303 at 5560820fa4f37f45b8ab742a11aeb3001b17dc67. Conformant
within unchanged host-policy scope; no wire, identity, or readiness changes.

Publication and review-request evidence is recorded on PR #316 after push.
