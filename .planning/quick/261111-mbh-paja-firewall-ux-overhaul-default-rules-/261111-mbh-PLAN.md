---
quick_id: 261111-mbh
description: Paja firewall UX overhaul — default rules, readable prompts, grouped decisions
date: 2026-11-11
branch: feat/paja-firewall-ux
---

# Paja firewall UX overhaul

## Problem

Paja asks for every exact scope. One napplet registering keyboard actions
produced ~100 modal prompts (`keys.registerAction exact:keys:action:…`), each
requiring a lifetime to be picked from a select before Allow enables. The
"Firewall grants" list repeats the full manifest key and artifact hash on every
row and cannot be scanned.

## Decisions (from the user)

- Default: allow every capability; ask for every NAP-LINK open.
- The user can change the default rules, granularly.
- The UX must be vastly better.

## Spec check

NAP-LINK draft `napplet/naps` branch `nap-link` @ `100e5c9`: the shell owns
policy and prompting; it MAY prompt, MAY persist choices, and SHOULD prompt
"unless policy already allows the request". A host default-rule policy is
conformant. No wire change.

## Design

1. `@kehto/firewall` — pure `permission-rules.ts`: `PermissionRules`
   (global default, per-domain, per-operation, and the same per napplet),
   `resolvePermissionRule`, `setPermissionRule`, serialize/deserialize.
   Library default stays `ask` (strict); hosts choose their own.
2. `@kehto/runtime` — `PermissionAdapter.defaultDecision(request, missing)`
   consulted before the prompt budget and the prompt. `allow` commits session
   grants with a `rule:` id prefix; `deny` refuses; `ask` prompts as before.
3. `@kehto/shell` — rebuilt prompt (plain-language title, napplet label,
   readable scopes, preselected lifetime, "apply to every future request"),
   rules editor, decisions grouped by napplet and domain with bulk revoke.
   Exports a stylesheet string for hosts.
4. `@kehto/paja` — default rules `allow` + `link.open: ask`, durable rule
   storage, wiring, styles, napplet labels.

## Tasks

- [x] firewall rules module + tests
- [x] runtime defaultDecision + tests
- [x] shell prompt / rules / decisions UI + tests
- [x] paja wiring, storage, styles + tests
- [x] e2e driver/spec updates, visual proofs
- [x] docs, changesets, gates, PR
