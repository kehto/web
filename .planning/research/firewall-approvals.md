# Firewall approval research and consumer matrix

Checked 2026-10-17 against baseline `0958a8b1` on `feat/firewall-approvals`.
Graph project: `kehto-firewall-approvals`. Primary checkout rebrand PR #296 and its package.json workspace edit are unrelated and untouched.

## Protocol authority

| Document | Exact source |
|---|---|
| NIP-5D | dskvr/nips `5560820fa4f37f45b8ab742a11aeb3001b17dc67`, `5D.md`, nostr-protocol/nips PR #2303 |
| NAP-SHELL / web projection | napplet/naps master `19de5ce1cea40cd4c76089cdd8126e9f87648049` |
| NAP-LINK | napplet/naps PR #53 `50a2cd45e76f06e87b87e93842badf4c61f17bde` |
| NAP-RESOURCE | PR #80 `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc` |
| NAP-FS | PR #88 `bd1b9e912f05203bf38f7a1b04f920744fe6d625` |
| NAP-CONNECT | PR #19 `ec81a3a4a1fc4da1ad2601215353b7f822e44b8f` |
| NAP-RELAY | PR #2 `9f30b3505335a52c574ff570576687d6467021ff` |
| NAP-OUTBOX | PR #32 `8865f73d52a4864afee145f28d26520476273927` |
| NAP-UPLOAD | PR #33 `f5cc981e527e2cc1572793a7a6e5082e5271ac49` |

Downloaded copies for this session: `/tmp/kehto-firewall-specs`. Re-fetch by exact ref when unavailable; recheck heads before shipping. Device, WebRTC, CVM and social specs must additionally be inspected before modifying their domain behavior.

## Findings and bounded policies

- Current Firewall `evaluate` combines policy, content matchers, bursts and token buckets. `allow` bypasses all controls. Runtime prompt rejects the current request and remembers a dTag-wide decision for future requests. Both behaviors must change in canonical wiring.
- ACL remains a hard restriction, not an alternative source of approval. Existing ACL capabilities must not become wider when Firewall grants an interface.
- New permission principals contain verified manifest key and artifact hash. NAP-RESOURCE explicitly requires publisher/kind/d isolation (snapshot event ID for snapshots), beyond NIP-5D's older tuple terminology. Existing catalog IDs provide suitable verified manifest keys. Preserve existing wire identity; add host-private principal metadata rather than replacing protocol identities.
- Development targets require an explicitly separate, exact-target identity. Never manufacture a verified publisher identity. Development grants cannot authorize a signed app or vice versa.
- Current NAP-SHELL is optional, and other domains cannot depend on shell.ready. The checked main implementation already registers source identity without the handshake. Older AGENTS wording declaring shell mandatory is stale; follow the task's explicit instruction to use authoritative protocol text.
- Required-domain denial will block launch as explicit Kehto admission policy; optional denial narrows exposure. Current NIP-5D allows warning for unsupported requirements, so stronger user-requested admission is policy, not a claim that NIP-5D mandates it.
- NAP-CONNECT's draft uses old aggregate folds and response-CSP navigation assumptions, conflicting with current single-artifact srcdoc loading and NAP-RESOURCE's direct-network-denial prerequisite. Do not claim full NAP-CONNECT conformance or invent connect wire messages. Implement explicit host network approvals under current CSP tooling, distinguish direct browser grants from mediated resource grants, and never expose a resource API whose isolation is bypassable. Complete the existing host network surfaces within this bounded policy; draft drift is not permission to omit network approval.
- Browser direct traffic cannot be metered by the parent. Rate limiting applies to mediated operations and prompts. Direct-origin grants require frame replacement on revocation; never claim per-request interception.
- Resource authorization must happen per URL, before cache delivery and on actual resolved network destinations. Cache keys remain the original byte-equal strings per NAP-RESOURCE. Scope normalization does not redefine wire/cache keys.
- Static host relay/Blossom discovery hints in Paja currently enter iframe connectOrigins automatically. Discovery is not approval. Playground static-origin lists also need migration.
- Rate module owns temporal math only. Content predicates stay Firewall policy. Legacy APIs must retain bounded diagnostics and documented migration; legacy broad allows never become new resource/network grants.
- Once applies to one accepted operation. Equivalent prompts can share presentation, but a one-use answer cannot release every queued operation. Session grants bind a registered endpoint generation; persistent grants bind verified principal and exact scope. Revocation invalidates queued/in-flight access.

