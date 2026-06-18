/**
 * globals.d.ts — Playwright harness driver API type declarations.
 *
 * Consumed by:
 *   - tests/e2e/harness/harness.ts (runtime assignments must mirror this shape)
 *   - tests/e2e/*.spec.ts (via triple-slash reference or tsconfig include)
 *   - tests/e2e/helpers/* (via project tsconfig)
 *
 * All globals must return structured-clone-safe values (primitives or plain objects).
 * See REQUIREMENTS.md E2E-04 for the canonical list.
 */

import type { NappletMessage } from '@napplet/core';
import type { NostrEvent } from '@napplet/core';
import type { ShellBridge } from '@kehto/shell';
import type { MockHooksResult, TappedMessage } from '@test/helpers';

export {};

declare global {
  interface Window {
    // ─── Legacy driver API (unchanged from v1.2) ───────────────────────
    __SHELL_READY__: boolean;
    __TEST_MESSAGES__: TappedMessage[];
    __loadNapplet__: (name: string, params?: Record<string, string>) => string;
    __unloadNapplet__: (windowId: string) => void;
    __clearMessages__: () => void;
    __getRelay__: () => ShellBridge;
    __getMockHooks__: () => MockHooksResult;
    __injectMessage__: (windowId: string, data: unknown[]) => void;
    __createSubscription__: (windowId: string, subId: string, filters: unknown[]) => void;
    __publishEvent__: (windowId: string, event: unknown) => void;
    __closeSubscription__: (windowId: string, subId: string) => void;
    __getChallenge__: (windowId: string) => string | undefined;
    __getNappletFrames__: () => string[];

    // ─── ACL control globals (v1.2, unchanged) ─────────────────────────
    __aclRevoke__: (pubkey: string, dTag: string, hash: string, cap: string) => void;
    __aclGrant__: (pubkey: string, dTag: string, hash: string, cap: string) => void;
    __aclBlock__: (pubkey: string, dTag: string, hash: string) => void;
    __aclUnblock__: (pubkey: string, dTag: string, hash: string) => void;
    __aclPersist__: () => void;
    __aclLoad__: () => void;
    __aclClear__: () => void;
    __aclCheck__: (pubkey: string, dTag: string, hash: string, cap: string) => boolean;
    __aclGetEntry__: (pubkey: string, dTag: string, hash: string) => unknown;
    __getNappPubkey__: (windowId: string) => string | undefined;
    __getNappEntry__: (windowId: string) => { pubkey: string; dTag: string; aggregateHash: string } | undefined;
    __setSigner__: (signer: unknown) => void;
    __setConsentHandler__: (mode: 'auto-approve' | 'auto-deny') => void;
    __injectShellEvent__: (topic: string, payload: unknown) => void;
    __getLocalStorageKeys__: () => string[];
    __getLocalStorageItem__: (key: string) => string | null;
    __setLocalStorageItem__: (key: string, value: string) => void;
    __clearLocalStorage__: () => void;

    // ─── NIP-5D envelope-aware globals (v1.3, Plan 16-03) ──────────────

    /**
     * Inject a NIP-5D envelope into the runtime as if posted by the given napplet.
     * Synchronous — the envelope passes through relay.handleMessage immediately.
     * @param windowId - The harness-assigned window id for the napplet iframe.
     * @param envelope - A NIP-5D NappletMessage (must include `type: string`).
     */
    __injectEnvelope__: (windowId: string, envelope: NappletMessage) => void;

    /**
     * Snapshot the most recent NIP-5D envelope recorded for a napplet, optionally
     * filtered by envelope `type`. Returns a deep clone (structured-clone-safe).
     * @param windowId - The harness-assigned window id.
     * @param type - Optional envelope type filter (e.g., "relay.publish").
     * @returns The last matching NappletMessage, or null if none recorded.
     */
    __getNapMessage__: (windowId: string, type?: string) => NappletMessage | null;

    /**
     * List the currently registered service names from the runtime's service registry.
     * Includes both the initial set from createMockHooks and any services registered
     * via __registerService__ at runtime.
     * @returns An array of service names (e.g., ["identity", "notifications"]).
     */
    __getServiceNames__: () => string[];

    /**
     * Evaluate `handlerScript` in the harness context (no network/IO side effects
     * expected) and register the resulting handler with the runtime under `name`.
     * The script MUST evaluate to a ServiceHandler-shaped object.
     *
     * @example __registerService__('keys', '({ name: "keys", version: "0.1.0", handleMessage: () => null })')
     *
     * @param name - The service name to register.
     * @param handlerScript - A JS expression (not a full function body) that evaluates to a ServiceHandler.
     * @returns true if registration succeeded; false if the script evaluation threw.
     */
    __registerService__: (name: string, handlerScript: string) => boolean;

    /**
     * Unregister a service by name.
     * @param name - The service name previously registered.
     * @returns true if a service was removed; false if no such service existed.
     */
    __unregisterService__: (name: string) => boolean;

    /**
     * Snapshot the notification-service state, deep-cloned and filtered by windowId.
     * @param windowId - Optional filter; if omitted, returns all notifications.
     * @returns An array of serializable notification entries.
     */
    __getNotifications__: (windowId?: string) => Array<{ id: string; title: string; body?: string; read: boolean }>;

    /**
     * Set the pubkey returned by subsequent `identity.getPublicKey` requests.
     * Delegates to mockResult.setUserPubkey() under the hood.
     * @param pubkey - 64-char hex pubkey string.
     */
    __setIdentityPubkey__: (pubkey: string) => void;

    /**
     * Readiness flag per napplet — set to true by the harness AFTER the runtime
     * acknowledges the napplet's AUTH handshake (i.e., sessionRegistry has an entry
     * for this windowId's pubkey). Consumed by Plan 16-04's waitForNappletReady helper.
     * @param windowId - The napplet's window id.
     * @returns true if the napplet's session is acknowledged; false otherwise.
     */
    __nappletReady__: (windowId: string) => boolean;
  }
}
