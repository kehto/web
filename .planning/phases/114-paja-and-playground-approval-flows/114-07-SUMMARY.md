---
phase: 114-paja-and-playground-approval-flows
plan: 07
status: complete-with-scope-correction
commits: [348dc1aa, 3f510a07]
---

# Paja settings and development admission

Paja's `--firewall-mode` and `simulation.firewall` only changed inert metadata.
They are now rejected in CLI, JSON config, merge, and direct normalization with
guidance to use scoped grants. Paja has no separate simulated executable source:
simulation selects theme/backends and availability for ordinary frame navigation.
Live URL and local-file targets already pass through `navigateFrame` and shared
admission with exact development principals. A grant revocation now retires only
matching Paja tabs. The shared Firewall panel owns prompt, grant listing,
revocation, and storage failures; ACL and interface availability stay separate.

The live target receives a host-injected base URL only at its exact approved
origin. This fixes relative development assets without allowing sibling origins
or widening the remote directive registry. Chromium tests prove allow/block and
required/optional denial; unit tests prove CLI/config rejection, scoped
retirement, CSP bounds, and frame admission. The standalone mode/currentness
diagnostic panel described in the original plan was not added: the active grant
list and lifecycle status are the current UI, and no diagnostic state may become
an authority source.

Authority: NIP-5D draft `5560820fa4f37f45b8ab742a11aeb3001b17dc67`;
NAP-RESOURCE draft `ae5b9c64ab8a4d8909f288829a01e99d6bd713bc`;
NAP-SHELL master `19de5ce1cea40cd4c76089cdd8126e9f87648049`.
