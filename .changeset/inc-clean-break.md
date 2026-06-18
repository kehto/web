---
"@kehto/acl": minor
"@kehto/runtime": minor
"@kehto/services": minor
"@kehto/shell": minor
---

Make INC the only event-channel protocol vocabulary and remove pre-INC aliases.

**@kehto/runtime** now registers and dispatches only canonical `inc.*` message
types, with the runtime handler renamed to INC terminology throughout.

**@kehto/acl** now resolves only canonical `inc:*` capability actions for
event-channel permissions.

**@kehto/services** now emits and subscribes through canonical `inc.emit` and
`inc.event` runtime topics.

**@kehto/shell** now reports NAP-INC capability protocols only and no longer
mirrors older event-channel protocol strings.
