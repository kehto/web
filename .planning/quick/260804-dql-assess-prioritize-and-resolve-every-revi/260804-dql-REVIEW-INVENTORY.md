---
pr: https://github.com/kehto/web/pull/234
captured_at: 2026-08-04
captured_head: 4fdf37c1d6ea65caab04b81e35596dded4fa71a9
live_threads: 16
live_claims: 21
status: in-progress
---

# PR #234 Review Inventory

The inventory is the handoff contract for live review claims. Review text and
installed declarations are evidence to assess, not protocol authority. `Queued`
means a claim is valid and assigned; replies/resolutions remain forbidden until a
supporting commit has been pushed and exact-head CI is reconciled.

## Live Reconciliation and Package Check

- GraphQL captured 2026-08-04: **16 unresolved threads**, **16 comments**, and
  **21 distinct claims** (two comments contain two claims and one contains three).
  This is the live count; do not reuse a stale expanded-comment count.
- All planning-time draft heads still match their current PR heads. Every full
  authority named below was fetched and read at the immutable SHA before source
  editing.
- Checked installed `@napplet/core@0.31.1` and `@napplet/nap@0.31.2` in the
  shared pnpm store. Their exported `CommonProfileTarget`, FS request/result,
  serial, BLE, DM, notify, and config families agree with the cited drafts; no
  package drift affects these claims.

## Authority Map

| Key | Complete immutable authority | Required mapping for its claims |
| --- | --- | --- |
| A-COMMON | `napplet/naps:naps/NAP-COMMON.md@de603e205a9b498f252be9a5e8e6825c4648df39` | `common.getProfile` is napplet→shell with `id,target`, accepts hex/npub/nprofile and returns `id,ok,pubkey,profile?,result?,error?`; follow/unfollow are `id,pubkeys`, use `invalid-pubkey`, and are idempotent. Relay TLVs are advisory, untrusted hints; shell relay policy owns routing. |
| A-FS | `napplet/naps:naps/NAP-FS.md@b640cf337c0481f0f9a0216c00843f797a5c6df6` | `fs.write` is `id,path,data,options?`; decoded bytes MUST not exceed `maxWriteBytes`, malformed data is `invalid-data`, and `too-large` is canonical. Every request has one result; revisions are opaque preconditions. Byte operations are DoS surfaces and watch IDs are per-napplet. |
| A-SERIAL | `napplet/naps:naps/NAP-SERIAL.md@a3891d4bab8ec9418a1ebacba9e261b89b7297ee` | `serial.open/write/close` are correlated; `serial.event` is pushed and id-less. Errors include `write failed`/`session not found`. Runtime scopes sessions to the napplet, closes them at unload/lost permission, preserves write order, and owns lifecycle limits. |
| A-BLE | `napplet/naps:naps/NAP-BLE.md@e14de22a794d24c2431834105d50efd0bd89d459` | `ble.subscribe`/`unsubscribe` are correlated and `ble.event` is pushed. Subscribe has no descriptor target; errors include `operation not supported`/`device disconnected`. Sessions and notifications remain runtime-owned and close at unload/policy loss. |
| A-DM | `napplet/naps:naps/NAP-DM.md@a0a48588b3c9caca9540cccec19635b85231a00f` | `dm.subscribe` is correlated and returns `subscriptionId`; `dm.message` is an id-less push with `subscriptionId,message`. Errors include `unavailable`, `forbidden`, `not found`; runtime policy owns visibility and subscription lifecycle. |
| A-NOTIFY | `napplet/naps:naps/NAP-NOTIFY.md@e14f5c9d6a6dd2a69ccf79668c4a3c1e955e1ac9` | Permission request is correlated with optional `channel`; result has `granted`. `invalid channel` is canonical. Shell tracks active notifications per napplet and MUST remove them on iframe removal; prompts are an async policy action. |
| A-CONFIG | `napplet/naps:naps/NAP-CONFIG.md@448013e6d8cb8c75dce49576b3e7c0d46d960eac` | `config.get` is correlated; `config.values` and `config.schemaError` are pushes. Shell validates before delivery, reports named schema errors, scopes subscriptions to source, and unmount implicitly unsubscribes. |
| A-NIP5D | `nostr-protocol/nips:5D.md@eb45dfd7335b7f88cb53781984c553581d2b4c34` | Only granted domains may exist in `window.napplet`; presence means available and absence unavailable. `MessageEvent.source` is lifecycle identity; unknown types are silent. Individual payloads remain NAP-owned. |

