# Information Architecture

This document defines the target navigation and page model for the Kehto documentation site.

## Proposed Navigation

| Section | Purpose | Initial pages |
|---------|---------|---------------|
| Start | Fast orientation and reader routing | Overview, installation, package map |
| Concepts | System model and boundaries | Architecture, NIP-5D boundary, capability model, gateway artifacts |
| Tutorials | End-to-end learning paths | Minimal host shell, runtime host, napplet integration |
| How-tos | Focused task recipes | Grant capability, register service, unsupported requires, add service, debug messages, verify artifact |
| Package Reference | Human-written package pages | `acl`, `runtime`, `shell`, `services`, `nip`, `wm`, `playground` |
| API Reference | Generated TypeDoc entry points | API index and package module links |
| Policies | Current policy documents | NIP-5D conformance, shell class/connect/resource policy |
| Migration Archive | Historical material | Archive index and migration snapshots |

## Sidebar Shape

```text
Start
  Overview
  Package map
  Installation
Concepts
  Architecture
  Runtime and shell boundaries
  Capability negotiation
  Gateway artifacts
Tutorials
  Minimal host shell
  Runtime implementation
  Napplet integration
How-tos
  Grant a capability
  Register a service
  Handle unsupported requires
  Add a reference service
  Debug postMessage traffic
  Verify a gateway artifact
Package Reference
  @kehto/acl
  @kehto/runtime
  @kehto/shell
  @kehto/services
  @kehto/nip
  @kehto/wm
  @kehto/playground
Reference
  API reference
Policies
  NIP-5D conformance
  Shell class policy
  Shell connect policy
  Shell resource policy
Migration Archive
  Archive index
```

## URL Rules

- Use lowercase, hyphenated paths.
- Prefer stable extensionless Markdown links so the final output can support clean URLs.
- Keep generated API output under `/api/` and link to it rather than moving generated files into authored content directories.
- Keep migration archive paths stable to preserve old links.

## Archive Treatment

The migration archive must be reachable for maintainers, but it is never a first-run integration path. Archive index pages must state that the files describe completed transitions and direct active readers back to Start, Tutorials, Package Reference, and Policies.
