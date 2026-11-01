---
status: complete
---
# Chase NIP-5D presentation media and source pin tags

Implemented in 743920d9 (parser, tests, changeset) and 7b81a20d (docs) on feat/nip5d-presentation-media, isolated from the primary checkout's unrelated root package.json edit.

## Result

`@kehto/nip/5d` now parses the NIP-5D source and presentation media amendments: one well-formed `source` in the accepted HTTP(S), SSH, scp-like, Git or NIP-34 `nostr://` forms, `source-commit` only alongside a usable `source`, a four-element HTTPS `source-archive`, ordered usable `screenshot` entries and a single `preview` with NIP-92 `key value` fields. Malformed or repeated source and media tags are ignored instead of rejecting the manifest, as the amendment requires; the previous hard rejection of a repeated `source` tag is gone. New exports `parseSourceMetadata`, `isSourceLocation`, `parsePresentationMedia`, `sniffPresentationMediaFormat` and `verifyPresentationMediaBytes` give hosts the client checks (hash, decodable container, declared `m` equality) before rendering media. Legacy aggregate events stay frozen.

No Kehto host renders screenshots, previews or source links; Paja, the playground and `@kehto/services` project only NAP-INTENT routing facts and `title`, so their records need no new fields. `@napplet/core`/`@napplet/nap` did not change upstream for this amendment (napplet/web PR #272 touched cli, conformance and vite-plugin), so the pinned 0.32.0 runtime line is unchanged.

## Authority

Conformant with NIP-5D PR #2303 at dskvr/nips@6e24617cde507c0a87fa170af9ed6b2b46545b2d (`5D.md` §Source, §Presentation media; delta since 020cb8b). Spec-gap decision recorded in docs/policies/NIP-5D-CONFORMANCE.md: an HTTP(S) `source` may be a repository or an archive and cannot be distinguished by location, so any accepted `source` retains an otherwise valid `source-commit`.

## Verification

- Regression-first: 148 focused Vitest tests in packages/nip/src/5d, including real PNG/JPEG/WebP/WebM/MP4 container headers and manifest-level playback-never-blocked cases.
- pnpm build: 32 tasks passed.
- pnpm type-check: 32 + 17 tasks passed.
- pnpm test:unit --maxWorkers=4: 185 files, 2,381 tests passed (after `pnpm install --frozen-lockfile` to pick up the applesauce v7 lockfile from main).
- pnpm docs:check: strict TypeDoc, site build, and nine-package docs audit passed.
- pnpm dlx aislop@0.12.0 scan --changes --base origin/main --json: 100/100, no diagnostics.
- git diff --check: clean.

Only @kehto/nip shipped output changed; its minor changeset is retained.
