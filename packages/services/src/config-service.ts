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
 * Host integration: provide `getValues(windowId)` and `saveValues(windowId,
 * values)` backed by storage scoped to the source window's napplet identity.
 * The service validates and defaults every snapshot before delivery.
 *
 * Provide `openSettings` to render the shell-owned settings UI. Optional
 * hooks may add host policy around schema acceptance and lifecycle cleanup.
 *
 * @example
 * ```ts
 * import { createConfigService } from '@kehto/services';
 *
 * const configFixtures = new Map<string, ConfigValues>();
 * const config = createConfigService({
 *   getValues: (windowId) => ({ ...configFixtures.get(windowId) }),
 *   saveValues: (windowId, values) => configFixtures.set(windowId, values),
 * });
 * runtime.registerService('config', config.handler);
 *
 * // Later, when shell-side values change:
 * config.publishValues({ theme: 'light' }, 'window-1');
 * ```
 */

import type { NappletMessage } from '@napplet/core';
// DRIFT-CORE-06 — Phase 11-deviation: ServiceDescriptor dropped from @napplet/core
// v0.2.0+ (napplet phase-81). Re-exported from @kehto/runtime (canonical home after Phase 24 DRIFT-01).
import type { ServiceHandler } from '@kehto/runtime';
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
import {
  configValuesConform,
  resolveConfigValues,
  validateConfigSchema,
  type ConfigSchemaValidation,
} from './config-schema.js';

export { resolveConfigValues, validateConfigSchema } from './config-schema.js';
export type { ConfigSchemaValidation } from './config-schema.js';

/** Config service version — follows semver. */
const CONFIG_SERVICE_VERSION = '1.0.0';

/**
 * Configuration options for `createConfigService` (options-as-bridge
 * per v1.6 Decision 18).
 *
 * @example
 * ```ts
 * const config = createConfigService({
 *   getValues: (windowId) => loadScopedValues(windowId),
 *   saveValues: (windowId, values) => saveScopedValues(windowId, values),
 *   openSettings: (windowId, section, context) => showSettingsPanel(windowId, section, context),
 * });
 * ```
 */
export interface ConfigServiceOptions {
  /**
   * Returns the current configuration values snapshot.
   * Called on every `config.get` and at every `config.subscribe` initial push.
   * Implementations should return a fresh object (not a mutable reference).
   */
  getValues(windowId: string): ConfigValues;

  /** Persist one shell-validated full snapshot after settings UI commit. */
  saveValues?: (windowId: string, values: ConfigValues) => void;

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
   * The reference implementation always runs its complete bounded Core Subset
   * validator first. This hook may add host policy such as version acceptance
   * or durable schema persistence, but cannot weaken protocol validation.
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
   * If omitted, `config.openSettings` is silently dropped. A conformant host
   * must supply this hook before advertising the CONFIG domain.
   */
  openSettings?: (
    windowId: string,
    section: string | undefined,
    context: ConfigSettingsContext,
  ) => void;

  /** Release host-owned transient UI or state for a destroyed window. */
  onWindowDestroyed?: (windowId: string) => void;
}

/** Shell-owned settings state and commit boundary passed to host UI code. */
export interface ConfigSettingsContext {
  /** Accepted schema for this live napplet window. */
  readonly schema: NappletConfigSchema;
  /** Current validated/defaulted values. */
  readonly values: ConfigValues;
  /** Validate, persist, and publish a full settings snapshot. */
  commit(values: ConfigValues): ConfigValues;
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
   * @param windowId - Optional source window scope. Omit only for a host-wide
   *   update that should be independently validated for every subscriber.
   */
  publishValues(values: ConfigValues, windowId?: string): void;

  /** Return the accepted schema for one live window, or null. */
  getSchema(windowId: string): NappletConfigSchema | null;

