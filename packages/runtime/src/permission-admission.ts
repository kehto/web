import { permissionPrincipalKey } from '@kehto/firewall';
import type { PermissionRequirement } from '@kehto/firewall';
import type { ApprovalFailure, ApprovalOutcome } from './approval-coordinator.js';
import type { SessionEntry } from './types.js';

/** Host-attested available domains and manifest-declared interface requests. */
export interface PermissionAdmissionRequest {
  readonly available: readonly string[];
  readonly required: readonly string[];
  readonly optional: readonly string[];
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
  stillGranted(windowId: string, domains: readonly string[]): boolean;
  run(windowId: string, requirements: readonly PermissionRequirement[], current: () => boolean): Promise<ApprovalOutcome<void>>;
}

/** Internal admission coordinator; hosts remain responsible for verified bytes. */
export function createPermissionAdmission(options: AdmissionContext) {
  const admissions = new WeakMap<PermissionAdmission, { windowId: string; entry: SessionEntry; revision: number }>();
  async function admit(windowId: string, request: PermissionAdmissionRequest): Promise<PermissionAdmission> {
    const result = (status: PermissionAdmission['status'], domains: readonly string[] = [], deniedRequired: readonly string[] = []): PermissionAdmission =>
      Object.freeze({ status, domains: Object.freeze([...domains]), deniedRequired: Object.freeze([...deniedRequired]) });
    const entry = options.getSession(windowId);
    if (entry && options.isRetired(entry)) return result('cancelled');
    if (!entry?.permissionPrincipal || !options.available()) return result('unavailable');
    let available: Set<string>;
    let required: string[];
    let optional: string[];
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
    } catch { return result('denied'); }
    const missing = required.filter((domain) => !available.has(domain));
    if (missing.length) return result('denied', [], missing);
    const current = () => options.getSession(windowId) === entry && !options.isRetired(entry) && options.available();
    const granted: string[] = [];
    if (required.length) {
      const decision = await options.run(windowId, interfaceRequirements(required), current);
      if (decision.status !== 'executed') return result(decision.status, [], required);
      granted.push(...required);
    }
    for (const domain of optional) {
      if (!current()) return result('cancelled');
      const decision = await options.run(windowId, interfaceRequirements([domain]), current);
      if (decision.status === 'cancelled') return result('cancelled');
      if (decision.status === 'executed') granted.push(domain);
    }
    if (!current() || !options.allowed(windowId, interfaceRequirements(granted))) return result('cancelled');
    if (granted.length && !options.stillGranted(windowId, granted)) return result('cancelled');
    const admission = result('admitted', granted);
    admissions.set(admission, { windowId, entry, revision: options.revision() });
    return admission;
  }

  return { admit,
    isAdmissionCurrent(windowId: string, admission: PermissionAdmission): boolean {
      const issued = admissions.get(admission);
      return !!issued && options.available() && issued.windowId === windowId
        && !options.isRetired(issued.entry)
        && issued.revision === options.revision() && options.getSession(windowId) === issued.entry
        && options.allowed(windowId, interfaceRequirements(admission.domains))
        && (admission.domains.length === 0 || options.stillGranted(windowId, admission.domains));
    },
  };
}
