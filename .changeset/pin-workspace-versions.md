---
"@kehto/cli": patch
"@kehto/paja": patch
"@kehto/runtime": patch
"@kehto/services": patch
"@kehto/shell": patch
---

Pin internal `@kehto/*` dependencies to explicit caret version ranges instead of
the `workspace:*` protocol, so published packages (npm and JSR) carry correct,
resolvable dependency versions. The ranges mirror the existing `jsr.json` imports.
