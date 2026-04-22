# @kehto/wm

**Status:** DRAFT skeleton (version 0.0.0 — pre-publish).

Generic window manager service contract for NIP-5D shells.

## What this package is

A reusable library that provides:

- Generic type vocabulary (`WindowId`, `WorkspaceId`, `Rect`, `Layout`).
- Host-hooks contract (`WmHostHooks`).
- Factory signature (`createWmService`) for wiring shell state + hooks.

## What this package is NOT

- Not a NIP specification. Window management is shell-internal implementation.
- Not a rendering system, layout algorithm, or animation primitive.
- Not coupled to any UI framework (Svelte, React, Vue, etc.).

## Design note

See the hyprgate design document for the full proposal, the relationship to
`@kehto/services keys-service`, and the supersession of the earlier
`kehto/monorepo#3` "service NUB" framing:

<https://github.com/hyprgate/gui/blob/master/specs/wm-package-design.md>

## Status

This is a draft skeleton. No implementation is provided — `createWmService`
is a signature stub that throws. The skeleton exists to establish the
public API contract and open upstream discussion via draft PR.

Merge negotiation and implementation land post-hyprgate v2.0 ship.