  /** Return the current validated/defaulted values for one live window, or null. */
  getValues(windowId: string): ConfigValues | null;
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
 *   getValues: (windowId) => loadScopedValues(windowId),
 *   saveValues: (windowId, values) => saveScopedValues(windowId, values),
 *   openSettings: (windowId, section, context) => openSettingsUI(section, context),
 * });
 * runtime.registerService('config', config.handler);
 *
 * // Push one externally-originated scoped update:
 * config.publishValues({ theme: 'light', density: 'compact' }, 'window-1');
 * ```
 */
export function createConfigService(options: ConfigServiceOptions): ConfigService {
  return new ConfigServiceController(options);
}

interface RegisteredConfigSchema {
  readonly schema: NappletConfigSchema;
  readonly version?: number;
}

class ConfigServiceController implements ConfigService {
  private readonly subscribers = new Map<string, (message: NappletMessage) => void>();
  private readonly schemas = new Map<string, RegisteredConfigSchema>();
  readonly handler: ServiceHandler;

  constructor(private readonly options: ConfigServiceOptions) {
    this.handler = {
      descriptor: {
        name: 'config',
        version: CONFIG_SERVICE_VERSION,
        description: 'NAP-CONFIG reference service — shell-writes, napplet-reads configuration',
      },
      handleMessage: (windowId, message, send) => this.handleMessage(windowId, message, send),
      onWindowDestroyed: (windowId) => this.destroyWindow(windowId),
    };
  }

  getSchema(windowId: string): NappletConfigSchema | null {
    const schema = this.schemas.get(windowId)?.schema;
    return schema ? structuredClone(schema) : null;
  }

  getValues(windowId: string): ConfigValues | null {
    const schema = this.schemas.get(windowId)?.schema;
    if (!schema) return null;
    const values = resolveConfigValues(schema, this.options.getValues(windowId));
    return configValuesConform(schema as Record<string, unknown>, values) ? values : null;
  }

  publishValues(values: ConfigValues, windowId?: string): void {
    if (windowId) {
      this.publishWindowValues(windowId, values);
      return;
    }
    for (const target of this.subscribers.keys()) this.publishWindowValues(target, values);
  }

  private handleMessage(
    windowId: string,
    message: NappletMessage,
    send: (message: NappletMessage) => void,
  ): void {
    switch (message.type) {
      case 'config.get':
        this.handleGet(windowId, message as ConfigGetMessage, send);
        return;
      case 'config.subscribe':
        this.handleSubscribe(windowId, send);
        return;
      case 'config.unsubscribe':
        this.subscribers.delete(windowId);
        this.options.onUnsubscribe?.(windowId);
        return;
      case 'config.registerSchema':
        this.handleRegisterSchema(windowId, message as ConfigRegisterSchemaMessage, send);
        return;
      case 'config.openSettings':
        this.handleOpenSettings(windowId, message as ConfigOpenSettingsMessage, send);
        return;
      default:
        return;
    }
  }

  private handleGet(
    windowId: string,
    message: ConfigGetMessage,
    send: (message: NappletMessage) => void,
  ): void {
    const values = this.readValues(windowId, send);
    if (values === undefined) return;
    if (!values) {
      this.sendValuesUnavailable(send, windowId);
      return;
    }
    const reply: ConfigValuesMessage = {
      type: 'config.values',
      id: message.id,
      values,
    };
    send(reply as NappletMessage);
  }

  private handleSubscribe(
    windowId: string,
    send: (message: NappletMessage) => void,
  ): void {
    this.subscribers.set(windowId, send);
    const values = this.readValues(windowId, send);
    if (values === undefined) return;
    if (!values) {
      this.sendValuesUnavailable(send, windowId);
      return;
    }
    send({ type: 'config.values', values } as NappletMessage);
    this.options.onSubscribe?.(windowId);
  }

  private handleRegisterSchema(
    windowId: string,
    message: ConfigRegisterSchemaMessage,
    send: (message: NappletMessage) => void,
  ): void {
    const nextVersion = message.version ?? readSchemaVersion(message.schema);
    let validation = this.validateRegistration(windowId, message, nextVersion);
    if (validation.ok) validation = this.persistRegisteredSchema(windowId, message.schema, nextVersion);
    const result: ConfigRegisterSchemaResultMessage = validation.ok
      ? { type: 'config.registerSchema.result', id: message.id, ok: true }
      : {
          type: 'config.registerSchema.result',
          id: message.id,
          ok: false,
          code: validation.code,
          error: validation.error,
        };
    send(result as NappletMessage);
    if (validation.ok) this.publishWindowValues(windowId);
  }

  private validateRegistration(
    windowId: string,
    message: ConfigRegisterSchemaMessage,
    nextVersion: number | undefined,
  ): ConfigSchemaValidation {
    let validation = validateConfigSchema(message.schema);
    if (validation.ok && message.version !== undefined && (!Number.isSafeInteger(message.version) || message.version < 0)) {
      validation = { ok: false, code: 'invalid-schema', error: 'version must be a non-negative integer' };
    }
    const priorVersion = this.schemas.get(windowId)?.version;
    if (validation.ok && priorVersion !== undefined && nextVersion !== undefined && nextVersion < priorVersion) {
      validation = { ok: false, code: 'version-conflict', error: 'schema version cannot move backwards' };
    }
    if (!validation.ok || !this.options.registerSchema) return validation;
    try {
      return this.options.registerSchema(windowId, message.schema, message.version);
    } catch (cause) {
      return {
        ok: false,
        code: 'invalid-schema',
        error: cause instanceof Error ? cause.message : 'host schema policy failed',
      };
    }
  }

  private persistRegisteredSchema(
    windowId: string,
    schema: NappletConfigSchema,
    version: number | undefined,
  ): ConfigSchemaValidation {
    try {
      const resolved = resolveConfigValues(schema, this.options.getValues(windowId));
      this.options.saveValues?.(windowId, resolved);
      this.schemas.set(windowId, {
        schema: structuredClone(schema),
        ...(version !== undefined ? { version } : {}),
      });
      return { ok: true };
    } catch (cause) {
      return {
        ok: false,
        code: 'invalid-schema',
        error: cause instanceof Error ? cause.message : 'host configuration persistence failed',
      };
    }
  }

  private handleOpenSettings(
    windowId: string,
    message: ConfigOpenSettingsMessage,
    send: (message: NappletMessage) => void,
  ): void {
    const record = this.schemas.get(windowId);
    if (!record) {
      sendSchemaError(send, 'no-schema', 'no configuration schema is registered');
      return;
    }
    let values: ConfigValues;
    try {
      values = resolveConfigValues(record.schema, this.options.getValues(windowId));
    } catch (cause) {
      sendSchemaError(
        send,
        'invalid-schema',
        cause instanceof Error ? cause.message : 'host configuration read failed',
      );
      return;
    }
    const section = message.section && schemaHasSection(record.schema, message.section)
      ? message.section
      : undefined;
    this.options.openSettings?.(windowId, section, {
      schema: structuredClone(record.schema),
      values,
      commit: (next) => this.commitValues(windowId, next),
    });
  }

  private commitValues(windowId: string, values: ConfigValues): ConfigValues {
    const schema = this.schemas.get(windowId)?.schema;
    if (!schema) throw new Error('no configuration schema is registered');
    const resolved = resolveConfigValues(schema, values);
    if (!configValuesConform(schema as Record<string, unknown>, resolved)) {
      throw new Error('required configuration values are missing or invalid');
    }
    this.options.saveValues?.(windowId, resolved);
    this.publishWindowValues(windowId, resolved);
    return resolved;
  }

  private publishWindowValues(windowId: string, supplied?: ConfigValues): void {
    const send = this.subscribers.get(windowId);
    const schema = this.schemas.get(windowId)?.schema;
    if (!send || !schema) return;
    const values = supplied ? resolveConfigValues(schema, supplied) : this.getValues(windowId);
    if (!values || !configValuesConform(schema as Record<string, unknown>, values)) return;
    try {
      send({ type: 'config.values', values } as NappletMessage);
    } catch {
      this.subscribers.delete(windowId);
    }
  }

  private readValues(
    windowId: string,
    send: (message: NappletMessage) => void,
  ): ConfigValues | null | undefined {
    try {
      return this.getValues(windowId);
    } catch (cause) {
      sendSchemaError(
        send,
        'invalid-schema',
        cause instanceof Error ? cause.message : 'host configuration read failed',
      );
      return undefined;
    }
  }

  private sendValuesUnavailable(
    send: (message: NappletMessage) => void,
    windowId: string,
  ): void {
    if (!this.schemas.has(windowId)) {
      sendSchemaError(send, 'no-schema', 'no configuration schema is registered');
      return;
    }
    sendSchemaError(send, 'invalid-schema', 'configuration requires valid values before delivery');
  }

  private destroyWindow(windowId: string): void {
    this.subscribers.delete(windowId);
    this.schemas.delete(windowId);
    this.options.onWindowDestroyed?.(windowId);
  }
}
function sendSchemaError(
  send: (message: NappletMessage) => void,
  code: ConfigSchemaErrorCode,
  error: string,
): void {
  send({ type: 'config.schemaError', code, error } as NappletMessage);
}

function readSchemaVersion(schema: NappletConfigSchema): number | undefined {
  const version = (schema as Record<string, unknown>).$version;
  return Number.isSafeInteger(version) && Number(version) >= 0 ? Number(version) : undefined;
}

function schemaHasSection(schema: NappletConfigSchema, section: string): boolean {
  const properties = (schema as Record<string, unknown>).properties;
  if (!isRecord(properties)) return false;
  for (const child of Object.values(properties)) {
    if (!isRecord(child)) continue;
    if (child['x-napplet-section'] === section) return true;
    if (child.type === 'object' && schemaHasSection(child as NappletConfigSchema, section)) return true;
  }
  return false;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
