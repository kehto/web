---
status: resolved
trigger: "Live GBColor Blossom fetch succeeds after server discovery but Paja returns decode-failed"
created: 2026-08-27
updated: 2026-08-27
---

# Paja Game Boy ROM decoding

## Expected

After Paja discovers a Blossom server and verifies the requested SHA-256, a
valid Game Boy ROM should be returned to the napplet as a Blob with a
runtime-classified MIME type.

## Actual

The deployed runtime fetched a 1,048,576-byte ROM from
`https://cdn.hzrd149.com` with HTTP 200 and the exact requested hash, then
returned `resource.bytes.error` with `decode-failed`.

## Root cause

`sniffSafeResourceMime` recognized a narrow image, audio, video, font, and text
set. A Game Boy ROM is binary and therefore fell through to the fatal UTF-8
decoder, which returned no classification. The Blossom resolver converted that
missing classification into `decode-failed` even though integrity verification
had passed.

## Protocol authority checked

NAP-RESOURCE draft
`9511232f69313aa7953d110e35d32cc28d506f66` requires byte-based MIME
classification, scheme-appropriate allowlists, and Blossom SHA-256 verification.
It forbids trusting upstream `Content-Type`; it does not require Paja to reject
checksum-valid Game Boy ROM data.

## Fix policy

Recognize the canonical 48-byte Nintendo logo at header offset `0x104` and
validate the Game Boy header checksum over `0x134..0x14c`. Only bytes satisfying
both checks receive `application/vnd.nintendo.gb-rom`. Raw SVG/HTML, unknown
binary, and Blossom hash mismatches remain rejected.

## Resolution

Paja now recognizes only ROMs with both the canonical Nintendo logo and a valid
Game Boy header checksum, returning `application/vnd.nintendo.gb-rom` without
consulting the response `Content-Type`. A regression supplies a valid ROM vector
behind a deliberately false `text/html` response header and asserts both the
runtime-classified MIME type and exact returned bytes.

The live NHL Blades of Steel resource used in the original report has the exact
requested SHA-256, the canonical logo, and a valid stored header checksum, so it
passes the new classifier.

## Verification

- Focused Paja tests: 15 passed
- `pnpm build`: passed
- `pnpm type-check`: passed
- `pnpm test:unit`: 147 files, 1,717 tests passed
- `pnpm docs:check`: passed
- `pnpm test:e2e`: 84 tests passed
- AI-slop gate: 100/100, zero findings
