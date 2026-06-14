# NAP-UPLOAD — Shell-mediated file/blob upload (kehto runtime)

**Date:** 2026-06-14
**Status:** Approved (autonomous /goal execution)
**Spec source:** `napplet/nubs` PR #33 / branch `nap-upload` (`NAP-UPLOAD.md`)
**SDK side:** `napplet/web` `packages/nap/src/upload/*` + `packages/core/src/types.ts` (already shipped)

## Goal

Implement the **shell/runtime side** of NAP-UPLOAD in kehto. A napplet hands the
shell raw bytes plus a description of an intended upload; the shell selects a
storage backend, constructs and signs the rail's authorization, performs the
HTTP upload, and returns a stable URL plus NIP-94 integrity metadata. The
interface is deliberately **abstract over the backend** — the runtime decides
*how* it uploads (NIP-96, Blossom, …). Napplets never receive signing keys,
server credentials, or direct network access.

## Wire protocol (NIP-5D, already defined in `@napplet/core`)

The protocol types (`UploadRequest`, `UploadResult`, `UploadStatus`,
`UploadRail`, `UploadState`, `UploadDimensions`) already exist in
`@napplet/core` and are consumed via the existing peer dependency — kehto does
**not** redefine them.

| Type | Direction | Payload |
|------|-----------|---------|
| `upload.upload` | napplet → shell | `id`, `request` |
| `upload.upload.result` | shell → napplet | `id`, `result?`, `error?` |
| `upload.status` | napplet → shell | `id`, `uploadId` |
| `upload.status.result` | shell → napplet | `id`, `status?`, `error?` |
| `upload.status.changed` | shell → napplet | `status` (push, no `id`) |

`request.data` is a `Blob | ArrayBuffer` and crosses the boundary by structured
clone — no base64. The shell SHOULD return a structured `result` with
`ok: false` when an upload was created and then failed/cancelled, and a
top-level `error` when no upload was created.

## Architecture (mirrors NAP-OUTBOX, the most recent vertical slice)

### 1. ACL — `@kehto/acl`
- `capabilities.ts`: add `'upload:write'` to `ALL_CAPABILITIES`; export
  `CAP_UPLOAD_WRITE`.
- `resolve.ts`: add `uploadMap(action)` and a `case 'upload'`:
  - Shell→napplet pushes (`status.changed`, `*.result`, `*.error`) →
    `senderCap: null, recipientCap: 'upload:write'` (a napplet without the cap
    never sees results/progress).
  - Everything else (`upload`, `status`, unknown) → `senderCap: 'upload:write',
    recipientCap: null`.

**Capability decision — a single `upload:write`.** Uploading is the sensitive
op (network egress + identity-linking). `status()` only queries the requesting
napplet's *own* uploads, so it rides the same grant rather than warranting a
separate `upload:read`. This keeps the surface minimal.

### 2. Runtime class enforcement — `@kehto/runtime/enforce.ts`
Add `upload:write` to the `class-2` exclusion set (alongside `relay:write`,
`identity:decrypt`, `outbox:write`). Egress + identity-linking is a class-1-only
op; a restricted napplet cannot upload.

### 3. Runtime dispatch — `@kehto/runtime`
- `domain-handlers.ts`: add `upload` to `RuntimeDomainHandlers`, widen the
  `handleServiceOnlyMessage` name union, and route
  `upload: (windowId, msg) => handleServiceOnlyMessage(context, 'upload', …)`.
- `runtime.ts`: `nubDispatch.registerNub('upload', adapt(handlers.upload));`
  (the registerNub lesson — registering the service is not enough; the domain
  must be wired into the dispatcher).

