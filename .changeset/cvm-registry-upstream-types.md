---
"@kehto/services": minor
"@kehto/mocks": minor
"@kehto/paja": minor
"@kehto/cli": minor
"@kehto/acl": patch
"@kehto/firewall": patch
"@kehto/runtime": patch
"@kehto/shell": patch
---

Take the NAP-CVM registry types from `@napplet/core` 0.42.0 and retire Kehto's local copies (kehto/web#441). Checked against NAP-CVM PR #31 at `28cf1bdb5c6412bfbfcecb79a5a5121e18376f2f`.

- `@kehto/services` re-exports `CvmRegistrySelector`, `CvmRegistryEntry`, `CvmRegistryTool` and `CvmRegistryCallOptions` from core under the same names, and adds `CvmRegistryOptions` and `CvmRegistryQuery`. `CvmRegistrySelector` is now core's union, so an empty `{}` selector no longer type-checks (the runtime already rejected it). `CvmRegistryFamily` stays Kehto's host configuration type.
- `@kehto/mocks`: `MockCvmRegistryEntry` extends core's `CvmRegistryEntry`.
- Breaking peer change: `@kehto/services`, `@kehto/mocks`, `@kehto/paja` and `@kehto/cli` now need `@napplet/core` `>=0.42.0 <0.43.0`. Install `@napplet/core@^0.42.0` (and `@napplet/nap@^0.41.0` if you want the matching bindings) when upgrading.
- All host packages admit `@napplet/core` 0.42.x and `@napplet/nap` 0.41.x; `@kehto/acl`, `@kehto/firewall`, `@kehto/runtime` and `@kehto/shell` keep their existing floors.
- The injected string-family adapter and its `KEHTO_CVM_FAMILY_SELECTOR` warning are unchanged. `@napplet/nap` 0.41.0 does not translate string-family calls, so napplets built against older bindings still rely on it.
