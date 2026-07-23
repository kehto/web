---
phase: 102-nap-inc-event-channel-parity
reviewed: 2026-07-23T19:46:17Z
depth: standard
files_reviewed: 39
files_reviewed_list:
  - .changeset/phase-102-acl-inc.md
  - .changeset/phase-102-runtime-inc.md
  - .changeset/phase-102-services-inc.md
  - .changeset/phase-102-shell-inc.md
  - apps/playground/README.md
  - apps/playground/napplets/bot/src/main.ts
  - apps/playground/napplets/chat/src/main.ts
  - apps/playground/src/flow-animator.ts
  - apps/playground/src/main-notifications.ts
  - docs/packages/services.md
  - docs/policies/NIP-5D-CONFORMANCE.md
  - packages/acl/src/resolve.ts
  - packages/paja/src/browser-host.test.ts
  - packages/runtime/README.md
  - packages/runtime/src/acl-state.ts
  - packages/runtime/src/inc-handler.ts
  - packages/runtime/src/runtime.test.ts
  - packages/runtime/src/runtime.ts
  - packages/runtime/src/session-registry.ts
  - packages/runtime/src/types.test.ts
  - packages/services/README.md
  - packages/services/package.json
  - packages/services/src/index.ts
  - packages/services/src/media-service.ts
  - packages/services/src/notification-service.test.ts
  - packages/services/src/notification-service.ts
  - packages/services/src/notify-service.ts
  - packages/services/src/types.ts
  - packages/shell/README.md
  - packages/shell/src/napplet-namespace.test.ts
  - packages/shell/src/napplet-namespace.ts
  - skills/add-service/SKILL.md
  - skills/integrate-shell/SKILL.md
  - tests/e2e/demo-notification-service.spec.ts
  - tests/e2e/nap-inc-playground.spec.ts
  - tests/e2e/notify-lifecycle.spec.ts
  - tests/e2e/paja-single-window.spec.ts
  - tests/unit/nip5d-conformance-guard.test.ts
  - tests/unit/playground-gateway-guard.test.ts
findings:
  critical: 2
  warning: 3
  info: 0
  total: 5
status: issues_found
---

# Phase 102: Code Review Report

**Reviewed:** 2026-07-23T19:46:17Z  
**Depth:** standard  
**Files Reviewed:** 39  
**Status:** issues_found

## Summary

Reviewed the INC event/channel implementation, direct-notification migration, shell namespace bridge, demos, tests, and documentation. The package type checks for runtime, shell, and services pass, but that does not cover target-side authorization at channel creation or cross-window notification mutation. I also checked the Phase's INC behavior against `napplet/naps` `NAP-INC.md` at draft #89 head `4593ce9e301ce098fd3dad64206fcd6f144fa7af`, with the symmetric channel clarifications at draft #92 head `c5cd06f7be6d4690b303949abb26e87ff62f4729`; the `channel.open` contract requires the shell to validate both the target and ACL at open time.

## Critical Issues

### CR-01: Channel opening skips the target ACL check

**Classification:** BLOCKER  
**File:** `packages/runtime/src/inc-handler.ts:182-200`  
**Issue:** `channel.open` verifies only that the peer session exists, then records the route. The generic runtime gate checks only the sender (`packages/runtime/src/runtime.ts:316-326`), and the INC capability map intentionally leaves `recipientCap` empty (`packages/acl/src/resolve.ts:155-168`). Consequently, an app with `relay:read` can open a channel to a target that is denied or lacks the target-side INC permission. Subsequent channel messages deliberately bypass the global ACL gate, so the invalid route remains usable until a later mutation happens to revoke it. This violates the required open-time ACL check and bypasses the target's isolation policy.

**Fix:** Pass an ACL-aware target authorization predicate into `createIncRuntime` and reject the open before `addChannel` when it returns false. The predicate must evaluate the resolved target session, not the opener.

```ts
const peerWindow = resolveTarget(sessionRegistry, m.target ?? '');
if (!peerWindow || !hooks.isIncTargetAllowed(peerWindow)) {
  hooks.sendToNapplet(windowId, {
    type: 'inc.channel.open.result', id, error: 'target denied',
  } as NappletMessage);
  return;
}

addChannel(state, channelId, windowId, peerWindow);
```

