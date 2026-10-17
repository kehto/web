import { normalizeRequirement, permissionPrincipalKey } from '@kehto/firewall';
import type { PermissionRequirement } from '@kehto/firewall';
import type { ApprovalFailure, ApprovalOutcome } from './approval-coordinator.js';
import type { SessionEntry } from './types.js';

/** Host-attested available domains and manifest-declared interface requests. */
export interface PermissionAdmissionRequest {
  readonly available: readonly string[];
  readonly required: readonly string[];
  readonly optional: readonly string[];
  /** Exact, normalized non-interface authorities needed by the document itself. */
  readonly launchRequirements?: readonly PermissionRequirement[];
}

/** Only an admitted result may be used to inject namespaces and execute an app. */
export interface PermissionAdmission {
  readonly status: 'admitted' | ApprovalFailure;
  readonly domains: readonly string[];
  readonly deniedRequired: readonly string[];
}

/** Internal conversion from bare domain declarations to policy requirements. */
export function interfaceRequirements(domains: readonly string[]): PermissionRequirement[] {
  return domains.map((domain) => ({ category: 'interface', domain, operation: 'access', scope: { kind: 'exact', value: domain } }));
}

interface AdmissionContext {
  getSession(windowId: string): SessionEntry | undefined;
  available(): boolean;
  isRetired(entry: SessionEntry): boolean;
  revision(): number;
  allowed(windowId: string, requirements: readonly PermissionRequirement[]): boolean;
  stillGranted(windowId: string, requirements: readonly PermissionRequirement[]): boolean;
  run(windowId: string, requirements: readonly PermissionRequirement[], current: () => boolean): Promise<ApprovalOutcome<void>>;
  readonly extensions?: readonly `extension:${string}`[];
}

/** Internal admission coordinator; hosts remain responsible for verified bytes. */
export function createPermissionAdmission(options: AdmissionContext) {
  const admissions = new WeakMap<PermissionAdmission, { windowId: string; entry: SessionEntry; revision: number; requirements: readonly PermissionRequirement[] }>();
  async function admit(windowId: string, request: PermissionAdmissionRequest): Promise<PermissionAdmission> {
    const result = (status: PermissionAdmission['status'], domains: readonly string[] = [], deniedRequired: readonly string[] = []): PermissionAdmission =>
      Object.freeze({ status, domains: Object.freeze([...domains]), deniedRequired: Object.freeze([...deniedRequired]) });
    const entry = options.getSession(windowId);
    if (entry && options.isRetired(entry)) return result('cancelled');
    if (!entry?.permissionPrincipal || !options.available()) return result('unavailable');
    let available: Set<string>;
    let required: string[];
    let optional: string[];
    let launchRequirements: PermissionRequirement[];
    try {
      permissionPrincipalKey(entry.permissionPrincipal);
      if (entry.aggregateHash !== entry.permissionPrincipal.artifactHash) return result('denied');
      for (const domains of [request.available, request.required, request.optional]) {
        if (!Array.isArray(domains) || domains.length > 128 || domains.some((domain) => typeof domain !== 'string' || !/^[a-z][a-z0-9-]*$/.test(domain))) {
          return result('denied');
        }
      }
      available = new Set(request.available);
      required = [...new Set(request.required)];
      optional = [...new Set(request.optional)].filter((domain) => !required.includes(domain) && available.has(domain));
      if (request.launchRequirements !== undefined && (!Array.isArray(request.launchRequirements) || request.launchRequirements.length > 128)) return result('denied');
      launchRequirements = (request.launchRequirements ?? []).map((requirement) => {
        const normalized = normalizeRequirement(requirement, { extensions: options.extensions });
        if (normalized.category === 'interface') throw new TypeError('Launch requirements cannot declare interfaces');
        return normalized;
      });
    } catch { return result('denied'); }
    const missing = required.filter((domain) => !available.has(domain));
    if (missing.length) return result('denied', [], missing);
    const current = () => options.getSession(windowId) === entry && !options.isRetired(entry) && options.available();
    const granted: string[] = [];
    const requiredRequirements = [...interfaceRequirements(required), ...launchRequirements];
    if (requiredRequirements.length) {
      const decision = await options.run(windowId, requiredRequirements, current);
      if (decision.status !== 'executed') return result(decision.status, [], required);
      granted.push(...required);
    }
    for (const domain of optional) {
      if (!current()) return result('cancelled');
      const decision = await options.run(windowId, interfaceRequirements([domain]), current);
      if (decision.status === 'cancelled') return result('cancelled');
      if (decision.status === 'executed') granted.push(domain);
    }
    const admittedRequirements = [...interfaceRequirements(granted), ...launchRequirements];
    if (!current() || !options.allowed(windowId, admittedRequirements)) return result('cancelled');
    if (admittedRequirements.length && !options.stillGranted(windowId, admittedRequirements)) return result('cancelled');
    const admission = result('admitted', granted);
    admissions.set(admission, { windowId, entry, revision: options.revision(), requirements: admittedRequirements });
    return admission;
  }

  return { admit,
    isAdmissionCurrent(windowId: string, admission: PermissionAdmission): boolean {
      const issued = admissions.get(admission);
      return !!issued && options.available() && issued.windowId === windowId
        && !options.isRetired(issued.entry)
        && issued.revision === options.revision() && options.getSession(windowId) === issued.entry
        && options.allowed(windowId, issued.requirements)
        && (issued.requirements.length === 0 || options.stillGranted(windowId, issued.requirements));
    },
  };
}
