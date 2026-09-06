---
"@kehto/runtime": minor
---

Retire the previous initialization burst budget on every trusted session registration,
including iframe replacements that reuse a logical window ID. Preserve per-napplet
rate budgets and duplicate-readiness enforcement. Add the optional `onRegister`
callback to `createSessionRegistry` and `resetInitBudget(initKey)` to
`FirewallStateContainer`; custom implementations of that interface must implement
the new method.
