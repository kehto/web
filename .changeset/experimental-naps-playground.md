---
"@kehto/playground": minor
---

Host the toy `x-echo` experimental NAP through `ShellAdapter.extensions`: a tri-state toggle and prefix setting in the header, `x-echo` capabilities in the ACL panels, and per-napplet denial through `capabilities.resolveEnvironment`. Stored extension state is sanitized, `x-` ACL toggles without an explicit decision read the live ACL default policy, and the `__kehtoPlaygroundExtensions__` test hook exists only in dev builds or with `?kehto-test`.
