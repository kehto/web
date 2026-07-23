---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 0
total_count: 2
last_updated: 2026-07-23T14:09:52.589Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 101 | unrun-verify | packages/shell/README.md |  | pnpm docs:check final audit blocked by unrelated docs/packages/paja.md version row | open |  | 2026-07-23T14:09:52.533Z |  |
| 2 | 101 | deviation | packages/paja/src/parity.test.ts |  | Rule 3 fixture correction removed stale ShellCapabilities fields to restore type-documentation generation | open |  | 2026-07-23T14:09:52.589Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "101",
    "file": "packages/shell/README.md",
    "line": null,
    "description": "pnpm docs:check final audit blocked by unrelated docs/packages/paja.md version row",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-23T14:09:52.533Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "deviation",
    "phase": "101",
    "file": "packages/paja/src/parity.test.ts",
    "line": null,
    "description": "Rule 3 fixture correction removed stale ShellCapabilities fields to restore type-documentation generation",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-07-23T14:09:52.589Z",
    "resolved_at": null
  }
]
````
