---
"@kehto/services": patch
---

Reject malformed NAP-LLM tool `parameters` with `invalid-request` for every keyword the JSON Schema draft 2020-12 meta-schema describes, not only `type`, `required`, `enum` and the common subschema keywords. Wrong-typed length, count and numeric bounds (including the draft 4 boolean `exclusiveMinimum`/`exclusiveMaximum`), repeated `required` or `type` entries, non-schema `dependentSchemas`, `unevaluatedProperties`, `unevaluatedItems`, `contentSchema` and `definitions`, and wrong-typed annotations and core keywords now fail before consent and before any provider call. Unknown keywords still pass, and no napplet-supplied pattern is compiled or run.
