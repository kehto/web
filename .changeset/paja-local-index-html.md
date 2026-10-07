---
'@kehto/paja': minor
---

Paja runtime-pointer mode can open a napplet from a local single-file `index.html` through an "Open file…" picker or drag and drop. The file's identity comes from its bytes: the NIP-5A single-path aggregate, plus a `dTag` from `<meta name="napplet-id">` or `local-<file-stem>`. It loads through the same sandboxed `srcdoc`, CSP, and `window.napplet` prelude path as verified pointers. Local tabs are development-only. They never enter the installed catalog or receive intents, and they are not restored after a reload. New exports: `createPajaLocalTarget`, `isPajaLocalTarget`, `isPajaLocalHtmlFile`, `readNappletIdMeta`, `findRelativeAssetReferences`, `PAJA_LOCAL_SINGLE_FILE_HINT`, `PajaLocalTarget`, `PajaLocalFileInput`, and `PajaRuntimeTarget`.
