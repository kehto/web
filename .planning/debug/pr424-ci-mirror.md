---
status: verifying
trigger: PR 424 Playwright CI failure
---

## Evidence

- Exact PR head: 56d040514a70f3e972f9b54fd974cbd8e5c8908f.
- Run 43047484167 attempt 1: build, types, unit and scope jobs passed.
- Playwright never ran: install --with-deps failed with apt exit 100 and repeated
  Temporary failure resolving azure.archive.ubuntu.com while downloading fonts.
- Attempt 2 reran only failed jobs; remained in browser installation for minutes.
- No package behavior or NAP wire change is implicated.

## Fix

Before both Playwright dependency-install paths, set the hosted runner apt mirror
list to Ubuntu's primary HTTPS archive. Package signatures and mandatory install
commands are retained. Existing mirror+file apt source configuration consumes this
list. Does not change security mirror sources or other jobs.

## Verification

Pending fresh hosted run. Validate YAML and embedded Bash locally, then push the
CI-only fix on the existing PR branch and verify exact-head checks.
