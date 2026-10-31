/**
 * Shell-level declarations for experimental (out-of-tree) NAP domains.
 *
 * Spec gap: napplet/naps master `43cb3a4` defines discovery as presence of an
 * injected `window.napplet.<domain>` (projections/web.md) and lists domains in
 * its registry, but defines no experimental naming, extension capabilities, or
 * host-facing "unconfigured" state. Kehto's bounded policy: experimental
 * domains use the `x-` prefix, capabilities are `x-<domain>:<action>`, and a
 * declaration can never shadow, alias or override a registry or in-tree domain.
 *
 * @module
 */

import {
  isExtensionDomain,
  validateExtensionCapability,
  validateExtensionDomain,
  type ExtensionCapability,
} from '@kehto/acl';
import type { NappletMessage } from '@napplet/core';
import type { ServiceHandler } from '@kehto/runtime';

/** Host-facing state an extension reports, matching {@link ShellDomainState}. */
export type ShellExtensionState = 'supported' | 'unconfigured' | 'disabled';

/** One experimental capability an extension declares for ACL panels and consent. */
export interface ShellExtensionCapability {
  /** Own-domain capability, `x-<domain>:<action>`. */
  readonly capability: ExtensionCapability;
  /** Short human label for ACL panels. */
  readonly label?: string;
  /** What granting this capability lets a napplet do. */
  readonly description?: string;
}

/**
 * Helpers handed to an extension binding inside the iframe prelude. Every
 * helper is scoped to the extension's own domain: `action` names become
 * `<domain>.<action>` wire types.
 */
export interface ShellExtensionBindingKit {
  /** The extension's own bare domain. */
  readonly domain: string;
  /**
   * Send `<domain>.<action>` with a fresh `id` and resolve with the matching
   * `<domain>.<action>.result` fields (without `type` and `id`).
   */
  request(action: string, payload?: Record<string, unknown>, options?: { readonly timeoutMs?: number }): Promise<Record<string, unknown>>;
  /** Fire-and-forget `<domain>.<action>`. */
  send(action: string, payload?: Record<string, unknown>): void;
  /** Listen for parent-sent `<domain>.<event>` pushes; returns an unsubscribe function. */
  on(event: string, callback: (message: Record<string, unknown>) => void): () => void;
}

/**
 * A self-contained binding factory. It is serialized with `Function.prototype.toString`
 * and evaluated inside the prelude, so it must not close over module variables.
 */
export type ShellExtensionBindingFactory = (kit: ShellExtensionBindingKit) => Record<string, unknown>;

/** Binding for `window.napplet.<domain>`: a factory, or vetted factory source text. */
export type ShellExtensionBinding = ShellExtensionBindingFactory | { readonly source: string };

/**
 * Declaration of one experimental NAP hosted by a Kehto shell.
 *
 * @example
 * ```ts
 * const echo: ShellExtension = {
 *   domain: 'x-echo',
 *   service: echoService,
 *   capabilities: [{ capability: 'x-echo:send', label: 'Echo' }],
 *   binding: (kit) => ({ say: (text: string) => kit.request('say', { text }) }),
 *   state: () => (prefix ? 'supported' : 'unconfigured'),
 * };
 * ```
 */
export interface ShellExtension {
  /** Bare `x-` domain, e.g. `x-echo`. */
  readonly domain: string;
  /**
   * Service for the domain. Its descriptor name must equal `domain`, and its
   * `messageCapabilities`/`pushCapabilities` keys must be `<domain>.*` types
   * mapped to `null` or one of `capabilities`.
   */
  readonly service: ServiceHandler;
  /** Experimental capabilities, all `x-<domain>:<action>`. */
  readonly capabilities?: readonly ShellExtensionCapability[];
  /** Pre-execution binding for `window.napplet.<domain>`. Without one, the domain object is `{}`. */
  readonly binding?: ShellExtensionBinding;
  /**
   * Live host-facing state. `disabled` removes the domain from advertisement;
   * `unconfigured` keeps it advertised but flags that setup is needed. Defaults
   * to `supported`.
   */
  readonly state?: () => ShellExtensionState;
}

/** Thrown when a shell extension declaration violates Kehto's extension policy. */
export class ShellExtensionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ShellExtensionError';
  }
}

function checkPolicies(
  domain: string,
  declared: ReadonlySet<string>,
  label: 'messageCapabilities' | 'pushCapabilities',
  policies: Readonly<Record<string, unknown>> | undefined,
): void {
  if (!policies) return;
  for (const [type, capability] of Object.entries(policies)) {
    if (!type.startsWith(`${domain}.`) || type.length <= domain.length + 1) {
      throw new ShellExtensionError(`${domain} ${label} key ${type} must be a ${domain}.<action> type`);
    }
    if (capability === null) continue;
    if (typeof capability !== 'string' || !declared.has(capability)) {
      throw new ShellExtensionError(
        `${domain} ${label}[${type}] must be null or a declared ${domain} capability; borrowing ${String(capability)} is not allowed`,
      );
    }
  }
}

