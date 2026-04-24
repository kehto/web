---
"@kehto/shell": minor
---

Breaking: `ShellAdapter.onNip5dIframeCreate` return type now includes a required `class: NappletClass` field.

The hook is the canonical synchronous class-posture resolution point for NUB-CLASS (CLASS-01 / Phase 38). Host apps implementing this hook MUST update their return shape to include `class` (value may be `null` for the permissive default). The full new shape is:

    { dTag: string; aggregateHash: string; class: NappletClass } | null

where `NappletClass = string | null`.

This is a minor bump (not patch) because the public hook contract expanded in a backwards-incompatible way — host apps must update. The change is coordinated in parallel with downstream consumers (hyprgate primary); no dedicated coordination phase is required.

See `packages/shell/src/types/provisional-class.ts` for the `NappletClass` type. Class tokens (`'class-1'`, `'class-2'`, etc.) are NUB-defined; kehto does not prescribe a taxonomy.

The resolved class flows through `SessionEntry.class` and is carried inline in the `shell.init` envelope (NO async `class.assigned` envelope — synchronous resolution is the C-01 pre-assignment race fix).