Wire `isIncTargetAllowed` from the runtime's ACL/session state and add tests for a blocked target and for a target whose `relay:read` capability is revoked before open.

### CR-02: Any napplet can dismiss or mark another window's notification as read

**Classification:** BLOCKER  
**File:** `packages/services/src/notification-service.ts:58-66, 89-108, 126-135`  
**Issue:** `notify.dismiss` and `notify.read` receive the caller's `windowId`, but discard it and locate the supplied notification ID across every window. Notification IDs are predictable (`notif-${Date.now()}-${counter}`), so a napplet can mutate another napplet's notification state by observing or guessing an ID. This breaks the service's stated per-window ownership model; only `notify.list` currently scopes data to the caller.

**Fix:** Resolve the ID only inside the caller's own list (or explicitly compare the found owner to `windowId`) before mutating it.

```ts
function dismissNotification(store: NotificationStore, windowId: string, id: string): void {
  const list = store.notifications.get(windowId);
  const index = list?.findIndex((notification) => notification.id === id) ?? -1;
  if (index < 0 || !list) return;
  list.splice(index, 1);
  if (list.length === 0) store.notifications.delete(windowId);
  notify(store);
}

// In handleNotifyEnvelope:
dismissNotification(store, windowId, notifId);
```

Apply the same owner-scoped lookup to `markNotificationRead`, and add negative tests using two distinct window IDs.

## Warnings

### WR-01: Failure to return the open result leaves a one-sided live channel

**Classification:** WARNING  
**File:** `packages/runtime/src/inc-handler.ts:199`  
**Issue:** The peer notification is guarded and rolls back on failure, but the subsequent `inc.channel.open.result` send to the opener is not. If the opener frame disappears between those sends, the adapter throws after the route has been added and after the peer has received `inc.channel.opened`. The peer is left with a usable-looking channel whose opener never received its ID, and the exception escapes the runtime message handler.

**Fix:** Guard the result send too; on failure, tear down the route and send `inc.channel.closed` to the peer where possible.

```ts
try {
  hooks.sendToNapplet(windowId, result);
} catch {
  teardownChannel(state, hooks, channelId, 'peer closed');
}
```

Add an adapter test that throws only when sending the result back to the opener and assert that neither channel membership nor peer handle survives.

### WR-02: The notification service advertises and documents a registration name that cannot route its messages

**File:** `packages/services/src/notification-service.ts:182-192`; `packages/shell/README.md:77-81`  
**Issue:** The service descriptor and shell quick-start register the handler as `notifications`, while the handler accepts the `notify.*` protocol domain. The runtime dispatches a napplet message by its prefix, so a host following the documented example has no `notify` service and all direct notification operations are silently unhandled. The playground works only because it registers the same handler under an extra `notify` alias.

**Fix:** Make the service's public registration key match its wire domain and update the example.

```ts
const descriptor: ServiceDescriptor = { name: 'notify', /* ... */ };
bridge.runtime.registerService('notify', createNotificationService({ onChange: updateBadge }));
```

If backward compatibility for `notifications` is required, explicitly register and document both aliases instead of presenting the legacy name as sufficient.

### WR-03: Host-originated notification flows can never be highlighted

**Classification:** WARNING  
**File:** `apps/playground/src/flow-animator.ts:109-149`  
**Issue:** `buildHighlightPath` returns as soon as a message has no napplet window ID (line 111). The special case intended for a host-originated notification explicitly requires `!nappletName` at lines 142-149, so it is unreachable. Notifications emitted by the host therefore cannot animate the advertised notification route.

**Fix:** Handle the no-window notification case before the generic no-window return, constructing its host/service/runtime path there; then retain the early return for unrelated host messages.

```ts
if (!nappletName && isNotificationTopic(msg)) {
  return { nodes: [TOPOLOGY_NODE_SERVICE_NOTIFICATIONS, TOPOLOGY_NODE_RUNTIME],
    edges: [getRuntimeServiceEdgeId('notifications'), getAclRuntimeEdgeId()] };
}
if (!nappletName) return null;
```

---

_Reviewed: 2026-07-23T19:46:17Z_  
_Reviewer: the agent (gsd-code-reviewer)_  
_Depth: standard_
