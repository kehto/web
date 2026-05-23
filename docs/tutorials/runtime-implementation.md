# Tutorial: Runtime Implementation

This guide expands the minimal host into the normal implementation sequence for a browser shell.

## Step 1: Define host responsibilities

Kehto owns protocol dispatch and shell/runtime contracts. Your host owns:

- iframe creation and layout;
- relay pool selection and publication;
- signer access;
- persistence storage;
- capability grants and revocations;
- service backing callbacks;
- user-facing consent and compatibility warnings.

## Step 2: Create the shell bridge

Use `createShellBridge()` when you are in a browser. It creates a runtime internally and adapts browser hooks to runtime adapters.

```ts
import { createShellBridge } from '@kehto/shell';

const bridge = createShellBridge(adapter);
window.addEventListener('message', bridge.handleMessage);
```

Use `createRuntime()` directly only for non-browser tests, alternative transports, or host shells that do not use the Kehto browser bridge.

## Step 3: Register services

Register each service under the domain name that incoming NUB messages use.

```ts
import {
  createIdentityService,
  createRelayPoolService,
  createKeysService,
  createMediaService,
  createNotifyService,
} from '@kehto/services';

bridge.runtime.registerService('identity', createIdentityService(identityOptions));
bridge.runtime.registerService('relay', createRelayPoolService(relayOptions));
bridge.runtime.registerService('keys', createKeysService(keysOptions));
bridge.runtime.registerService('media', createMediaService(mediaOptions));
bridge.runtime.registerService('notify', createNotifyService(notifyOptions));
```

Keep host-specific behavior behind options and bridge interfaces. Do not patch message dispatch.

## Step 4: Define ACL policy

The runtime checks every capability-gated message. Grant only the capabilities the napplet manifest requires and the user has accepted.

```ts
bridge.runtime.aclState.grant(pubkey, dTag, aggregateHash, 'relay:write');
bridge.runtime.aclState.grant(pubkey, dTag, aggregateHash, 'notify:send');
```

Use the package docs for `@kehto/acl` when you need lower-level state migration or policy tests.

## Step 5: Load gateway artifacts

Follow the playground order:

1. Read `/napplet-gateway/<dTag>/manifest.json`.
2. Parse `requires` tags.
3. Compare required NUBs against hosted `shell.supports()` capability inventory.
4. Register `(dTag, aggregateHash)` identity before iframe navigation.
5. Navigate to `/napplet-gateway/<dTag>/<aggregateHash>/index.html`.

Reject or warn before loading when a required capability is unsupported.

## Step 6: Handle teardown

On shell shutdown:

1. Remove `message` listeners.
2. Destroy `ShellBridge`.
3. Stop host relay subscriptions.
4. Unsubscribe native key/media bridges.
5. Persist or clear host-owned state according to your product policy.

Do not leave runtime sessions or relay subscriptions alive after the iframe is removed.
