/**
 * config-service.ts — NAP-CONFIG reference service (9th NAP domain, v1.7 Phase 39).
 *
 * Shell-side reference implementation for the canonical NAP-CONFIG wire
 * protocol (`@napplet/nap/config`, published at `^0.3.0`). Handles the full
 * 8-message discriminated union: 5 napplet→shell request types + 3
 * shell→napplet result/push types.
 *
 * ──────────────────────────── SCOPE BOUNDARY (CONFIG-04) ─────────────────────────
 * NAP-CONFIG is **shell-managed per-napplet configuration**. Napplets observe
 * values via `config.get` (one-shot) or `config.subscribe` (snapshot + live
 * push). The shell is the **sole writer** — there is intentionally **NO**
 * `config.set` wire message. Napplets cannot mutate configuration values;
 * the shell owns persistence and the update flow.
 *
 * Do NOT use this service as a general key-value store. NAP-STORAGE
 * (`state:read` / `state:write`) remains the general KV surface. Using
 * NAP-CONFIG to store e.g. `{ lastScrollPosition: 420 }` is an anti-pattern
 * (H-07 in PITFALLS.md) — such state belongs in NAP-STORAGE.
 * ──────────────────────────────────────────────────────────────────────────────────
 *
 * Host integration: provide `getValues()` returning the current
 * `ConfigValues` snapshot. Call the returned `publishValues(newValues)`
 * whenever the configuration changes — the service fans the new snapshot
 * out to every napplet that has an active `config.subscribe`.
 *
 * Optional: provide `registerSchema` to accept napplet-declared schemas at
 * runtime (the ref impl does a minimal shape check using the Core Subset
 * validator; use `ajv` in host impls that need strict draft-07 conformance).
 * Provide `openSettings` to open a shell-side UI for the napplet (no
 * response envelope — fire-and-forget UI hook).
 *
 * @example
 * ```ts
 * import { createConfigService } from '@kehto/services';
 *
 * const configFixtures = { theme: 'dark', density: 'compact', recentSearches: [] };
 * const config = createConfigService({
 *   getValues: () => ({ ...configFixtures }),
 * });
 * runtime.registerService('config', config.handler);
 *
 * // Later, when shell-side values change:
 * configFixtures.theme = 'light';
 * config.publishValues({ ...configFixtures });
 * ```
 */

import type { NappletMessage } from '@napplet/core';
// DRIFT-CORE-06 — Phase 11-deviation: ServiceDescriptor dropped from @napplet/core
// v0.2.0+ (napplet phase-81). Re-exported from @kehto/runtime (canonical home after Phase 24 DRIFT-01).
import type { ServiceDescriptor, ServiceHandler } from '@kehto/runtime';
import type {
  ConfigGetMessage,
  ConfigRegisterSchemaMessage,
  ConfigOpenSettingsMessage,
  ConfigValues,
  ConfigValuesMessage,
  ConfigRegisterSchemaResultMessage,
  ConfigSchemaErrorCode,
  NappletConfigSchema,
} from '@napplet/nap/config/types';

/** Config service version — follows semver. */
const CONFIG_SERVICE_VERSION = '1.0.0';

/**
 * Shape returned by a successful `registerSchema` result (ok=true) or a
 * rejection (ok=false + code + error). Mirrors the wire envelope fields.
 */
export type ConfigSchemaValidation =
  | { ok: true }
  | { ok: false; code: ConfigSchemaErrorCode; error: string };

/**
 * Configuration options for `createConfigService` (options-as-bridge
 * per v1.6 Decision 18).
 *
 * @example
 * ```ts
 * const config = createConfigService({
 *   getValues: () => ({ theme: 'dark', density: 'compact' }),
 *   openSettings: (windowId, section) => showSettingsPanel(windowId, section),
 * });
 * ```
 */
export interface ConfigServiceOptions {
  /**
   * Returns the current configuration values snapshot.
   * Called on every `config.get` and at every `config.subscribe` initial push.
   * Implementations should return a fresh object (not a mutable reference).
   */
  getValues(): ConfigValues;

  /**
   * Optional: receive notification when a napplet subscribes to config updates.
   * Fire-and-forget — the service tracks the subscription internally regardless.
   */
  onSubscribe?: (windowId: string) => void;

  /**
   * Optional: receive notification when a napplet unsubscribes.
   */
  onUnsubscribe?: (windowId: string) => void;

