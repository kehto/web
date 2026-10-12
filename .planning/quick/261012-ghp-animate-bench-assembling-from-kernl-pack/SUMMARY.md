---
status: complete
---

# bench assembled from kernl

Replaced the static runtime film shot with six animated screenshot regions and
package labels: runtime, shell, ACL, identity, services, and window management.
Identity/theme correctly map to @kehto/services. The interface assembles, expands,
and shows a real host theme response before the supplied GitHub/npm/JSR identities.
The film is 38 seconds, 1200 × 1000 at 24 fps, 1,431,333 bytes. Captions and the
accessible transcript follow the new timeline. Source and encoded frames inspected.

Renamed current public docs, host wordmark/title/accessible labels, and CLI
presentation to lowercase bench. Existing package names, commands, routes, API
symbols, and persisted identifiers remain compatible. Patch changesets cover the
paja and CLI packages. The root package.json workspace edit remains excluded.

Build/type pass; all 2,096 unit tests pass with one worker after updating the
server wordmark assertion. The initial concurrent run also hit unchanged relay
and compiler-test timeouts under local load. Strict docs/Pages build passed;
final strict docs refresh and Pages audit pass. All 120 runtime browser scenarios
are validated: 110 passed in the full run, then all 16 in the affected serial
group passed after updating its remaining old wordmark expectation (including
the nine previously skipped scenarios). All seven landing browser checks pass,
including the 38-second media duration, bench title, new identity links, captions,
responsive layout, and accessibility controls. Quality gate scored 100.

Rechecked NAP-SHELL and NAP-THEME at napplet/naps commit
e5308ac92cfd49e4fb026812c60886571515e219. Theme capture conforms. No wire semantics
changed; the previously recorded shell-contract drift is deferred outside this
presentation work.

Destination checks: github.com/kernlize/web returned 404; npm automated access
returned 403; jsr.io/@kernl returned 200. Keep the supplied identities in the film
and footer, while the main source navigation retains the working repository URL.

Continues PR #296. Runtime identity commit d55930d3; browser assertion follow-up
6888141b. Film and planning closeout ship in the same branch.
