# Runtime and Shell Boundaries

`@kehto/runtime` is browser-agnostic. It handles protocol messages after the host has already identified the source window/session. It does not own DOM, iframe creation, localStorage, or browser event listeners.

`@kehto/shell` is the browser adapter. It owns `window.addEventListener('message', ...)`, source-window lookup, gateway loading, hosted `shell.ready` / `shell.init`, browser registries, and the runtime instance exposed to advanced host code.

Keep this boundary intact:

- Put transport and browser lifecycle in shell code.
- Put message dispatch, ACL gates, service routing, and runtime state in runtime code.
- Put service implementation behavior behind `@kehto/services` factories or host-owned callbacks.