  /**
   * Optional: validate and store a napplet-provided schema.
   *
   * If omitted, the ref impl runs its own Core Subset check (hand-coded
   * validator; 30-50 lines) and returns ok/reject. Hosts that need strict
   * draft-07 conformance should provide an ajv-backed implementation.
   *
   * Return shape mirrors `config.registerSchema.result` wire envelope
   * (minus the `id` — the dispatch layer correlates).
   */
  registerSchema?: (
    windowId: string,
    schema: NappletConfigSchema,
    version: number | undefined,
  ) => ConfigSchemaValidation;

  /**
   * Optional: open the shell-side settings UI for this napplet.
   * Fire-and-forget — no response envelope per the wire spec.
   * If omitted, `config.openSettings` is silently dropped (D10 allows
   * the config-demo napplet to function without a settings UI).
   */
  openSettings?: (windowId: string, section: string | undefined) => void;
}

/**
 * NAP-CONFIG reference service bundle — `handler` to register with the
 * runtime, `publishValues` for the host app to push updates live to all
 * subscribed napplets.
 */
export interface ConfigService {
  /** Register this with the runtime via `runtime.registerService('config', handler)`. */
  handler: ServiceHandler;

  /**
   * Broadcast a new values snapshot to every napplet with an active
   * `config.subscribe`. Each subscriber receives a `config.values` envelope
   * with no `id` (push form per wire spec — absence of `id` distinguishes
   * push from correlated `config.get` response).
   *
   * @param values - The new configuration snapshot (full object, not a diff)
   */
  publishValues(values: ConfigValues): void;
}

/**
 * Minimal JSON Schema validator covering the NAP-CONFIG Core Subset:
 * type: object / string / number / boolean / array, required[], default, properties.
 *
 * Explicitly rejects: $ref, pattern, oneOf/anyOf/allOf/not, if/then/else.
 * Returns { ok: true } on shape sanity, otherwise an error code per the
 * canonical ConfigSchemaErrorCode union.
 *
 * Host apps that need strict draft-07 conformance should supply a custom
 * `registerSchema` callback backed by ajv@8.
 */
function validateCoreSubset(schema: unknown): ConfigSchemaValidation {
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
    return { ok: false, code: 'invalid-schema', error: 'schema root must be an object' };
  }
  const s = schema as Record<string, unknown>;

  // Reject forbidden keywords (NAP-CONFIG Core Subset limits per spec).
  if ('$ref' in s) {
    return { ok: false, code: 'ref-not-allowed', error: '$ref is not permitted in the Core Subset' };
  }
  if ('pattern' in s) {
    return {
      ok: false,
      code: 'pattern-not-allowed',
      error: 'pattern is not permitted in the Core Subset',
    };
  }
  if ('oneOf' in s || 'anyOf' in s || 'allOf' in s || 'not' in s) {
    return {
      ok: false,
      code: 'invalid-schema',
      error: 'oneOf/anyOf/allOf/not are not permitted in the Core Subset',
    };
  }
  if ('if' in s || 'then' in s || 'else' in s) {
    return {
      ok: false,
      code: 'invalid-schema',
      error: 'if/then/else are not permitted in the Core Subset',
    };
  }
  if (s.type !== 'object') {
    return { ok: false, code: 'invalid-schema', error: 'schema root must have type: "object"' };
  }

  // Shallow properties check: each declared property must use a supported type.
  const props = s.properties;
  if (props !== undefined && (typeof props !== 'object' || props === null)) {
    return { ok: false, code: 'invalid-schema', error: 'properties must be an object' };
  }
  if (props) {
    for (const [key, val] of Object.entries(props as Record<string, unknown>)) {
      if (typeof val !== 'object' || val === null) {
        return {
          ok: false,
          code: 'invalid-schema',
          error: `property "${key}" must be an object schema`,
        };
      }
      const pv = val as Record<string, unknown>;
      const ALLOWED_TYPES = new Set(['string', 'number', 'boolean', 'array', 'object']);
      if (pv.type !== undefined && !ALLOWED_TYPES.has(pv.type as string)) {
        return {
          ok: false,
          code: 'invalid-schema',
          error: `property "${key}" must have type: string|number|boolean|array|object`,
        };
      }
    }
  }

  return { ok: true };
}