### 4. Services — `@kehto/services`
- **`upload-service.ts`** — `createUploadService({ uploader, generateId?, now? })
  → ServiceHandler`. A pure envelope router, exactly like `outbox-service.ts`:
  - Owns `uploadId` generation (injectable `generateId`, default
    `crypto.randomUUID`), scoped per napplet window.
  - Tracks the latest `UploadStatus` per `windowId:uploadId` for
    `upload.status` queries and `onWindowDestroyed` cleanup.
  - On `upload.upload`: builds a `UploaderContext` whose `onStatus(status)`
    stamps `uploadId`/`updatedAt`, records the latest status, and pushes
    `upload.status.changed`; calls `uploader.upload(request, ctx)`; stamps and
    replies `upload.upload.result`. Rejects missing `data` with a top-level
    `error`.
  - On `upload.status`: replies `upload.status.result` from tracked state,
    falling back to `uploader.status?.(uploadId)`; `error` when unknown.
  - `onWindowDestroyed`: drops tracked uploads and calls `uploader.cancel?`.
  - Abstract injected interface (the "runtime decides the backend" seam):
    ```ts
    interface UploaderContext { uploadId: string; windowId: string;
      onStatus(status: UploadStatus): void }
    interface Uploader {
      upload(request: UploadRequest, ctx: UploaderContext): Promise<UploadResult>;
      status?(uploadId: string): Promise<UploadStatus | undefined>;
      cancel?(uploadId: string): void;
    }
    ```
- **`http-uploader.ts`** — `createHttpUploader({ rails, signEvent, fetch?,
  digestSha256?, now? }) → Uploader`. The concrete reference backend (analog of
  `relay-pool-outbox-router.ts`):
  - **NIP-96**: compute sha256, build + sign a NIP-98 (kind 27235) auth event
    (`u`, `method`, `payload` tags), POST `multipart/form-data` with
    `Authorization: Nostr <base64(event)>`, parse the NIP-96 JSON response
    (`nip94_event.tags` → url/x/ox/size/dim/m → `UploadResult` + `nip94`).
  - **Blossom**: compute sha256, build + sign a kind 24242 auth event
    (`t: upload`, `x`, `expiration`), PUT bytes to `<server>/upload`, parse the
    blob descriptor (`url`/`sha256`/`size`/`type`).
  - Rail selection: explicit `request.rail`, else first configured default;
    unknown/unconfigured rail → structured `ok:false` error
    (`unsupported rail` / `no server configured`).
  - `signEvent` and `fetch`/`digestSha256` are injected so the uploader is
    fully unit-testable and carries no Nostr/transport dependency. Uploads are
    synchronous (resolve to `complete`/`failed`); the progress-push path is
    exercised through the service layer with a mock uploader.
- `index.ts`: export `createUploadService`, `createHttpUploader`, and their
  public types.

### 5. Shell — `@kehto/shell`
- `types.ts`: add an optional `upload?: UploadHooks` to `ShellAdapter` — a
  presence signal that an upload backend is configured (the host app still
  wires the concrete service via `runtime.registerService('upload', …)`,
  matching how outbox/relay services are registered).
- `shell-init.ts`: advertise `'upload'` in `buildShellCapabilities` when
  `hooks.upload` is present, so napplets discover it via
  `shell.supports('upload')`.

### 6. Tests
- `runtime/src/upload-dispatch.test.ts`: domain routing to a registered
  `upload` service; ACL denial → `upload.upload.error`; class-2 denied
  `upload.upload`; (status request reaches the service).
- `services/src/upload-service.test.ts`: mock `Uploader` — result marshalling,
  `uploadId` stamping, status tracking + `upload.status` lookup, progress
  `upload.status.changed` push, missing-`data` rejection, window-teardown
  cleanup + `cancel`.
- `services/src/http-uploader.test.ts`: mock `fetch` + `signEvent` — NIP-96
  happy path (auth header + multipart + nip94 parse), Blossom happy path
  (kind 24242 + PUT + descriptor parse), unsupported/unconfigured rail,
  server-rejection error mapping, sha256 computation.

### 7. Release & stop condition
- `.changeset/nap-upload.md`: minor bump for `@kehto/acl`, `@kehto/runtime`,
  `@kehto/services`, `@kehto/shell`.
- `pnpm build` + `pnpm type-check` + full test run green.
- `npx aislop scan` with a good score.
- Push branch `feat/nap-upload` to remote, tag, publish packages to npm.

## Out of scope (YAGNI)
- Real streaming upload progress (fetch lacks portable upload progress); the
  reference uploader is synchronous, the push protocol is still implemented and
  tested via a mock uploader.
- Consent UI, per-napplet policy/quota enforcement, EXIF stripping — these are
  host-app concerns behind the `Uploader`/`UploadHooks` seam, not runtime code.
- Additional rails (torrents, usenet) — the `UploadRail` open string + abstract
  `Uploader` keep them addable without API change.
