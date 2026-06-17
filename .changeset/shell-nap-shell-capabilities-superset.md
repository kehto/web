---
"@kehto/shell": minor
---

feat(shell): emit conformant NAP-SHELL `capabilities.{domains,protocols}` superset

`shell.init` now carries the conformant NAP-SHELL capability shape alongside the
legacy fields:

```
capabilities: {
  domains: string[],                      // bare NAP domain names
  protocols: Record<string, string[]>,    // e.g. { inc: ['NAP-01'..'NAP-06'] }
  naps, nubs, sandbox                      // legacy back-compat (TERM-05)
}
```

This is the shape the released `@napplet/shim@0.13` reads to answer
`supports(domain)` and `supports(domain, 'NAP-N')` — validated against the real
0.13 shim's resolution logic. `domains`/`protocols` are emitted as a **superset
alongside** the legacy `naps`/`nubs`/`sandbox` fields so the installed 0.5.0
playground shim keeps working (dual-emit; removal tracked as CLEANUP-01). Host
apps that extended the `sandbox` array see those `perm:`-prefixed entries folded
into `domains` (the 0.13 shim has no separate permission namespace), preserving
the default-empty sandbox behavior.

**Migration for consumers:** none required — the capability object is a superset
and every previously-emitted field is retained. Hosts on `@napplet/shim@0.13`
gain conformant `supports(domain, protocol?)` answers; hosts on older shims read
the unchanged legacy fields.
