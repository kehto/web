---
"@kehto/services": minor
---

Add ContextVM CEP-22 oversized-transfer and CEP-41 open-stream framing to
the Nostr CVM transport with strict admission and bounded reassembly:

- progress frames are admitted only for progress tokens this client issued
  to the signing server; explicit caller tokens are bound on any MCP method
  and automatic injection covers `tools/call`
- CEP-22 reassembly lives on its originating request: the full start shape
  (render completion mode, sha256 digest, totals) is required before
  buffering, declared chunk counts and an independent memory cap are
  enforced, transfer ranges must stay within safe integers, and exact byte
  length plus digest are verified on the joined payload
- CEP-41 streams run a receiver state machine: start-gating, monotonic
  progress, contiguous chunk ordering with a bounded gap buffer, typed
  ping/pong keepalive with idle and probe timeouts, and terminal-state
  handling that ends the stream without ending request admission, so an
  oversized final response remains admissible after stream close
- closing a server settles its in-flight requests and releases their token
  bindings, buffers, and stream state
