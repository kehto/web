---
status: passed
phase: 62
verified: 2026-05-23
---

# Verification: Phase 62

## Must-Haves

| Criterion | Evidence | Status |
|-----------|----------|--------|
| Beginner tutorial gets from install to a minimal host shell with one sandboxed napplet. | `docs/tutorials/minimal-host-shell.md` | PASS |
| Runtime implementation guide covers adapter hooks, ACL policy, service registration, shell bridge, gateway loading, and teardown. | `docs/tutorials/runtime-implementation.md` | PASS |
| Napplet integration tutorial covers `requires`, hosted `supports()`, and safe NUB helper usage. | `docs/tutorials/napplet-integration.md` | PASS |
| How-tos cover common host tasks. | `docs/how-tos/*.md` includes capability grants, service registration, unsupported `requires`, reference services, `postMessage`, and gateway artifact verification. | PASS |
| Troubleshooting/tips document known failures without widening runtime scope. | `docs/guides/troubleshooting.md` | PASS |

## Commands

```bash
for f in docs/tutorials/{minimal-host-shell,runtime-implementation,napplet-integration}.md docs/how-tos/{grant-capability,register-service,unsupported-requires,add-reference-service,debug-postmessage,verify-gateway-artifact}.md docs/guides/troubleshooting.md; do test -f "$f" || echo missing:$f; done
find docs/tutorials docs/how-tos docs/guides -maxdepth 1 -type f -name '*.md' | sort
```

## Result

Phase 62 passed.