/**
 * Validate one extension declaration and return a frozen copy.
 *
 * @param extension - Declaration to validate.
 * @returns The same declaration, frozen.
 * @throws ShellExtensionError when the domain, capabilities, service or binding violate policy.
 * @example
 * ```ts
 * const echo = defineShellExtension({ domain: 'x-echo', service });
 * defineShellExtension({ domain: 'llm', service }); // throws: reserved NAP domain
 * ```
 */
export function defineShellExtension<T extends ShellExtension>(extension: T): T {
  if (!extension || typeof extension !== 'object') throw new ShellExtensionError('extension must be an object');
  const { domain, service, capabilities = [], binding } = extension;
  const domainProblem = validateExtensionDomain(domain);
  if (domainProblem) throw new ShellExtensionError(domainProblem);
  if (!service || typeof service.handleMessage !== 'function') {
    throw new ShellExtensionError(`${domain} must provide a service with handleMessage()`);
  }
  if (service.descriptor?.name !== domain) {
    throw new ShellExtensionError(`${domain} service descriptor name must be ${domain}`);
  }
  const declared = new Set<string>();
  for (const entry of capabilities) {
    const problem = validateExtensionCapability(entry?.capability, domain);
    if (problem) throw new ShellExtensionError(problem);
    if (declared.has(entry.capability)) throw new ShellExtensionError(`${entry.capability} is declared twice`);
    declared.add(entry.capability);
  }
  checkPolicies(domain, declared, 'messageCapabilities', service.messageCapabilities);
  checkPolicies(domain, declared, 'pushCapabilities', service.pushCapabilities);
  if (binding !== undefined) bindingSource(domain, binding);
  if (extension.state !== undefined && typeof extension.state !== 'function') {
    throw new ShellExtensionError(`${domain} state must be a function`);
  }
  // Snapshot the validated maps on the service the runtime routes against, so
  // they cannot change after validation (the handler's methods are kept as-is).
  const frozenService: ServiceHandler = Object.freeze({
    ...service,
    descriptor: Object.freeze({ ...service.descriptor }),
    ...(service.messageCapabilities ? { messageCapabilities: Object.freeze({ ...service.messageCapabilities }) } : {}),
    ...(service.pushCapabilities ? { pushCapabilities: Object.freeze({ ...service.pushCapabilities }) } : {}),
  });
  return Object.freeze({ ...extension, service: frozenService, capabilities: Object.freeze([...capabilities]) });
}

/**
 * Validate a list of extensions against each other and the host's services.
 *
 * @param extensions - Declarations, typically `ShellAdapter.extensions`.
 * @param services - Host service names that an extension must not override.
 * @returns Frozen validated declarations in order.
 * @throws ShellExtensionError on any invalid or colliding declaration.
 * @example
 * ```ts
 * resolveShellExtensions(hooks.extensions, Object.keys(hooks.services ?? {}));
 * ```
 */
export function resolveShellExtensions(
  extensions: readonly ShellExtension[] | undefined,
  services: readonly string[] = [],
): readonly ShellExtension[] {
  if (!extensions || extensions.length === 0) return EMPTY;
  const cached = validated.get(extensions);
  // Re-validate when the array was mutated after its first use.
  if (cached && cached.services === services.join('\n') && cached.source.length === extensions.length
    && cached.source.every((entry, index) => entry === extensions[index])) return cached.list;
  const seen = new Set<string>();
  const list = extensions.map((extension) => {
    const valid = defineShellExtension(extension);
    if (seen.has(valid.domain)) throw new ShellExtensionError(`${valid.domain} is declared twice`);
    if (services.includes(valid.domain)) {
      throw new ShellExtensionError(`${valid.domain} is already registered in ShellAdapter.services; an extension cannot override it`);
    }
    seen.add(valid.domain);
    return valid;
  });
  const frozen = Object.freeze(list);
  validated.set(extensions, { services: services.join('\n'), source: [...extensions], list: frozen });
  return frozen;
}

const EMPTY: readonly ShellExtension[] = Object.freeze([]);
const validated = new WeakMap<readonly ShellExtension[], {
  services: string;
  source: readonly ShellExtension[];
  list: readonly ShellExtension[];
}>();

/**
 * Read an extension's live state, treating a throwing state hook as disabled.
 *
 * @param extension - Validated declaration.
 * @returns The live host-facing state.
 * @example
 * ```ts
 * readShellExtensionState(echo); // 'unconfigured'
 * ```
 */
