# Phase 113: Service authorization boundaries

Decisions inherited from the user goal and phase 111/112 artifacts; autonomous
planning/execution is authorized. Firewall is the policy authority, runtime owns
async coordination, hosts supply UI and actions, rate budgets stay independent.

Required scope: every implemented service and fallback path. Resource permissions
compose interface + exact original URI + actual network destinations. Bulk items
retain independent success/failure. Cache hits cannot bypass resource permission.
Relays, device/FS handles, upload, account operations and inherited calls need
operation-specific checks and revocation. Do not invent wire errors.

Use current exact upstream spec refs from research. RESOURCE draft PR80 uses urls
and canonical base64; local requests/server-hint/Blob wire shapes are older and
must migrate through shell, services, host adapters, tests and docs. Draft status
is not a blocker. Resource isolation prerequisite remains a phase114 host gate.

Phase112 is still open for integration closure: migrate old temporal gates and
validate general ingress as service boundaries become available. The completion
of this phase does not imply apps are migrated or the overall goal is achieved.

Security: validation precedes prompts; identity comes only from registered trusted
endpoints; requests are captured before await; cancellation/revocation invalidate
pending grants and backend results. Service runtime now supports a request-owned
signal as fifth authorizeOperation argument. Use it for cancel-capable domains.

Browser DNS/SSRF enforcement cannot be claimed from hostname string filtering.
Choose enforceable host behavior and explicitly report support boundaries. Do not
ship resource exposure on frames whose direct networking bypasses that policy.

## Resource boundary details from source inspection

- `resource-service.ts:fetchResourceItem` must hold authorization through body
  materialization, not just the fetch Response promise. Keep the original URL
  byte string for resource identity and bulk response correlation.
- Extend ResourceFetchInit with a request-bound network execution hook, consumed
  by every host resolver contact. Resource URI approval cannot bless advisory
  Blossom servers, redirects, relay discovery or other indirect destinations.
- Nested network approvals must observe the outer request signal; revocation or
  cancellation while waiting must prevent both network execution and delivery.
- The canonical resource service should receive requests through runtime's
  migrated dispatch path, retaining ACL checks and validation. resource.cancel
  must reach existing work even when rate/approval state changes; it cannot itself
  require approval. Info needs interface authorization and its own terminal schema.
- Current Paja HTTP resolver follows redirects implicitly. Prefer rejecting
  redirects unless the transport can inspect and authorize each destination.
- PR80 head rechecked through GitHub API on 2026-10-17; remains ae5b9c64ab8a4d8909f288829a01e99d6bd713bc.
