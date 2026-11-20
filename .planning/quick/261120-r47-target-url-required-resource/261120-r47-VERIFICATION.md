---
status: passed
---

# Goal verification

| Requirement | Evidence |
| --- | --- |
| Issue repro loads | Literal repro (python `http.server` + built `kehto paja --target-url`) renders `resource: object`; CLI prints `Target network: isolated snapshot` |
| target-url + required resource | `browser-target-frame.test.ts` (closed CSP, no dev origin, no base, no network prompts, `resource` granted); `paja-target-url-resource.spec.ts` case 1 |
| Direct network really denied | Chromium: fetch, XHR, WebSocket, EventSource, image, script, style, media, worker blocked for the dev origin and a third origin; both servers record zero probe requests, beacon included |
| target-url + optional resource | Unit and Chromium case 2: frame stays live, `resource` absent, dev-origin fetch succeeds (probe control), third origin still closed |
| Network-open frame still refuses | Existing `packages/shell/src/browser-admission.test.ts`; new Paja case with host-granted `connectOrigins`, no prompt, no bytes executed |
| Verified / local-file admission unchanged | No `@kehto/shell` source change; `paja-runtime-pointer.spec.ts` and the full unit suite pass |
| Up-front messaging | `cli.test.ts`, `server.test.ts`, `target-network.test.ts`; console warning asserted in both Chromium cases |

Gates: `pnpm build` 18/18, `pnpm type-check` 20/20, `pnpm test:unit` 275 files / 3502 tests, `pnpm docs:check` OK, Playwright 30/30 across `paja-target-url-resource`, `paja-single-window`, `paja-runtime-pointer` (workers=1), aislop 99/100 (origin/main baseline 99/100, same two pre-existing findings).

Not run: the full Playwright suite; Firefox and WebKit (the repo's Playwright project is Chromium only).
