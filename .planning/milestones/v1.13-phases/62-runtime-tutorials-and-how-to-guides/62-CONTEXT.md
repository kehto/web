# Phase 62: Runtime Tutorials and How-to Guides - Context

**Gathered:** 2026-05-23
**Status:** Ready for planning
**Mode:** Autonomous smart discuss

<domain>
## Phase Boundary

Create implementer-facing tutorials, runtime host guide, napplet integration tutorial, common how-tos, and troubleshooting/tips content. This phase writes guidance only; it does not add the VitePress config or verification scripts.

</domain>

<decisions>
## Implementation Decisions

### Tutorial set

Create three tutorial paths:

- Minimal host shell.
- Runtime implementation guide.
- Napplet integration guide.

### How-to set

Cover the common host tasks named in the roadmap:

- Grant a capability.
- Register a service.
- Handle unsupported `requires`.
- Add a reference service.
- Debug `postMessage` traffic.
- Verify a gateway artifact.

### Troubleshooting

Add one guide that captures known issues from prior milestones without expanding runtime scope.

</decisions>

<code_context>
## Existing Code Insights

- `@kehto/runtime` exposes `createRuntime`, ACL state, service registration, session/manifest APIs, and service dispatch.
- `@kehto/shell` exposes `createShellBridge`, `ShellBridge`, `buildShellCapabilities`, registries, proxies, and shell-owned connect/resource/class types.
- `@kehto/services` exposes service factories for identity, relay, cache, keys, media, notify, theme, config, and resource.
- `apps/playground/README.md` documents the gateway artifact path and playground verification commands.

</code_context>

<specifics>
## Specific Ideas

- Keep snippets as integration skeletons rather than pretending to be drop-in complete apps.
- Point readers to package pages for exact API/export lookups.
- Keep how-tos narrow and task-shaped.

</specifics>

<deferred>
## Deferred Ideas

- VitePress navigation entries for these pages: Phase 63.
- Link verification of every page: Phase 64.

</deferred>
