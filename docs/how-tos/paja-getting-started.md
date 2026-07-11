# Paja Getting Started

Paja runs one local napplet app inside the real Kehto browser runtime while your
app dev server keeps its own HMR loop.

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

## 3. Check Identity

The **Signer** panel shows the generated development pubkey. Calls to
`identity.getPublicKey` return that pubkey by default, so identity-dependent
napplets can render useful logged-in states while local authoring.

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

## 5. Tune ACL

Use **ACL** to grant or revoke runtime capabilities such as `state:write`,
`notify:send`, `outbox:write`, and `upload:write`. These controls write through
Kehto runtime ACL state; denials come back through the normal runtime error
envelopes.

## 6. Watch Messages

Use **Messages** to filter inbound and outbound envelopes by type, domain, or
payload text. The log includes target traffic plus Paja system events for
interface toggles, ACL changes, signer changes, and signer/publish
confirmations. Error envelopes show their error text directly in the row.

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
choose **Bunker** for a NIP-46 signer. Every sign or publish request opens a
browser confirmation prompt. There is no bypass list and no remembered allow
rule. A configured fixed pubkey remains read-only unless the connected signer
proves the same pubkey.

## More

- [Use Paja for local napplet authoring](./paja-local-authoring.md)
- [@kehto/paja package reference](/packages/paja)
