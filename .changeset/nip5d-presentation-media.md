---
"@kehto/nip": minor
---

Chase the NIP-5D source and presentation media amendments (dskvr/nips `nip/5d` at `6e24617`). `parseNappletManifest` now carries `screenshots`, `preview`, `sourceCommit` and `sourceArchive` from current manifests, accepts the amended `source` locations (HTTP(S), SSH, scp-like, Git and NIP-34 `nostr://`), and ignores malformed or repeated source metadata instead of rejecting the manifest. `@kehto/nip/5d` also exports `parsePresentationMedia`, `parseSourceMetadata`, `isSourceLocation`, `sniffPresentationMediaFormat` and `verifyPresentationMediaBytes` so hosts can apply the specification's hash and decoded-format checks before rendering media.
