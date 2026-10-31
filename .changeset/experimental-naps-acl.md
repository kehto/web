---
"@kehto/acl": minor
---

Reserve an `x-` namespace for experimental (out-of-tree) NAPs. Domains must be `x-<name>`; reserved registry and in-tree domains (`llm` included) and `x-` aliases of them are rejected. Capabilities are `x-<domain>:<action>` and can never redefine a built-in capability. Grants are explicit per-identity decisions in `AclEntry.ext`, so the built-in bitfield (through `1 << 27`) is unchanged. New exports: `EXTENSION_DOMAIN_PREFIX`, `RESERVED_NAP_DOMAINS`, `ExtensionCapability`, `validateExtensionDomain`, `isExtensionDomain`, `validateExtensionCapability`, `isExtensionCapability`, `checkExtension`, `grantExtension`, `revokeExtension`, `sanitizeExtensionDecisions`, `mergeExtensionDecisions`. This is a Kehto spec-gap policy; `napplet/naps` master `43cb3a4` defines no experimental naming.
