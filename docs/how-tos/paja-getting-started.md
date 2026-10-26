# Paja Getting Started

Paja runs one local napplet app inside the real Kehto browser runtime while your
app dev server keeps its own HMR loop.

The browser page title follows the active napplet tab name, including when switching or closing tabs. With no active napplet, the title is `@kehto/paja`.

## 1. Install the CLI

```bash
pnpm add -D @kehto/cli
```

## 2. Add a Dev Script

Use the app server URL you expect Vite, Next, or another tool to serve:

```json
{
  "scripts": {
    "dev": "kehto paja --target-url http://127.0.0.1:5173 -- pnpm vite --host 127.0.0.1"
  }
}
```

Run it:

```bash
pnpm dev
```

Open the printed Paja runtime URL, not the app server URL.

Paja sandboxes the target iframe without `allow-same-origin`, so the app fetches
its own module scripts with `Origin: null`. Allow that origin in the dev server
or the app's entry module is blocked and the frame stays blank — Vite needs
`server: { cors: { origin: '*' } }` because its default allowlist covers only
localhost origins. When the target would block the frame, Paja logs a
`paja.target.cors.error` entry in **Messages** and warns on the browser console.

## 3. Check Identity

Paja does not generate or select a development signer by default. It
auto-connects NIP-07 when a browser provider is available; otherwise the
**Signer** panel starts disconnected and `identity.getPublicKey` returns the
empty string until you select **Dev**, connect **NIP-07** or **Bunker**, or
configure the fixed read-only identity below. NIP-5D keeps signer APIs outside
the napplet iframe, so every signing path remains shell-mediated; see the
immutable [NIP-5D authority at
`eb45dfd7335b7f88cb53781984c553581d2b4c34`](https://github.com/nostr-protocol/nips/blob/eb45dfd7335b7f88cb53781984c553581d2b4c34/5D.md).

For a fixed pubkey, use:

```bash
kehto paja \
  --target-url http://127.0.0.1:5173 \
  --identity-mode fixed \
  --identity-pubkey 4444444444444444444444444444444444444444444444444444444444444444
```

## 4. Toggle Interfaces

Use **Interfaces** to turn individual `window.napplet.<domain>` injection on or
off. Paja reloads the target after each toggle, and the next `shell.init`
advertises the changed support surface.

`shell` is an optional interface. Its readiness exchange supplies environment information; domain calls do not wait for it. `supports(domain)` reads namespace presence locally. See the living [NAP-SHELL](https://github.com/napplet/naps/blob/master/naps/NAP-SHELL.md).

`gamepad` adds host-owned controller snapshots. Keep keyboard or pointer controls available and ignore gameplay transitions while `focused` is false. See [GAMEPAD hosting](/gamepad).

## 5. Tune ACL

Use **ACL** to grant or revoke runtime capabilities such as `state:write`,
`notify:send`, `outbox:write`, and `upload:write`. These controls write through
Kehto runtime ACL state for the active napplet identity. Denials use each NAP's
defined failure shape; for example, a denied `outbox.query` returns a correlated
`outbox.query.result` with `events: []` and `error`.

## 6. Watch Messages

Use **Messages** to filter inbound and outbound envelopes by type, domain, or
payload text. The log includes target traffic plus Paja system events for
interface toggles, ACL changes, signer changes, and signer/publish
confirmations. Error envelopes show their error text directly in the row.

**Events** sits below it and groups relay receipts by the routing box that chose
the relays — **outbox relays (NIP-65)**, **relay hints**, **fallback relays**,
**scoped relay**, and **host pool** — then lists each relay with a bar scaled
against the busiest relay of the session, a receipt count, and its `kind - count`
rows. Boxes always render in that routing order rather than by size, so they do
not reshuffle while you watch. A box is a routing decision, not a relay set: one
relay read for two different reasons appears in both boxes with its two counts
kept apart, and every receipt belongs to exactly one box, so box counts add up to
the header total. Configured fallback relays
are listed from boot, so a relay that has served nothing yet still shows up as
`unused`, and one that answered a read with nothing shows as `silent`. When no
read in the session was routed by an author's NIP-65 list — common for apps that
query by kind rather than by author — the NIP-65 box says
`no author-routed reads` instead of showing a zero. The header
total counts receipts, not distinct events; hover it to see how many unique
events they came from. The `reset` button beside that total clears every counter
without reloading the host page.

## Intent Delivery in a Local Host

Paja's installed intent catalog contains resolver-verified manifest contracts;
it is not the same thing as the live target iframe. A closed target can remain
installed and be cold-started. Selection uses only exact compatible installed
contracts: a compatible default can win, the host can ask a chooser, ambiguity
is rejected, and an explicit opaque handler ID needs sender-aware authorization.

Paja starts or reuses the verified target, waits for its current registered
source and `shell.ready`, then sends exactly one target-only `intent.deliver` for
the selected convention. The source result acknowledges retained responsibility
before target completion. Stale/replaced targets and terminal failures remain
host-observable controller outcomes without a second source result.

## 7. Choose Upload Storage

The default upload backend is a memory simulator; it does not store bytes. For
real Blossom uploads, select a writable signer in the **Signer** panel and run:

```bash
kehto paja \
  --target-url http://127.0.0.1:5173 \
  --upload-mode blossom \
  --upload-server https://blossom.example
```

Paja discloses the file, napplet, selected server, and public/durable effect
before signing or sending it. Use HTTPS in production. Loopback HTTP is allowed
for a local Blossom fixture, which must permit browser CORS preflight, `PUT`,
`Authorization`, and `Content-Type`.

## 8. Publish Safely

Paja begins without a writable signer. Select **Dev**, use **NIP-07** to connect
a browser extension signer, or paste a `bunker://` or `nostrconnect://` URI and
choose **Bunker** for a NIP-46 signer. Every sign, publish, Blossom upload, or
external-link request opens Paja's serialized in-page confirmation dialog.
Deny has initial focus and Escape denies. Signing defaults to one-time approval;
for a napplet-attributed request, you can instead remember the exact event kind
or trust every kind from that napplet identity and Paja target. The trust choice
warns that future events will be signed without another prompt. Choices are
isolated by signer pubkey, host-owned d-tag and aggregate hash, plus the verified
runtime-pointer artifact or exact direct-target URL. Direct-target trust
survives code reloads at that URL. **Forget remembered approvals** revokes every
saved choice; if browser storage refuses deletion, Paja keeps it listed and
logs the failure. A full Paja host reload creates another ephemeral Dev signer
and asks again, while the same NIP-07/NIP-46 account can reuse saved choices.
Publish and other operation prompts remain independent. A configured fixed
pubkey remains read-only unless the connected signer proves the same pubkey.

## More

- [Use Paja for local napplet authoring](./paja-local-authoring.md)
- [@kehto/paja package reference](/packages/paja)

## NIP-5D runtime pointers

Paja MUST load all three NIP-5D manifest kinds: root `15129`, named `35129`, and snapshot `5129`. Use an `naddr` with an empty identifier for the latest root, an `naddr` with the literal `d` identifier for the latest named napplet, or a `nevent` to pin a signed event of any of the three kinds. Snapshots require `nevent` because they are immutable events without replaceable coordinates. All paths verify the signed manifest and artifact hash before injecting `srcdoc`. Distinct snapshots retain separate tabs and catalog identities even when their artifact bytes match.

## Controller diagnostics

Paja shows a numbered controller icon directly beside the console arrow for each controller the browser detects. Each slot has its own color and input animation; hover for the controller model and activity state. Buttons and stick movement light up only that controller (stick movement below 0.12 is ignored). Quick taps retain the highlight briefly so they are easy to spot. Reduced-motion settings keep the activity highlight without animation. Disconnecting removes the icon. Browsers may require a button press before exposing a newly connected controller. These host diagnostics work without a napplet gamepad subscription and do not change focus-scoped input delivery.
