---
quick_id: 261009-gxe
status: planned
---
# PR #277: canonical intent delivery with tracked compatibility

User scope: implement review 5473114400 in this PR. Retain backwards compatibility with warnings, track it and test it; put the rule in AGENTS.md in a separate PR (latest user instruction). Defer the broader upstream NAP migration. Execute GSD quick inline on the existing PR branch, fast-forwarded to the contributor's main merge 016e9cf3. Preserve primary-checkout package.json WIP.

## Authority

Checked napplet/naps@25b29ee49e5bff8ebfe031f4b76dce98705c8b7e, naps/NAP-INTENT.md (delivery change merged in 389c1c2aa2c8b70610f9f53f2c0dd097e313dcea): intent.deliver carries delivery {sender, archetype, action, convention, payload?}; onDelivery buffers before registration; INC is not required. NIP-5D remains 020cb8b33a9e4c6b8ca4b2f9d0ed0a67843b68f7. Installed @napplet/nap 0.32.0 intent/types and intent/sdk omit IntentDelivery/onDelivery; preserve the package line and document a narrow host-owned delivery binding/type exception. URI invocation, accepted-result lifecycle, catalog identifiers/naddr and other newer NAP changes are explicitly deferred by the user.

## Tasks

1. Add protected, parent-bound intent.onDelivery with ordered buffering and closeable subscriptions. Send one canonical envelope in Paja and playground after source-bound readiness. Catalog eligibility uses target intent availability, not INC declarations. Migrate the profile consumer. Keep legacy INC listeners working through a local binding adapter with one diagnostic per iframe; prefer canonical handlers and never dual-deliver or reinterpret ordinary inc.event traffic as intents.
2. Update a compatibility register in this PR; ship the AGENTS.md policy separately: identifiers, ownership, warning sites, regression tests, retirement prerequisites and staged removal. Inventory existing compatibility and explicitly identify pre-existing warning/test debt without expanding unrelated NAP behavior. Add warning coverage for legacy aggregate manifests retained in this PR. Sync affected host/package/policy docs and changesets.
3. Prove canonical and legacy paths, delayed listeners, parent trust, missing domains, close/reassignment, payload fidelity, no double delivery, and both host browser paths. Run build/type/unit/e2e/docs/slop, commit and push atomic work, update PR review disposition and GSD state.
