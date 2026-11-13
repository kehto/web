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
- Paja relay/Blossom discovery hints must never be treated as approval when they
  enter iframe `connectOrigins`. Playground removed its static origin-grant list
  and now routes the first resource destination through runtime authorization.
- Rate module owns temporal math only. Content predicates stay Firewall policy. Legacy APIs must retain bounded diagnostics and documented migration; legacy broad allows never become new resource/network grants.
- Once applies to one accepted operation. Equivalent prompts can share presentation, but a one-use answer cannot release every queued operation. Session grants bind a registered endpoint generation; persistent grants bind verified principal and exact scope. Revocation invalidates queued/in-flight access.

## Service consumer and authority matrix

This is the Phase 113/114 implementation inventory. “Implemented” means the
service receives the runtime operation authorizer, validates before prompting,
retains its operation signal through asynchronous work, suppresses late delivery
after revocation, and has the named regression. Phase 114 adds host approval UI,
launch admission, and CSP; standalone-browser interception remains outside the
runtime mediator.

| Service | Authority / bounded policy | Scope and validation | Rate, lifecycle, consumer, regression |
|---|---|---|---|
| cache | Host policy; no NAP authority asserted | cache interface and captured key | runtime rate budget; revoke stops subscriptions; Paja/playground; `cache-service.test.ts` |
| common | NAP-COMMON PR #67 `8cd0eae8550575771bb616a384e2dfbcade31673` | common interface and immutable relay plan | runtime rate budget and signal; Paja/playground; `common-service.test.ts` |
| config | NAP-CONFIG `bed9cb5b1e7c9b5babee8870aa18b12949af1d62` | config interface, exact key and mutation validation | runtime rate budget; revoke stops local subscriptions; Paja/playground; `config-service.test.ts` |
| count | NAP-COUNT PR #69 `9353a0c6c02c595f7e65ebd6df3802a7a45fc6bf` | count interface, filters and selected relay plan | runtime rate budget; Paja aborts its retry path and suppresses late results; the host-only fallback warns `FW-COUNT-LEGACY-001`, while underlying Nostr COUNT remains timeout-bounded rather than per-request cancellable; `count-service.test.ts` |
| CVM | NAP-CVM PR #52 `b1ecaa529971ade6d5bc806bc0a990db0dc2356f`; transport policy is host-owned | cvm interface, exact server resource, relay origin, and controller validation | runtime rate budget and controller abort; Paja/playground; CVM regressions |
| DM | Plan 09 rechecked NAP-DM draft authority | dm interface and immutable relay plan | runtime rate budget; revoke closes streams; Paja/playground; `dm-service.test.ts` |
| FS | NAP-FS PR #88 `bd1b9e912f05203bf38f7a1b04f920744fe6d625` | fs interface; picker, handle, directory, and move scopes | runtime rate budget; source-owned handles/late callbacks retire; Paja; FS regressions |
| gamepad | Browser host policy | gamepad interface and controller ownership | runtime rate budget; focus/source cleanup; Paja/playground; gamepad regressions |
| identity / keys | existing NAP signer boundary; no new authority claim | interface and signer/chord validation | runtime rate budget; host owns signer/listener lifetime; Paja/playground regressions |
| intent | NAP-INTENT / NIP-5D `5560820fa4f37f45b8ab742a11aeb3001b17dc67` | interface plus handler/sender validation | runtime rate budget; delivery source-bound on revoke; Paja/playground regressions |
| link | NAP-LINK PR #53 `50a2cd45e76f06e87b87e93842badf4c61f17bde` | interface plus exact validated URL resource scope | runtime rate budget; opener revalidates; Paja/playground; `link-service.test.ts` |
| lists | NAP-LISTS PR #68 `7cf00cdb7bca6bb59dc5ef082e9fe8ac9278fa46` | interface and immutable mutation relay plan | runtime rate budget and signal; Paja/playground; `lists-service.test.ts` |
| media | NAP-MEDIA PR #10 `7806f438530251fce5129f8e6239d6b642278759` | interface and source-owned sessions; no artwork URL fetch | runtime rate budget; session cleanup; Paja/playground; `media-service.test.ts` |
| notifications / notify | NAP-NOTIFY PR #11 `67877ef6c31ec8acee3125c1d8b4c781010e37dc`; legacy create/list/read demo wire is outside that draft | interface and notification payload validation | runtime rate budget; host callbacks own lifecycle; Paja/playground regressions |
| outbox / relay | NAP-OUTBOX PR #32 `8865f73d52a4864afee145f28d26520476273927`; NAP-RELAY PR #2 | interface and immutable read/publish/subscribe/destination plans | independent limiter plus runtime rate budget; streams close on revoke; Paja/playground regressions |
| resource | NAP-RESOURCE PR #80 `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc` | interface, exact URL, and every actual destination through `authorizeNetwork` | runtime rate budget; resource/network grants cover body lifetime; Paja proxy/playground transport; resource regressions |
| serial / BLE | Browser device policy | interface plus chooser, source-owned handle/device, operation and directory validation | runtime rate budget; controller closes on revoke; Paja/playground simulation; device regressions |
| theme | NAP-THEME master `19de5ce1cea40cd4c76089cdd8126e9f87648049` | interface and eligible subscription validation | runtime rate budget; revoke retires subscribers; Paja/playground; `theme-service.test.ts` |
| upload | NAP-UPLOAD PR #33 `f5cc981e527e2cc1572793a7a6e5082e5271ac49` | interface and server/destination plan | runtime rate budget; uploader aborts active work; Paja; upload regressions |
| WebRTC | owning plan rechecked the current draft; signaling transport host-owned | interface plus peer/controller validation | runtime rate budget; controller close/revoke; Paja/playground; WebRTC regressions |

Paja and playground constructor registrations are guarded by the table-driven
`tests/unit/host-service-registration.test.ts`. The Paja resource resolver/proxy
is host-only, supplies `AuthorizeNetwork`, and has the OUTBOX signer-identity
hook required for immutable plans. Playground is wired to the same resource
contract: `hostFetch` rejects missing authority, approves its first HTTP(S)
destination through the runtime, and rejects redirects because it has no trusted
per-hop resolver. The Paja resolver capability never enters app initialization,
config, iframe messages, or napplet-visible globals.

## Host and compatibility boundaries

- Hosts refuse to advertise a backend they cannot enforce. Simulated unsupported
  destinations return canonical denial while cancel, close, and cleanup remain usable.
- Rate limiting is separate from approval. Runtime budgets apply after source,
  ACL, interface, scope, and validation checks; unmediated browser traffic is
  outside that mediator.
- The Paja proxy requires exact origin/host/method/content-type checks, no
  permissive CORS, rejection before DNS or connection, globally reachable
  address policy, connection pinning, and reauthorization for every redirect.
  Playground has no proxy and fails closed on redirects.
- `FW-RESOURCE-LEGACY-001` and `FW-RUNTIME-LEGACY-GATE-001` are bounded warned
  compatibility paths. They create no broad approval authority; their warnings,
  tests, and removal prerequisites belong in `docs/compatibility.md`.

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
