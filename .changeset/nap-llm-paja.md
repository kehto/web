---
"@kehto/paja": minor
---

Add a Language models panel for draft NAP-LLM (napplet/naps PR #134 at `3e10939`): provider presets for the common hosted and local APIs, connection metadata in `localStorage`, API keys either session-only or encrypted with AES-GCM under a PBKDF2-SHA-256 vault password, a chooser for `llm.select`, a configure prompt when nothing compatible exists, and a disclosure consent dialog before every generation. Keys travel only to the connection's base URL. The Interfaces toggle gains a yellow `⚠` unconfigured state next to the existing enabled and disabled states.
