---
phase: 110-kernl-developer-launch
plan: 01
status: complete
requirements-completed: [PAGE-02, QUALITY-01]
---

# Developer launch verification

The developer story explains runtime, permissions, reference services and the
host shell, followed by a real TypeScript excerpt and paths into Paja, the
playground, and documentation. All local navigation and media URLs were fetched
successfully from the complete Pages artifact. Current docs use kernl; package
names, CLI commands and canonical URLs remain working as requested.

## Verification

- `pnpm build`: 32 tasks passed.
- `pnpm type-check`: 17 tasks passed.
- `pnpm test:unit`: 166 files, 2,096 tests passed.
- `pnpm test:e2e`: all 120 existing runtime browser tests passed.
- `pnpm site:build`: complete artifact, including strict TypeDoc and docs gate.
- `pnpm site:audit`: all destination, gateway, media and API routes passed.
- `pnpm exec playwright test --config tests/site/playwright.config.ts`: seven tests passed, including desktop/390px/320px first-screen bounds, no overflow, playback, pause, reduced motion, links/MIME types, no-JS, keyboard and fullscreen.
- Displayed TypeScript compiled against built package declarations in a unit test.
- AI-slop 0.12.0 changed-file score 100/100, no findings. Full-repo score 95/100 passes the pinned threshold; five existing complexity warnings remain in untouched Paja, shell intent, and CVM source. Config unchanged.
- Desktop/mobile page screenshots and a contact sheet spanning all five film scenes visually inspected. MP4 metadata and captured runtime messages verified.
- Security review: no open threats in the changed static site and capture tooling.

A dedicated PR workflow now repeats artifact and landing browser checks. The
film renderer remains an explicit local tool; CI verifies the checked-in media.
No package shipped output changed, so no Changeset is required.

## Protocol evidence

Checked NAP-SHELL and NAP-THEME at
`napplet/naps@e5308ac92cfd49e4fb026812c60886571515e219`. The theme example uses
current options and a valid service handler; the captured query/result agrees
with NAP-THEME. Existing mandatory-shell behavior predates the newer optional
NAP-SHELL contract and is explicitly outside this rebrand. No protocol claim
or package implementation was changed to conceal that drift.