/**
 * Create a NAP-CONFIG reference service.
 *
 * Shell-writes, napplet-reads. Handles the full `@napplet/nap/config` wire
 * protocol: `config.get` (correlated snapshot), `config.subscribe` /
 * `config.unsubscribe` (live push stream), `config.registerSchema` (optional
 * schema registration + Core Subset validation), `config.openSettings`
 * (optional UI deep-link, fire-and-forget).
 *
 * Returns a `ConfigService` bundle: `{ handler, publishValues }`.
 * Register `handler` with the runtime; call `publishValues(newValues)` from
 * the shell whenever config state changes.
 *
 * @param options - Host-supplied implementation hooks (options-as-bridge,
 *   v1.6 Decision 18). `getValues` is required; all other fields are optional.
 * @returns A ConfigService bundle.
 *
 * @see ConfigServiceOptions for the options shape.
 * @see packages/services/src/theme-service.ts for the sibling pattern.
 * @see SCOPE BOUNDARY comment at the top of this file re: NAP-STORAGE separation.
 *
 * @example
 * ```ts
 * import { createConfigService } from '@kehto/services';
 *
 * const config = createConfigService({
 *   getValues: () => ({ theme: 'dark', density: 'compact' }),
 *   openSettings: (windowId, section) => openSettingsUI(section),
 * });
 * runtime.registerService('config', config.handler);
 *
 * // Push a live update to all subscribers:
 * config.publishValues({ theme: 'light', density: 'compact' });
 * ```
 */
export function createConfigService(options: ConfigServiceOptions): ConfigService {
  /**
   * Per-window subscriber set. Maps windowId → the send callback captured at
   * `config.subscribe` time. `publishValues` fans out to every entry.
   */
  const subscribers = new Map<string, (msg: NappletMessage) => void>();

  const descriptor: ServiceDescriptor = {
    name: 'config',
    version: CONFIG_SERVICE_VERSION,
    description: 'NAP-CONFIG reference service — shell-writes, napplet-reads configuration',
  };

  const handler: ServiceHandler = {
    descriptor,

    handleMessage(
      windowId: string,
      message: NappletMessage,
      send: (msg: NappletMessage) => void,
    ): void {
      switch (message.type) {
        case 'config.get': {
          const m = message as ConfigGetMessage;
          const reply: ConfigValuesMessage = {
            type: 'config.values',
            id: m.id,
            values: options.getValues(),
          };
          send(reply as NappletMessage);
          return;
        }

        case 'config.subscribe': {
          // Capture the send callback so publishValues can fan pushes out.
          subscribers.set(windowId, send);
          // Immediate initial snapshot push — no `id` (push form per wire spec).
          const push: ConfigValuesMessage = {
            type: 'config.values',
            values: options.getValues(),
          };
          send(push as NappletMessage);
          options.onSubscribe?.(windowId);
          return;
        }

        case 'config.unsubscribe': {
          subscribers.delete(windowId);
          options.onUnsubscribe?.(windowId);
          return;
        }

        case 'config.registerSchema': {
          const m = message as ConfigRegisterSchemaMessage;
          // Delegate to host-supplied validator if present; otherwise use
          // the built-in Core Subset hand-coded validator (D12).
          const validation: ConfigSchemaValidation = options.registerSchema
            ? options.registerSchema(windowId, m.schema, m.version)
            : validateCoreSubset(m.schema);

          const result: ConfigRegisterSchemaResultMessage = validation.ok
            ? { type: 'config.registerSchema.result', id: m.id, ok: true }
            : {
                type: 'config.registerSchema.result',
                id: m.id,
                ok: false,
                code: validation.code,
                error: validation.error,
              };
          send(result as NappletMessage);
          return;
        }

        case 'config.openSettings': {
          const m = message as ConfigOpenSettingsMessage;
          // Silently dropped if openSettings hook not provided (D10).
          options.openSettings?.(windowId, m.section);
          return;
        }

        default:
          // Unknown config.* message — silently ignored per NIP-5D.
          return;
      }
    },

    onWindowDestroyed(windowId: string): void {
      // A napplet iframe was destroyed — drop any active subscription so we
      // don't retain the stale send callback in the subscribers map.
      subscribers.delete(windowId);
    },
  };

  /**
   * Broadcast a new config values snapshot to every subscribed napplet.
   * Each subscriber receives a `config.values` push envelope (no `id` —
   * absence of `id` distinguishes a push from a correlated `config.get`
   * response per the NAP-CONFIG wire spec).
   */
  function publishValues(values: ConfigValues): void {
    const envelope: ConfigValuesMessage = {
      type: 'config.values',
      values,
    };
    for (const send of subscribers.values()) {
      try {
        send(envelope as NappletMessage);
      } catch {
        // Subscriber's send callback threw (e.g., iframe gone without
        // onWindowDestroyed firing yet). Best-effort — drop silently.
      }
    }
  }

  return { handler, publishValues };
}
