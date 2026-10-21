---
'@kehto/paja': patch
---

Make every verified tab's Share button open a dialog with a selectable app link,
visible copy confirmation, and manual copying when clipboard access is blocked
or unavailable. Keep intent-link creation limited to advertised contracts, and
prevent dialog clicks from reaching the loaded apps underneath it.