## Consumer matrix

Every row is pending until code and behavior tests demonstrate migration. Discovery is not completion.

| Surface | Current owners | Required evidence |
|---|---|---|
| Pure policy/limits | packages/firewall/src/{evaluate,config,defaults,types,index}.ts | pure policy composition and separate temporal tests |
| Runtime ingress/consent | packages/runtime/src/{runtime,firewall-state,enforce,service-extensions,service-dispatch,types,persistence-types}.ts | canonical and registered-service approval, bounded concurrency, cancellation and rate enforcement |
| Identity/ACL | packages/acl/src; runtime acl-state/session-registry; nip/src/5d/current-manifest/catalog-id | publisher/artifact/session isolation, no ACL bypass |
| Shell source binding | packages/shell/src/{shell-bridge,shell-ready,shell-init,origin-registry,types}.ts | pre-execution grants, direct-message enforcement, immutable identity, generation invalidation |
| Link | services/link-service; paja/browser-adapter; playground demo-hooks | exact URL approved then opened once, canonical denial, teardown race |
| Resource | services/resource-service; paja resource resolver; playground demo-hooks | per-item approval, cancellation, cached and redirected destination checks |
| Relay/outbox/count | services/{relay-pool-service,coordinated-relay,outbox-service,count-service}; runtime relay-handler; host relay backends | selected destination checks and revocation of streams |
| FS/device/upload | services/{fs-service,ble-service,serial-service,upload-service}; paja/browser-device-services | operation/path/handle scopes, browser chooser remains enforced |
| Other mediated operations | services/{webrtc-service,cvm-service,common-service,lists-service,dm-service,intent-service}; paja/browser-webrtc and signer paths | interface gate plus relevant network/resource/account scopes; own NAP rules |
| Paja startup | paja/{browser-host,browser-target-frame,browser-dev-runtime,browser-adapter,simulation,config-file,host-page} | required denial blocks bytes, optional absence, all target/reload/intent paths |
| Paja remembered consent | paja/{browser-host-signer,browser-signer-consent,browser-signers,browser-devtools} | common approval ownership, account identity, settings/revoke and legacy migration |
| Playground | apps/playground/src/{playground-frame-loader,shell-host,demo-hooks,consent-modal,main} | equivalent startup/action UI and runtime enforcement |
| Integration and packaging | exports, package/jsr metadata, vitest aliases, typedoc/docs configs, release workflow | packaged imports, clean dependency graph, docs gate, changesets |
| Documentation | README, docs/packages, docs/compatibility, host guides/examples | no stale behavioral-only Firewall claims; executable examples |

## Acceptance matrix

| Area | Required proof |
|---|---|
| Decisions/scopes | interface AND resource/network composition, explicit denial priority, unknown categories, exact operation scope, adversarial URL/path/host cases |
| Principals | same dTag across publishers, root/snapshot, artifact update, dev vs signed, simultaneous frames and reload |
| Lifetime | once consumed once, session retired on replacement, durable validated roundtrip, malformed/unknown schema, load/save/revoke failures |
| Async | equivalent and different prompts, bounded queue, rejection/timeout, teardown, revocation, policy change while waiting, duplicate IDs, cloned immutable requests |
| Enforcement | no side effect on denial, no direct service/namespace bypass, parent-source trust, domain response and cancellation contracts |
| Rate | deterministic refill, burst reset, focus changes, finite validation, clock skew, unambiguous keys, approved apps still limited, prompt spam bounded |
| Hosts | Paja and playground browser flows for startup, link/resource/network scope, persistence and revocation, intent-created frames, local targets |
| Ship | pnpm build/type-check/test:unit/test:e2e/docs:check, configured aislop scan, changesets, push and open PR |

## Migration order

111: Introduce independent rate-limit primitive and pure approval policy; keep intermediate compatibility explicit.
112: Runtime coordinator, identity binding, persistence, revocation and canonical ingress.
113: Domain service authorization and resolved resource/network boundaries.
114: Shared host approval presentation and management, startup admission and CSP integration.
115: Full consumer audit, compatibility removal/migration proof, docs, regression gates and PR.

No phase may mark the overall goal complete. Validate behavior at the owning layer, then verify actual Paja/playground flows.