## Claim Ledger

Every row preserves the stable thread/comment ID and URL. “Commit/reply/resolution”
is intentionally blank until the assigned plan completes its focused regression.

| Claim | Thread/comment and URL | P | Anchor | Assessment, reproduction, and authority mapping | Status / commit / reply / resolution |
| --- | --- | --- | --- | --- | --- |
| C01 | `PRRT_kwDOR8P3P86WJK4E` / `PRRC_kwDOR8P3P87dBmET` [link](https://github.com/kehto/web/pull/234#discussion_r3708182803) | P1 | `browser-common.ts:72` | **Fixed.** Red regression: `0df7bd7`; `ws://127.0.0.1:8080` is excluded while allowed nprofile and configured relays reach the query. A-COMMON makes hints advisory/untrusted and A-NIP5D makes Paja the mediation boundary. | Fixed Plan 01/T2: `3336770`; reply: —; resolution: unresolved |
| C02 | same thread/comment | P1 | `browser-common.ts:202` | **Fixed.** Red regression: `a4c9dd9`; follow and unfollow accept canonical hex and publish decoded targets. A-COMMON target fields and `invalid-pubkey` rules support normalization; action lifecycle is idempotent. | Fixed Plan 01/T2: `5826849`; reply: —; resolution: unresolved |
| C03 | `PRRT_kwDOR8P3P86WJLk4` / `PRRC_kwDOR8P3P87dBnGo` [link](https://github.com/kehto/web/pull/234#discussion_r3708187048) | P1 | `browser-fs-support.ts:182` | **Fixed.** Red regression: `84613ce`; a canonical base64 payload decoding to `MAX_WRITE_BYTES + 1` returns `too-large` without calling `atob`. A-FS requires decoded-limit enforcement and identifies `too-large` as the canonical result. | Fixed Plan 01/T3: `d5f9d12`; reply: —; resolution: unresolved |
| C04 | same thread/comment | P2 | `browser-fs-support.ts:214` | **Fixed hardening.** Red regression: `84613ce`; a fake file above named `MAX_REVISION_BYTES` returns `too-large` without `arrayBuffer`. A-FS calls byte work a DoS surface but gives no revision number/algorithm; 16 MiB remains explicit Kehto policy. | Fixed Plan 01/T3: `d5f9d12`; reply: —; resolution: unresolved |
| C05 | `PRRT_kwDOR8P3P86WJMAp` / `PRRC_kwDOR8P3P87dBnvG` [link](https://github.com/kehto/web/pull/234#discussion_r3708189638) | P2 | `browser-device-services.ts:269` | **Fixed.** Re-read A-SERIAL at `a3891d4bab8ec9418a1ebacba9e261b89b7297ee`: `serial.write` is napplet→runtime (`id,sessionId,data`), `serial.write.result` is runtime→napplet (`id,error?`), every request has one same-id result, and the runtime MUST preserve per-session write order while scoping/closing sessions on unload or lost permission; its security boundary retains raw streams/ports in the runtime. Red regression: `7904622` proves the rejected caller observes `write failed` while the next ordered write runs and both writers release locks. | Fixed Plan 02/T1: `4fcb0d6`; reply: —; resolution: unresolved |
| C06 | same thread/comment | P2 | `browser-device-services.ts:490` | **Fixed.** Re-read A-BLE at `e14de22a794d24c2431834105d50efd0bd89d459`: `ble.unsubscribe` is napplet→runtime (`id,sessionId,target`) and its result is runtime→napplet (`id,error?`); every request receives a same-id result, subscriptions/notifications are runtime-owned, sessions close on unload or permission loss, and raw Bluetooth objects must never cross the boundary. The NAP does not define missing-subscription idempotency or browser cleanup ordering, so delete-before-await preserves Paja’s existing no-op retry contract as explicit Kehto lifecycle policy while returning the original platform error. Red regression: `fc51f55` proves listener/map ownership is released if `stopNotifications()` rejects. | Fixed Plan 02/T2: `da4dcc2`; reply: —; resolution: unresolved |
| C07 | `PRRT_kwDOR8P3P86WJM6_` / `PRRC_kwDOR8P3P87dBpEK` [link](https://github.com/kehto/web/pull/234#discussion_r3708195082) | P2 | `services/fs-service.ts:198` | **Valid.** Destroy during awaited `backend.watch()` leaks a late handle. A-FS scopes watches to napplet identity; reserve/recheck/close is required lifecycle implementation. | Queued Plan 03; — / — / unresolved |
| C08 | `PRRT_kwDOR8P3P86WJNnX` / `PRRC_kwDOR8P3P87dBqE5` [link](https://github.com/kehto/web/pull/234#discussion_r3708199225) | P2 | `browser-fs.ts:198` | **Duplicate root cause of C07, separate actionable thread.** Same late-watch regression must prove Paja and service cleanup together. A-FS mapping is C07's mapping. | Queued Plan 03 with C07; — / — / unresolved |
| C09 | `PRRT_kwDOR8P3P86WJOEe` / `PRRC_kwDOR8P3P87dBqvG` [link](https://github.com/kehto/web/pull/234#discussion_r3708201926) | P2 | `services/dm-nip17-adapter.ts:215` | **Valid.** Synchronous relay callback precedes live-map insertion and drops first message. A-DM requires subscription-scoped `dm.message` delivery; no error applies. | Queued Plan 03; — / — / unresolved |
| C10 | `PRRT_kwDOR8P3P86WJOil` / `PRRC_kwDOR8P3P87dBrbi` [link](https://github.com/kehto/web/pull/234#discussion_r3708204770) | P2 | `services/serial-service.ts:98` | **Valid.** Captured send can emit after destruction/reuse. A-SERIAL unload scope plus A-NIP5D source identity requires late send to be no-op. | Queued Plan 04; — / — / unresolved |
| C11 | same thread/comment | P2 | `services/serial-service.ts:115` | **Valid projection policy.** Synchronous open-time event precedes correlated open result. A-SERIAL separates result/event but does not expressly order them; Kehto policy is result-first then buffered events. | Queued Plan 04; — / — / unresolved |
| C12 | `PRRT_kwDOR8P3P86WJPG7` / `PRRC_kwDOR8P3P87dBsTX` [link](https://github.com/kehto/web/pull/234#discussion_r3708208343) | P2 | `services/relay-pool-service.test.ts:132` | **Valid.** Deleted map entry does not invalidate captured notification callbacks. A-NOTIFY requires cleanup on iframe removal; active-map identity check prevents post-destroy sends. | Queued Plan 04; — / — / unresolved |
| C13 | `PRRT_kwDOR8P3P86WJPk4` / `PRRC_kwDOR8P3P87dBtB9` [link](https://github.com/kehto/web/pull/234#discussion_r3708211325) | P2 | `services/config-service.ts:247` | **Valid.** Throwing host `getValues` escapes get and subscription initialization. A-CONFIG requires validated shaped delivery; conversion of host exceptions is Kehto boundary policy. | Queued Plan 05; — / — / unresolved |
| C14 | `PRRT_kwDOR8P3P86WJQAi` / `PRRC_kwDOR8P3P87dBts-` [link](https://github.com/kehto/web/pull/234#discussion_r3708214078) | P2 | `browser-config.ts:66` | **Valid UI lifecycle defect.** Native close/Escape bypasses cancel cleanup and retains secret bindings. A-CONFIG implies source cleanup but does not define DOM; no wire change. | Queued Plan 05; — / — / unresolved |
| C15 | `PRRT_kwDOR8P3P86WJQck` / `PRRC_kwDOR8P3P87dBuZ0` [link](https://github.com/kehto/web/pull/234#discussion_r3708216948) | P2 | `browser-notify.ts:128` | **Valid security hardening.** Unknown channel can prompt before rejection. A-NOTIFY defines `invalid channel` and async permission but not validation order; Kehto validates before prompt to prevent prompt abuse. | Queued Plan 05; — / — / unresolved |
| C16 | `PRRT_kwDOR8P3P86WJQ3J` / `PRRC_kwDOR8P3P87dBu-r` [link](https://github.com/kehto/web/pull/234#discussion_r3708219307) | P2 | `browser-adapter-intent.test.ts:126` | **Valid test defect.** Negated `arrayContaining` passes with one forbidden domain leaked. A-NIP5D allows only granted domain objects; assert each forbidden member. | Queued Plan 06; — / — / unresolved |
| C17 | `PRRT_kwDOR8P3P86WJRam` / `PRRC_kwDOR8P3P87dBvxw` [link](https://github.com/kehto/web/pull/234#discussion_r3708222576) | P2 | `paja-single-window.spec.ts:147` | **Valid test defect.** One of `upload`/`webrtc` may leak while matcher passes. A-NIP5D mapping is C16's. | Queued Plan 06; — / — / unresolved |
| C18 | same thread/comment | P2 | `paja-single-window.spec.ts:199` | **Valid test defect.** Same matcher hides one leaked fixture-only domain/service. A-NIP5D mapping is C16's. | Queued Plan 06; — / — / unresolved |
| C19 | `PRRT_kwDOR8P3P86WJSMu` / `PRRC_kwDOR8P3P87dBw99` [link](https://github.com/kehto/web/pull/234#discussion_r3708227453) | P2 | `paja-getting-started.md:115` | **Valid documentation contradiction.** Earlier generated-default signer wording conflicts with unsigned start. A-NIP5D forbids direct signer exposure; docs must require explicit Dev/NIP-07/NIP-46 selection. | Queued Plan 06; — / — / unresolved |
| C20 | `PRRT_kwDOR8P3P86WJSg0` / `PRRC_kwDOR8P3P87dBxah` [link](https://github.com/kehto/web/pull/234#discussion_r3708229281) | P2 | `paja-local-authoring.md:213` | **Valid documentation drift.** “never advertises DM” conflicts with conditional live DM. A-DM/A-NIP5D say domain presence signals granted availability; record signer + live-relay condition. | Queued Plan 06; — / — / unresolved |
| C21 | `PRRT_kwDOR8P3P86WJTKZ` / `PRRC_kwDOR8P3P87dByWa` [link](https://github.com/kehto/web/pull/234#discussion_r3708233114) | P3 | `260802-q92-PLAN.md:39` | **Valid planning-record correction.** Abbreviated hashes are not immutable authority IDs and the must-have list omits DM/FS coverage. Process claim; A-NIP5D/NAP documents govern domains, not planning format. | Queued Plan 06; — / — / unresolved |

## Handoff Rules

1. Append focused tests, commits, replies, and resolution state to these exact rows;
   preserve all stable IDs and URLs.
2. Re-read the cited immutable authority before every implementation and distinguish a
   protocol requirement from an explicit Kehto policy.
3. C07/C08 have one root cause but are two independently actionable review threads.
4. Do not reply to or resolve any thread until the supporting commit is pushed and
   the final plan has checked CI for that exact head.
