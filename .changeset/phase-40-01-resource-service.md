---
'@kehto/services': minor
'@kehto/acl': patch
'@kehto/runtime': patch
'@kehto/shell': patch
---

Add NUB-RESOURCE reference service (10th NUB domain, v1.7 Phase 40).

- `@kehto/services`: `createResourceService({ fetch, isOriginGranted, getConnectGrants, resolveIdentity })` factory. All four options required from day one — factory throws on construction if any is missing (H-03 prevention). Implements canonical 4-message protocol: `resource.bytes`, `resource.cancel` inbound; `resource.bytes.result`, `resource.bytes.error` outbound. Cancel correlates to in-flight requests via requestId.
- `@kehto/acl`: new `'resource:fetch'` capability; `resolveCapabilitiesNub` extended with `resource.*` mapping (asymmetric: napplet requests get sender gate; shell pushes get recipient gate). `acl-state.ts` CAP_MAP extended with bit 15 for `resource:fetch`.
- `@kehto/runtime`: `handleResourceMessage` dispatch + `nubDispatch.registerNub('resource', ...)` wiring (Phase 39 Dev 1 lesson: missing registerNub silently drops all envelopes).
- `@kehto/shell`: `CANONICAL_NUB_DOMAINS` extended with `config` and `resource`; provisional-resource wire types re-exported via barrel.

No breaking changes. See docs/policies/SHELL-RESOURCE-POLICY.md (Phase 40 Plan 40-03) for host-fetch policy surface (redirects, MIME sniffing, private-IP blocking — host-app concerns).
