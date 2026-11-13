---
quick_id: 261111-adq
slug: intent-delivery-upstream-types-418
issue: kehto/web#418
---

# Adopt upstream no-ID IntentDelivery (core 0.41 / nap 0.40) and retire the local contract

Spec authority: napplet/naps PR #128 @ 74f9bf85ebb83b50b7b2ad8308a835d5f3113cd9 (NAP-INTENT),
PR #106 @ fc121fc264615482143eda86125863d2e1f741a2. Upstream fix: napplet/web#329 (closes #328),
released by napplet/web#330 as @napplet/core 0.41.0 / @napplet/nap 0.40.0.

## Tasks
1. Wait for the npm publish; bump host dev deps to core 0.41 / nap 0.40, widen peer upper
   bounds (<0.42 / <0.41), raise core peer floor to >=0.41.0 for services and the packages
   that pin it (paja, cli). Sync jsr.json maps, alignment test, docs version guidance.
2. Replace packages/services/src/intent-types.ts with type re-exports from @napplet/core;
   keep the @kehto/services export names stable. Update intent-types.test.ts to assert
   the upstream export is the no-ID, string-sender contract.
3. Align the shell intent receiver with upstream's binding: ignore deliveries whose
   sender is not a non-empty string. Add a regression.
4. Retire KEHTO_INTENT_TYPES_UPSTREAM_DRIFT (docs/compatibility.md keeps the entry with
   the removal PR), update NIP-5D-CONFORMANCE policy text and the guards that pinned the
   local file.
5. Changeset (minor: services, paja, cli; patch: others), gates, PR closing #418.