export function readShellExtensionState(extension: ShellExtension): ShellExtensionState {
  try {
    if (!extension.state) return 'supported';
    const state: unknown = extension.state();
    // Fail closed: anything other than the three known states disables the domain.
    return state === 'supported' || state === 'unconfigured' ? state : 'disabled';
  } catch {
    return 'disabled';
  }
}

/**
 * Produce the serialized binding source for one extension.
 *
 * @param domain - Extension domain (for error messages).
 * @param binding - Factory function or `{ source }`.
 * @returns Function-expression source safe to embed in the prelude script.
 * @throws ShellExtensionError for sources that could escape the prelude script element.
 * @example
 * ```ts
 * bindingSource('x-echo', (kit) => ({ ping: () => kit.request('ping') }));
 * ```
 */
export function bindingSource(domain: string, binding: ShellExtensionBinding): string {
  const raw = typeof binding === 'function' ? binding.toString() : binding?.source;
  if (typeof raw !== 'string' || raw.trim().length === 0) {
    throw new ShellExtensionError(`${domain} binding must be a function or { source: string }`);
  }
  if (/\{\s*\[native code\]\s*\}/.test(raw)) {
    throw new ShellExtensionError(`${domain} binding must be self-contained source; bound or native functions cannot be serialized`);
  }
  // Each binding renders in its own script element, so a syntax error here can
  // only cost this extension its binding, never the namespace prelude.
  const source = asFunctionExpression(raw.trim());
  if (/<\/script|<!--|<script/i.test(source)) {
    throw new ShellExtensionError(`${domain} binding source must not contain script or comment markup`);
  }
  return source;
}

// `binding(kit) { … }` (method shorthand) serializes without the `function`
// keyword; make it a function expression so it parses inside the prelude.
function asFunctionExpression(source: string): string {
  if (/^(async\s+)?function\b/.test(source) || /^(async\s*)?\(/.test(source)
    || /^(async\s+)?[A-Za-z_$][\w$]*\s*=>/.test(source)) return source;
  const method = source.match(/^(async\s+)?([A-Za-z_$][\w$]*)\s*\(/);
  return method ? `${method[1] ?? ''}function ${source.slice((method[1] ?? '').length)}` : source;
}

/**
 * Collect the binding sources for the extension domains exposed to one frame.
 * Pass the result as `extensions` to `injectNappletNamespacePrelude` or
 * `prepareNappletSrcdoc`, together with the frame's exposed `domains`.
 *
 * @param extensions - Validated declarations (or raw `ShellAdapter.extensions`).
 * @param domains - Domains exposed to the frame (its environment).
 * @returns Domain → binding map for exposed extensions with bindings.
 * @example
 * ```ts
 * const env = resolveShellEnvironment(hooks, identity);
 * const srcdoc = prepareNappletSrcdoc(html, {
 *   domains: env.capabilities.domains,
 *   extensions: getShellExtensionBindings(hooks.extensions, env.capabilities.domains),
 * });
 * ```
 */
export function getShellExtensionBindings(
  extensions: readonly ShellExtension[] | undefined,
  domains: readonly string[],
): Readonly<Record<string, ShellExtensionBinding>> {
  const exposed = new Set(domains);
  const result: Record<string, ShellExtensionBinding> = {};
  for (const extension of resolveShellExtensions(extensions)) {
    if (extension.binding && exposed.has(extension.domain)) result[extension.domain] = extension.binding;
  }
  return Object.freeze(result);
}

/**
 * Collect every capability declared by a set of extensions (for ACL panels).
 *
 * @param extensions - Declarations.
 * @returns Flat frozen list of declared capabilities with their domain.
 * @example
 * ```ts
 * listShellExtensionCapabilities(hooks.extensions); // [{ domain: 'x-echo', capability: 'x-echo:send', … }]
 * ```
 */
export function listShellExtensionCapabilities(
  extensions: readonly ShellExtension[] | undefined,
): readonly (ShellExtensionCapability & { readonly domain: string })[] {
  return Object.freeze(resolveShellExtensions(extensions).flatMap((extension) =>
    (extension.capabilities ?? []).map((entry) => Object.freeze({ ...entry, domain: extension.domain }))));
}

/**
 * Test whether a message belongs to an `x-` extension domain.
 *
 * @param message - Envelope or candidate object with a `type`.
 * @returns `true` when the type's domain is an acceptable `x-` domain.
 * @example
 * ```ts
 * isExtensionMessageType({ type: 'x-echo.say' }); // true
 * ```
 */
export function isExtensionMessageType(message: NappletMessage | { type?: unknown }): boolean {
  if (typeof message?.type !== 'string') return false;
  const dot = message.type.indexOf('.');
  return dot > 0 && isExtensionDomain(message.type.slice(0, dot));
}
