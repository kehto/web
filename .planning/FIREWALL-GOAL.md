Restructure Kehto’s permission architecture so Firewall owns approval policy and the approval lifecycle for NAP interfaces, resources, and network access. Extract rate limiting into an independent module. Complete the migration across packages and apps, including Paja/bench and the playground, with tests, regression coverage, documentation, changesets, and an open PR.

This is implementation work. Persist through investigation, planning, implementation, verification, and shipping. Follow AGENTS.md and the repository’s GSD workflow. Use discuss/plan for this multi-step change and execute the resulting phases autonomously. Resolve routine implementation choices yourself; ask only when a material product or protocol decision cannot be inferred.

Intended architecture

1. Firewall is the shared policy authority for:
   - NAP interface approvals before an app starts.
   - Resource approvals, scoped to resources such as files, directories, devices, or URIs.
   - Network approvals, scoped to destinations such as origins, hosts, or relays.
   - Further approval types introduced by future NAPs through a small, typed extension mechanism.

2. Permissions compose:
   - Interface access does not automatically grant unrestricted resource or network access.
   - Resource/network approval does not independently grant an interface.
   - Required domain denial prevents launch; optional domain denial permits launch with reduced functionality, subject to the authoritative protocol.
   - Mandatory protocol constraints cannot be overridden by user approval.

3. Separate responsibilities:
   - Firewall owns policy evaluation, decision semantics, approval scopes, and grant/revocation rules.
   - ACL remains the reusable grant-evaluation building block where appropriate; avoid competing sources of truth.
   - Runtime owns asynchronous request coordination, enforcement, cancellation, and lifecycle integration.
   - Hosts supply approval UI and host actions.
   - Rate limiting independently enforces operation budgets, bursts, and prompt-spam protection.
   - Domain handlers retain protocol validation and operation-specific checks.
   Keep pure policy logic separate from browser, storage, clock, and UI side effects.

Investigate and establish authority first

- Follow the dirty-state protocol. Preserve unrelated work and use an appropriate branch/worktree.
- Prefer codebase-memory-mcp for code discovery.
- Inventory current ACL, Firewall, consent, domain exposure, resource, network, and host approval paths across every package and app.
- Identify every consumer of the current Firewall APIs, configuration, persistence, UI, and events.
- Check relevant napplet/naps specifications before designing behavior. Use exact merged commits or exact draft PR heads as authority and record the refs.
- Recheck current NIP-5D identity, domain discovery, required/optional domains, and lifecycle rules. Do not assume repository guidance or existing tests are current protocol authority.
- Document any contradiction or spec gap explicitly. Draft status alone is not a blocker.
- Produce a concrete migration plan, consumer matrix, and acceptance/test matrix before implementation.

Implementation requirements

- Introduce a common approval model that carries trusted app identity, permission category, operation, normalized scope, lifetime, and decision.
- Support allow, deny, and ask, with once/session/persistent grants where meaningful.
- Bind grants to authoritative verified identity. Define how updates, artifact changes, reloads, and concurrent instances affect grants. Do not trust identity claims from app messages.
- Provide deterministic policy precedence and explainable decisions.
- Define persistent grant loading, versioning, migration, revocation, and failure behavior.
- Deduplicate equivalent pending prompts and bound pending approval work.
- Ensure approval applies to the exact request and scope presented to the user.
- Revalidate identity, current policy, and endpoint lifecycle after asynchronous approval and before executing an action.
- Cancel or invalidate pending approvals on teardown, navigation, replacement, or relevant revocation.
- Resolve each request at most once and execute an approved side effect at most once.
- Preserve each NAP’s required response shape, error semantics, and correlation behavior.