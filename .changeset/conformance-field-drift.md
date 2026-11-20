---
"@kehto/conformance": minor
---

Add `catalog/package-field-drift`: the conformance catalog now compares every payload field a pinned NAP wire table names, with its optionality, against the installed `@napplet/nap` message declarations, so a renamed or re-optionalised field (such as `requests` for `urls` on `resource.bytesMany`) fails even when every operation name matches. Differences a pinned NAP sentence settles are listed with the quote; table-versus-prose contradictions report `spec-gap`. Against `@napplet/nap@0.43.0` the full profile fails it on `cvm.discover.result`, `upload.*.result` and `intent.available/handlers.result`.
