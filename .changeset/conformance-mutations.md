---
"@kehto/conformance": minor
---

Add mutation self-tests: `@kehto/conformance/mutations` exports named mutations of the first-party Kehto target (`MUTATIONS`, `createMutation`), each declaring the stable checks it must fail, and the browser bundle adds `runKehtoMutation`. `shell/local-supports` now also proves that a first `shell.init` claiming an absent domain cannot make it supported.
