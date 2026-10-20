# Phase 111 context

User discussion: Firewall approves NAP interfaces before startup and resource/network access during execution; future approval classes must reuse the mechanism. Rate limiting is independent. Applies equally to packages and apps including Paja. Full tests, regression coverage, documentation and an open PR are required.

Autonomous choices: pure TypeScript core; no new framework; use verified manifest/artifact principal plus separate development principal; exact scope first; session scopes tied to endpoint generations; no broad grant migration. Preserve explicit domain safety constraints and legacy behavior only through tracked migration paths.

Authority and consumer inventory: ../../research/firewall-approvals.md. Requirements FW-01 through FW-04 and RATE-01/RATE-02.
