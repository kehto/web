# @kehto/cli

Top-level Kehto CLI namespace.

```json
{
  "scripts": {
    "dev": "kehto paja --target-url http://127.0.0.1:5173 -- pnpm vite --host 127.0.0.1"
  }
}
```

`kehto paja` runs the Paja local authoring workshop from `@kehto/paja`.

`kehto conformance` runs the `@kehto/conformance` runtime conformance suite in
headless Chromium (needs the optional `@playwright/test` peer):

```bash
kehto conformance --profile minimal
kehto conformance --reporter junit --out conformance.xml
```
