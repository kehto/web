---
phase: 114-paja-and-playground-approval-flows
plan: 10
status: complete-with-scope-correction
---

# Playground launch-boundary inventory

Source inventory found one executable path, `loadPlaygroundNapplet`, which
resolves and verifies signed catalog bytes before `admitBrowserDocument` commits
`srcdoc`. Installed intent targets reuse the verified catalog. The playground
has no local file, unsigned artifact, or live dev-server napplet input; `pnpm
dev` develops the host. We therefore did not create the untrusted loader that
the initial plan mistakenly assumed existed.

All current playground launches use verified manifest/catalog ID plus artifact
hash as their permission principal and request no direct browser origins.
Gateway responses, demo constants, preferences, and relay/Blossom hints cannot
insert a grant. Unit and source-audit tests cover pre-execution admission,
currentness, verified bytes, CSP/namespace provenance, required denial, and
replacement; Chromium counts zero fetch, script, image, frame, object, and
manifest requests from a verified frame to a controlled origin. A future
unsigned loader must introduce its own exact development identity and admission
tests before it can execute.
