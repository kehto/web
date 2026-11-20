# @kehto/conformance

Runtime conformance suite for NIP-5D and the NAP domains a Kehto runtime
advertises: a reusable engine, a deterministic first-party Kehto target, the
reference probe napplet, and `pretty`/`json`/`junit` reporters.

```bash
pnpm add -D @kehto/cli @playwright/test
npx playwright install chromium
kehto conformance --profile minimal
kehto conformance --reporter junit --out conformance.xml
```

Exit codes: `0` all applicable checks passed, `1` an error-severity check
failed, `2` usage or harness error.

Programmatic use in a browser page:

```ts
import { runConformance } from '@kehto/conformance';
import { createKehtoTarget } from '@kehto/conformance/kehto-target';

const run = await runConformance(createKehtoTarget(), { profile: 'full' });
console.log(run.statement);
```

See [docs/packages/conformance.md](../../docs/packages/conformance.md) for the
check catalog, profiles, authority refs and the spec-gap policy.
