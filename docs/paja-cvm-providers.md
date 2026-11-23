# ContextVM providers in Paja

Paja calls ContextVM (CVM) tools through pinned provider families. A family is a
local label your app asks for, a provider (`server: { pubkey, relays }`) and the
tools it may use, each pinned by its CEP-15 schema hash. Families work for any
napplet that uses NAP-CVM's registry, with or without
[multiplayer signaling](paja-multiplayer.md).

Open **ContextVM providers** in the host sidebar to discover and save families,
or pin them in a Paja config file at `simulation.cvm.registry`:

```json
{
  "cvm": {
    "registry": [{
      "family": "soy.rooms.v1",
      "server": { "pubkey": "<64 hex>", "relays": ["wss://provider.example"] },
      "tools": [{ "name": "join_room", "schemaHash": "<64 hex>" }]
    }]
  }
}
```

Each entry has `family` (the local label expected by your app),
`server: { pubkey, relays }`, and `tools`, an array of `{ name, schemaHash }` pins. `pubkey` and each hash are lowercase
64-character hex. Obtain the inventory with `cvm.listTools(server)` or a trusted
operator tool. `computeCvmToolSchemaHash(tool)` from `@kehto/services` calculates
the CEP-15 hash from the returned name and schemas. Review those schemas before
pinning them. A configured family requires all its pins to match the live
inventory; a changed schema fails closed. Hash selectors take precedence over
local family labels. A caller's explicit server pin never falls back to another
provider. All provider requests still pass ordinary runtime approvals.

Families come from three places. For the same label and provider, a later one
wins: the deprecated `simulation.multiplayer.registry`, then
`simulation.cvm.registry`, then families saved in this browser.

## Discover and save CVM families

The **Discover CVM tools** input accepts:

- A `nevent` (optionally prefixed with `nostr:`) referencing a signed kind-11316
  server announcement or kind-11317 tool inventory. Relay hints take precedence
  over the host relay set. A server announcement resolves its author's inventory.
- A 64-character CEP-15 tool schema hash. Paja queries the host's configured live
  relays for kind-11317 announcements with a matching `i` tag.
- An HTTPS website URL or hostname. Paja reads the origin's
  `/.well-known/napplet.json`, expects `version: 1` and
  `backend: { pubkey, relays }`, then queries those relays for that author's
  tool inventory. The website must allow browser cross-origin requests (CORS).

For Nostr references, a signed CEP-17 kind-10002 relay list selects the provider's
operational relays when available; unmarked relay URLs take precedence. Otherwise
Paja retains the discovery relays for review in the generated JSON.

Choose a provider when multiple results are found. Review the tool pins, choose
the tools to include, and set the **Local family label** expected by your app
(for example, `soy.rooms.v1`). The generated JSON is read-only and labelled with
its source document or event. **Edit JSON manually** makes an editable copy and
marks its source as manual; **New manual family** starts a separate entry.

**Save family and reload** persists the selection for this host origin. Several
families and providers can coexist. Saved entries are merged with the configured
registry; the same label/provider pair uses the saved entry.
Removing a saved entry restores any configured entry with that pair.
All apps reload after a save or removal so their existing scopes are disposed.

Paja verifies announcement signatures and recomputes each tool's CEP-15 hash.
Advertised metadata or named hash tags that disagree are rejected. The newest
inventory per author is used; an invalid newest inventory doesn't fall back to
older schemas. Imports are limited to complete inventories of 1–64 tools and
16 saved families. Discovery times out after 15 seconds. Registry calls still
verify the live schemas and require the existing runtime permissions.

Family labels and membership are host choices: ContextVM defines per-tool
identity, not a portable named-family manifest. `naddr` is therefore unsupported;
use `nevent` for ContextVM's replaceable announcements. Website discovery uses
the provider's published endpoint convention, not a new NAP wire contract.
No WebRTC profile, ICE credentials, or tool invocation is inferred from it.

A hash search needs the provider's CEP-15 `i` tags and a relay carrying its
announcement. Missing tags can prevent hash discovery even when URL or `nevent`
discovery works. Soy's missing tags are tracked in
[soytec/napplet-soy#70](https://github.com/soytec/napplet-soy/issues/70).
