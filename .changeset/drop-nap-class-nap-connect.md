---
"@kehto/runtime": minor
"@kehto/shell": minor
---

Remove NAP-CLASS, NAP-CLASS-1, and NAP-CONNECT (clean break, no aliases).

**@kehto/runtime**: Remove `NappletClass` type, `SessionEntry.class` field, `CLASS_CAPABILITY_ALLOWLIST`,
and the class pre-filter from `enforceNub`. `EnforceResult.reason` is now `'allowed' | 'capability-missing'`
(no `'class-forbidden'`). `AclCheckEvent.reason` likewise drops `'class-forbidden'`.
`resolveIdentityByWindowId` no longer returns a `class` field.

**@kehto/shell**: Remove `connectStore` singleton, `ConnectStore`, `ConnectGrant`, `ConnectGrantKey`,
`ConnectConsentRequest`, `ConsentResult`, `connectGrantKey`, `NappletClass` re-export, and
`classToWireCode`. Remove `'connect'` and `'class'` from `LEGACY_NUB_DOMAINS` and `NAP_DOMAINS`.
`ShellBridge.connectStore` getter removed. `onNip5dIframeCreate` hook return type drops the `class`
field. `ResourceErrorCode` drops `'class-forbidden'`.
