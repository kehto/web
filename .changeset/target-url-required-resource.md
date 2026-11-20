---
"@kehto/paja": minor
---

Load a `--target-url` napplet that requires `resource` as a network-isolated snapshot instead of refusing it. The frame gets the fetched `index.html` under the closed CSP with no dev origin, so `window.napplet.resource` is exposed with direct network denied, as NAP-RESOURCE requires. The CLI, `GET /__kehto/target-network.json`, and the message log say which mode a target runs in and which references will not load. Adds `planTargetNetwork`, `findExternalAssetReferences`, `PAJA_TARGET_RESOURCE_HINT`, and `PajaServer.inspectTargetNetwork()`.
