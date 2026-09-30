---
"@kehto/shell-ipc": minor
---

Ship `launchIpcShellHost` and the `kehto-ipc-shell` executable for the experimental POSIX IPC projection. Trusted ESM host configuration now owns registration and runtime policy while raw children receive only the private socket path. The host exposes deterministic numeric/signal/timeout and current-ready-peer-disconnect lifecycle results, redacts shell-owned CLI errors while preserving inherited child stdio, and retains the raw-process runtime proof.
