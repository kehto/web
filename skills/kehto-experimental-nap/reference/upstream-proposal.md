# Draft napplet/naps proposal template

Fill this in once the experiment is stable, then open a PR against
`napplet/naps` (copy `NAP-WORD-TEMPLATE.md` there). Drop the `x-` prefix: the
registry assigns the final domain.

```markdown
# NAP-<NAME>

**Domain:** `<name>`
**Status:** Draft
**Depends:** <domains, or —>

## Motivation
<What napplets need, and why existing NAPs don't cover it.>

## Operations
| Operation | Request fields | Result | Notes |
|---|---|---|---|
| `<name>.<action>` | `id`, … | `<name>.<action>.result` `{ id, … }` or `{ id, error: { code, message } }` | |

## Events (shell → napplet)
| Type | Fields | Delivery rule |
|---|---|---|

## Errors
| Code | Meaning |
|---|---|
| `not-configured` | The runtime exposes the domain but has no backend configured yet. |

## Authorization
<Which operations need a grant and what the grant covers. Map to kehto's
`x-<name>:<action>` experiment capabilities.>

## Security considerations
<Data that must never cross into napplets; user consent; rate limits.>

## Experiment evidence
<Link to the kehto x- prototype, tests and observed behavior.>
```

Kehto-wide gaps worth raising alongside it (kehto policy at `napplet/naps`
master `43cb3a4`):

1. An experimental-domain naming convention (kehto uses an `x-` prefix and
   forbids `x-<registered>` aliases).
2. A `not-configured` interface state: the domain is exposed, but setup is
   pending. Kehto keeps wire advertisement binary and reports `unconfigured`
   only host-side.
