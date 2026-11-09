---
phase: quick-261101-pfc
plan: "01"
type: quick
autonomous: true
---

# Quick 261101-pfc: move playground-only e2e coverage to Paja

Goal: restore the browser scenarios lost when the playground retired (#377):
relay publish/publishEncrypted/subscribe, storage persistence, ACL revoke
(relay:write, state:write), signer/identity flows, and CVM.

Tasks:
1. Add an in-test NIP-01 relay (Playwright routeWebSocket) and a shared Paja
   flow harness whose napplet calls only `window.napplet.*`.
2. Add paja-relay, paja-storage, paja-identity, paja-cvm specs asserting the
   napplet result and the relay wire traffic.
3. Route the new specs in scripts/select-e2e-tests.mjs and its unit test.
4. Document coverage in docs/packages/paja.md and the KEHTO_PLAYGROUND_RETIRED
   register entry.

Spec check: NAP-RELAY napplet/naps#2@9f30b35, NAP-STORAGE #3@4f4cf0c,
NAP-CVM #31@28cf1bd, NAP-IDENTITY master@43cb3a4.
