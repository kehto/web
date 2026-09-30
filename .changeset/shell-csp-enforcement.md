---
'@kehto/shell': minor
'@kehto/paja': minor
---

Add shell-owned NIP-5D CSP construction and verified-srcdoc preparation with validated host overrides. Paja and the playground use the shared preparation path. Hosts can customize source lists and grant exact connection origins while the shell rejects broad JavaScript evaluation, wildcard connections, unsupported meta directives, and policies that disable the mandatory bootstrap.

Paja runtime configuration accepts CSP overrides. Its compatibility CSP helper now rejects invalid origin grants, and generated meta policies omit ineffective frame-ancestors and unsupported prefetch-src directives. Set frame-ancestors on the host HTTP response when required.
