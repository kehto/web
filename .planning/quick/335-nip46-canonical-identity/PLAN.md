# /gsd:quick — PR 335 canonical NIP-46 identity

Inline workflow: no installed GSD command/tool. Reuse clean PR worktree/branch.

Authority: nostr-protocol/nips 46.md at ba59df89a3d6fdaab067b16da9f9c003de22566a requires get_public_key after connect; napplet/naps naps/NAP-IDENTITY.md at 19de5ce1cea40cd4c76089cdd8126e9f87648049 requires the shell-user hex key. Always fetch/validate that identity, ignoring connect acknowledgement shape. No NAP wire/API change.

1. Remove inline connect identity shortcut. Add real encrypted request regressions for hex secret/transport key and invalid canonical response; assert request sequence and caching.
2. Update changeset and PR description; run focused/full tests, build, types, docs, e2e, slop gate where available.
3. Commit explicit paths, push existing PR branch, update PR with checks/spec refs.
