---
"@kehto/acl": minor
"@kehto/runtime": minor
"@kehto/services": minor
"@kehto/shell": minor
---

feat: implement NAP-UPLOAD shell-mediated file/blob upload

Adds shell-side support for NAP-UPLOAD: a napplet hands the shell raw bytes plus
upload intent; the shell selects a storage backend, signs the rail's
authorization, performs the HTTP upload, and returns a stable URL plus NIP-94
integrity metadata. The interface is deliberately abstract over the backend — the
runtime decides *how* it uploads (NIP-96, Blossom, …). Napplets never receive
signing keys, server credentials, or direct network access.

- `@kehto/acl`: new `upload:write` capability and `upload.*` capability
  resolution (napplet requests → sender gate; shell→napplet result/status pushes
  → recipient gate). `class-2` excludes `upload:write` (network egress +
  identity-linking is class-1 only).
- `@kehto/runtime`: routes the `upload` domain to a registered `upload` service
  with ACL enforcement, and registers the `upload:write` ACL-state bit.
- `@kehto/services`: `createUploadService` (pure `upload.*` envelope router that
  owns the per-napplet uploadId, tracks status for `upload.status` queries, and
  streams `upload.status.changed` progress) and `createHttpUploader` (concrete
  reference backend implementing the NIP-96 (NIP-98 auth) and Blossom (kind
  24242 auth) rails over an injected `signEvent` + `fetch`).
- `@kehto/shell`: advertises `upload` via `shell.supports("upload")` when an
  upload backend (`ShellAdapter.upload`) is wired.
