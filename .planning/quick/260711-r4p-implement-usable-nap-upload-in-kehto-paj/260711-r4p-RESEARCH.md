# Research: usable NAP-UPLOAD in Paja

## Outcome

Add an opt-in, real Blossom mode to Paja and keep the existing `memory` mode as an explicit simulator. Do not copy Hyprgate's `blossom-client-sdk` dependency: Kehto already ships the dependency-free `createHttpUploader`, which implements kind-24242 auth, SHA-256, `PUT <server>/upload`, and BUD-02 descriptor parsing. Paja's missing work is configuration, signer/policy integration, truthful status/result handling, and end-to-end proof.

Protocol authority checked: `napplet/naps` ref `a7cc17463cbf5d9cb87884b31071bc4fc826034c`, `naps/NAP-UPLOAD.md` on `origin/nap-upload`. The proposed path is conformant if the policy and integrity requirements below are implemented; the draft remains upstream and should be named in the PR body.

## Current state and reusable pieces

- `packages/paja/src/browser-adapter.ts:139-171,394,503` installs `createDevUploader` only when `upload.mode === "memory"`. It returns a fabricated `kehto-dev://` URL, never sends bytes, and reports immediate completion. The E2E at `tests/e2e/paja-single-window.spec.ts:388-400` checks only that an `upload.upload.result` message arrived.
- `packages/services/src/http-uploader.ts:96-267` is the right transport primitive. It hashes bytes, constructs NIP-98 or Blossom auth, uses a shell-owned signing callback, uploads, and returns a descriptor. `@kehto/paja` already depends on and imports `@kehto/services`; no dependency is needed.
- `packages/services/src/upload-service.ts:227-368` already owns correlation IDs, per-window status isolation, `upload.info`, status lookup, push forwarding, and teardown cancellation.
- Paja already supplies real signing choices. `createRuntimeSigner` (`browser-adapter.ts:288-309`) selects the generated dev signer or the connected NIP-07/NIP-46 signer. Both sign paths call the existing browser confirmation boundary; a fixed pubkey without a connected signer is read-only and must return `no signer available`, not fake success.
- Paja's ACL already gates `upload.*` via `upload:write`, but there is no host policy for rail, byte size, or MIME type. `createUploadService` does not enforce these itself.

## Hyprgate guidance to preserve

Hyprgate's `apps/shell/src/lib/services/upload-blossom.ts:82-187` demonstrates the desired backend behavior: reject non-Blossom hints, resolve shell-owned servers, require a writable signer, emit `uploading`, sign kind 24242 auth, upload real bytes, return HTTPS/NIP-94 integrity metadata, support cancellation, and never expose signer or server selection to the napplet. Its unit tests cover configuration, signer absence, auth modes, rejection, status, result format, and cancellation; its integration test proves the bytes landed on an in-process server and that kind 24242 was signed.

Hyprgate discovers a signed-in user's ordered Blossom servers from BUD-03 kind `10063` (`blossom-servers.ts:27-60`) and keeps result-format/auth preferences local. Paja should use the same priority without importing Hyprgate code:

1. Explicit Paja CLI/config servers (developer intent) win.
2. If enabled and a signer pubkey plus relay backend are available, query the newest kind `10063` event and parse ordered `server` tags.
3. If neither source yields a server, fail with `no server configured`. Do not silently egress to a public default and do not reuse runtime-pointer `blossomServers`; those are artifact-fetch hints, not upload policy.

Unlike Hyprgate, Paja should initially return the direct HTTPS descriptor. BUD-10 construction is not available without new code/dependencies and is not required by NAP-UPLOAD. `upload.info` should advertise `returns: ["https"]` from the same effective config used by uploads so introspection cannot drift from behavior.

## Recommended implementation shape

1. Extend `PajaSimulationRawOptions.upload` and `PajaSimulation.upload` in `packages/paja/src/simulation.ts`:
   - `mode: "memory" | "blossom" | "disabled"`
   - `servers: readonly string[]`
   - optional `discoverServers` (default `true` only for Blossom mode)
   - optional `maxBytes` and `mimeTypes` as Paja host policy
   - retain `rail` only for memory mode; Blossom's rail is always `blossom`.
   Validate and normalize HTTP(S) server base URLs, remove trailing slashes, deduplicate in order, and reject credentials/empty values. Keep default mode `memory` for backwards-compatible deterministic authoring; real usage is one flag away.
