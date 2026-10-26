# Review assessment

Review: https://github.com/kehto/web/pull/336#pullrequestreview-5624539827
Reviewed head: d59fdaf8d4a429e3a7918cd29c880809bf5eef15.

| Item | Assessment | Resolution / proof |
| --- | --- | --- |
| 1 relay.query | Valid: direct transport without coordinator | Runtime planned-query approval and lifetime regressions |
| 2 outbox.getEvent | Valid: direct router call | Reuse immutable query planning, scoped execution and cancellation |
| 3 main conflicts | Valid, reproduced two conflicts | Merge main 8c437f4e preserving both imports and task histories; build and tab tests passed |
| 4 persistent revocation | Valid: global invalidation retires unrelated apps | Principal-scoped invalidation, sibling-source and unrelated-principal regression |
| 5 publish targets | Valid: fallback can change destinations | Planned publishers fail closed without explicit destination executor |
| 6 local-domain budgets | Valid budget gap; blanket rejection conflicts with mandatory NAP replies | Charge dispatch using the same limiter; canonical denials where defined, silent fire-and-forget rejection, cleanup preserved. CONFIG snapshots/schema ACK and INC channel listings remain diagnostic-only pending a specified rate-denial contract. |
| 7 OUTBOX fallbacks | Valid | Configured runtime fails closed without plan hooks; standalone compatibility warns once |
| 8 compatibility | Valid | Six diagnostic records/tests; correct runtime relay test citations |
| 9 theme/identity replies | Valid | Correlated terminal replies; identity.getPublicKey returns empty pubkey without error per owning NAP |
| Whitespace | Valid at PR diff scope | Remove trailing whitespace/blank EOF; verify main...HEAD |
| Proxy policy navigation | Valid | Policy index and VitePress sidebar entry |
| CSP scheme upgrades | Valid disclosure concern; explicit custom-port claim overbroad in Chromium 152 | Disclose CSP semantics in UI/docs; browser tests prove default-port upgrade, same-custom-port upgrade rejection, explicit allowed transport and sibling-port denial |
| Paja alias host | Valid | Redirect HTML routes to canonical origin before capability cookie |
| Playground deadline | Valid | Check already-aborted composite/network/source signals before fetch |
| Changeset severity | Valid | Relay and WebRTC breaking 0.x changesets become minor |
| Split planning records | Optional reviewability suggestion | Keep spec refs, decisions, and validation with implementation; no source-history rewrite |

Full gates and exact focused evidence are recorded in SUMMARY.md after execution.
