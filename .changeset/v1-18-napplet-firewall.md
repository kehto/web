---
"@kehto/firewall": minor
"@kehto/runtime": minor
---

Add `@kehto/firewall` — a behavioral anti-abuse gate, and integrate it into `@kehto/runtime`.

**New package `@kehto/firewall`** (pure, zero-dependency, WASM-ready, mirrors `@kehto/acl`): a normalized `Observation` plus a pure `evaluate(config, state, observation)` decision engine implementing per-`(napplet, opClass)` token-bucket rate limiting, an init-burst guard, declarative content matchers (event kind / payload size / focus conditions), a soft `unfocusedMultiplier`, and first-match-wins rule precedence (per-napplet policy → init-burst → content matchers → op-class rate → global rate → defaults). Includes pure config mutations with serialize/deserialize (defensive, falls back to defaults on malformed input) and conservative built-in defaults (exceed-action `flag`, init-burst `block`, `0.25×` unfocused).

**`@kehto/runtime` integration:** every napplet message that passes the ACL check is now evaluated by the firewall before dispatch. Adds a `firewall-state` container, three new **optional** `RuntimeAdapter` hooks (`firewallPersistence`, `onFirewallEvent`, `getFocusContext`), and an allow/deny/ask per-napplet policy that reuses the consent handler ("reject now, prompt async, remember choice"). Config persists; counters are ephemeral. Focus is sourced shell-side (forge-proof), never self-reported by napplets.

**Note (`@kehto/runtime` public API):** the `ConsentRequest` type gains a `'firewall-policy'` variant and its `event` field is now optional (a firewall consent prompt carries no Nostr event). Existing consent handlers continue to work; handlers that exhaustively switch on `ConsentRequest.type` should add the new variant.
