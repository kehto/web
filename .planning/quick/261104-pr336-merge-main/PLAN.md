---
quick_id: 261104-pr336
description: Resolve PR 336 merge conflicts with main
---

# Resolve PR 336 merge conflicts with main

Merge `origin/main` into `feat/firewall-approvals` without dropping either side.

- Main's `@kehto/playground` retirement wins over every playground edit on this branch (`KEHTO_PLAYGROUND_RETIRED`).
- Firewall approvals survive and are ported onto code main rewrote: NAP-MEDIA registry, `openStream`, Paja scoped services.
- Paja admission composes with main's port-bound identity, frame-src lock, and nested-context lock.