2. Add repeatable `--upload-server <url>` and accept `--upload-mode blossom` in `packages/paja/src/cli.ts`. Config JSON uses `simulation.upload.servers`. Array CLI overrides should replace the config-file list, matching the current shallow `upload` merge. Update CLI help and runtime summary so operators can see `upload:blossom:<n>` rather than assume a real backend is active.
3. Add a small Paja upload adapter (prefer a separate `browser-upload.ts`) that:
   - enforces mode, `rail === blossom`, max bytes, and MIME allowlist before signing or fetch;
   - resolves explicit/BUD-03 servers through the existing `PajaRelayBackend.query` (kind `10063`, active author, newest event);
   - obtains `createRuntimeSigner(...)`, verifies `signEvent` exists, then constructs `createHttpUploader({ rails: { blossom: { servers } }, defaultRail: "blossom", signEvent })`;
   - uses the same effective resolver for `createUploadService({ uploader, uploadInfo })` and the shell adapter's upload capability hook.
4. Add upload-specific consent before egress. The draft says the prompt should show napplet identity, size, MIME type, target server, and public/durable nature. Paja's current generic prompt (`browser-host.ts:253-268`) shows only event kind/content, so a kind-24242 prompt alone is insufficient. Extend `PajaConfirmationRequest` as a discriminated union with an `upload` action/details. A double prompt (upload consent plus generic auth-sign confirmation) is safe but clumsy; preferably treat the upload approval as authorization for only the immediately constructed kind-24242 event and retain existing prompts for unrelated signing. Do not add remembered allowances in this slice.
5. Tighten `createHttpUploader` because Paja will expose it as real behavior:
   - emit an `uploading` status with `bytesTotal` before `fetch`;
   - for Blossom, require returned `sha256` to equal the locally computed hash and returned `size` (when present) to equal the byte length; reject mismatches rather than reporting `complete`;
   - include NIP-94 tags `url`, optional `m`, `x`, and `size` in the result;
   - pass an `AbortSignal` and implement `cancel` if practical. This matches Hyprgate's teardown semantics. Multiple-server mirroring may be deferred: current `createHttpUploader` explicitly uses the first server, so failover/mirroring is not required for the first usable Paja slice, but docs must say so.

## Tests and documentation

- `packages/services/src/http-uploader.test.ts`: uploading status; Blossom NIP-94; hash/size mismatch rejection; abort/cancel if added; retain exact kind-24242 tags/header/body assertions.
- New `packages/paja/src/browser-upload.test.ts`: explicit server resolution; newest kind-10063 discovery; explicit-over-discovered priority; missing signer/server; policy denial before sign/fetch; rail rejection; consent denial; truthful `upload.info`.
- `packages/paja/src/cli.test.ts`, `options.test.ts`, `config-file.test.ts`: Blossom mode, repeatable server flags, URL validation, list override, and normalized summary.
- Strengthen `tests/e2e/paja-single-window.spec.ts` with an in-process Blossom HTTP server (including CORS preflight). Start Paja in Blossom mode, accept consent, decode/verify the `Nostr` Authorization event as kind 24242 with matching `x`, store the received bytes, return a descriptor, and assert the napplet receives the real HTTP URL/hash/size. This is the proof missing today; a mocked `upload.upload.result` is not enough.
- Update `packages/paja/README.md`, `docs/packages/paja.md`, `docs/how-tos/paja-getting-started.md`, CLI help/examples, and add a Paja changeset. If `@kehto/services` shipped behavior changes, add its changeset too.

## Pitfalls / stop conditions

- Browser uploads require the Blossom server to allow Paja's origin and `Authorization`/`Content-Type` CORS headers. Surface CORS/network failures distinctly enough to debug; do not call them successful.
- Do not use a napplet-provided server or metadata field as an endpoint. Server selection is shell policy.
- Do not advertise Blossom enabled when the effective resolver has no server or signer. `upload.info` remains advisory and uploads must still work without calling it first.
- A response URL alone is weak proof. Completion requires the server descriptor plus matching locally computed hash/size; E2E must verify stored bytes.
- Preserve window-scoped status lookup and teardown cleanup from `createUploadService`; do not move protocol bookkeeping into Paja.
- Verification before shipping: `pnpm build`, `pnpm type-check`, `pnpm test:unit`, the targeted Paja Playwright spec (then relevant `pnpm test:e2e`), `pnpm docs:check`, `pnpm dlx aislop@0.12.0 scan --changes --base origin/main` at 100/100, `git diff --check`, atomic Lore commit, push, and PR. PR/final report must cite the pinned NAP-UPLOAD ref and state conformance.

## RESEARCH COMPLETE

Output: `/home/sandwich/Develop/kehto/.planning/quick/260711-r4p-implement-usable-nap-upload-in-kehto-paj/260711-r4p-RESEARCH.md`
