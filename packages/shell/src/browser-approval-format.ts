import { DEFAULT_RULE_GRANT_PREFIX, permissionRuleSubject } from '@kehto/runtime';
import type {
  PermissionGrant, PermissionPrincipal, PermissionRequirement, PermissionRuleAction, PermissionRuleTarget,
} from '@kehto/runtime';

type Lifetime = PermissionGrant['lifetime'];

/** Wording for each grant lifetime, shared by the prompt and the grant list. */
export const LIFETIME_LABELS: Readonly<Record<Lifetime, string>> = Object.freeze({
  once: 'Just this once',
  session: 'Until it closes',
  persistent: 'Always',
});

/** Wording for each default-rule action. */
export const RULE_ACTION_LABELS: Readonly<Record<PermissionRuleAction, string>> = Object.freeze({
  allow: 'Allow',
  ask: 'Ask every time',
  deny: 'Block',
});

const OPERATION_LABELS: Readonly<Record<string, string>> = Object.freeze({
  'link.open': 'Open link',
  'keys.registerAction': 'Register shortcut',
  'resource.bytes': 'Fetch',
  'upload.upload': 'Upload to',
  'intent.invoke': 'Invoke intent',
  'serial.open': 'Open serial port',
  'serial.write': 'Write to serial port',
  'webrtc.open': 'Open peer connection',
});

const PROMPT_TITLES: Readonly<Record<string, string>> = Object.freeze({
  'link.open': 'Open an external link?',
  'upload.upload': 'Upload a file?',
  'intent.invoke': 'Hand off to another napplet?',
});

/** Technical identity shown in full, alongside a host-provided app label. */
export function principalIdentity(principal: PermissionPrincipal): string {
  return principal.kind === 'verified'
    ? `Verified manifest ${principal.manifestKey}; artifact SHA-256 ${principal.artifactHash}`
    : `Development target ${principal.target}; artifact SHA-256 ${principal.artifactHash}`;
}

function shorten(value: string, head = 8, tail = 6): string {
  return value.length > head + tail + 1 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;
}

/** One-line identity for dense lists; the full form stays available on demand. */
export function principalSummary(principal: PermissionPrincipal): string {
  const artifact = `artifact ${shorten(principal.artifactHash)}`;
  if (principal.kind === 'development') return `${principal.target} · ${artifact}`;
  const parts = principal.manifestKey.split(':');
  const manifest = parts.length >= 3 ? `${parts[1]}:${shorten(parts[2])}${parts.length > 3 ? `:${parts.slice(3).join(':')}` : ''}` : principal.manifestKey;
  return `${manifest} · ${artifact}`;
}

/** A requirement as a short action plus the exact target it applies to. */
export interface RequirementText {
  readonly action: string;
  readonly target?: string;
}

/**
 * Describe one requirement in plain words. The exact scope is always kept:
 * shortening it would hide what is being approved.
 */
export function describeRequirement(requirement: PermissionRequirement): RequirementText {
  if (requirement.category === 'interface') return { action: `Use the ${requirement.domain} interface` };
  const value = requirement.scope.value;
  if (requirement.category === 'network' && requirement.operation.startsWith('network.')) {
    return { action: `Connect directly (${requirement.operation.slice('network.'.length)})`, target: value };
  }
  const action = OPERATION_LABELS[requirement.operation] ?? requirement.operation;
  if (requirement.category === 'network') return { action: `${action} — contact origin`, target: value };
  if (requirement.scope.kind === 'directory') return { action: `${action} — folder`, target: value };
  const prefix = `${requirement.domain}:`;
  return { action, target: value.startsWith(prefix) ? value.slice(prefix.length).replace(':', ' ') : value };
}

function distinct<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}

const DIRECT = 'network.';

/**
 * Describe every scope of a request. Direct browser sources to one origin are
 * merged into a single row naming each directive, so a development target
 * does not show the same origin once per directive.
 */
export function describeRequirements(missing: readonly PermissionRequirement[]): RequirementText[] {
  const rows: RequirementText[] = [];
  const direct = new Map<string, string[]>();
  for (const item of missing) {
    if (item.category !== 'network' || !item.operation.startsWith(DIRECT)) { rows.push(describeRequirement(item)); continue; }
    const directives = direct.get(item.scope.value);
    if (directives) directives.push(item.operation.slice(DIRECT.length));
    else direct.set(item.scope.value, [item.operation.slice(DIRECT.length)]);
  }
  return [...rows, ...[...direct].map(([target, directives]) => ({ action: `Connect directly (${distinct(directives).join(', ')})`, target }))];
}

/** The question a prompt asks, derived only from the exact scopes shown. */
export function promptTitle(missing: readonly PermissionRequirement[]): string {
  const operations = distinct(missing.filter((item) => item.category !== 'interface').map((item) => item.operation));
  if (operations.length && operations.every((operation) => operation.startsWith(DIRECT))) return 'Allow direct network access?';
  if (operations.length === 1) return PROMPT_TITLES[operations[0]] ?? `Allow ${operations[0]}?`;
  if (operations.length > 1) return `Allow ${operations.length} operations?`;
  const domains = distinct(missing.map((item) => item.domain));
  return domains.length === 1 ? `Allow access to ${domains[0]}?` : `Allow access to ${domains.length} interfaces?`;
}

/**
 * The single rule that would cover every scope in a prompt, if there is one:
 * one operation, or else one interface. Mixed prompts have no such rule.
 */
export function ruleTargetFor(missing: readonly PermissionRequirement[]): Pick<PermissionRuleTarget, 'domain' | 'operation'> | undefined {
  const domains = distinct(missing.map((item) => item.domain));
  if (domains.length !== 1) return undefined;
  const operations = distinct(missing.filter((item) => item.category !== 'interface').map((item) => item.operation));
  if (operations.length === 1 && missing.every((item) => item.category !== 'interface')) return { operation: operations[0] };
  return { domain: domains[0] };
}

/** Whether a host default rule, not an answered prompt, created this grant. */
export function isRuleGrant(grant: PermissionGrant): boolean {
  return grant.id.startsWith(DEFAULT_RULE_GRANT_PREFIX);
}

/** Grants of one napplet version: answered decisions by domain, plus rule grants. */
export interface GrantGroup {
  readonly key: string;
  readonly principal: PermissionPrincipal;
  readonly decided: ReadonlyArray<{ readonly domain: string; readonly grants: readonly PermissionGrant[] }>;
  readonly byRule: readonly PermissionGrant[];
}

/** Group a flat grant list by napplet and domain, keeping first-seen order. */
export function groupGrants(grants: readonly PermissionGrant[]): GrantGroup[] {
  const groups = new Map<string, { principal: PermissionPrincipal; decided: Map<string, PermissionGrant[]>; byRule: PermissionGrant[] }>();
  for (const grant of grants) {
    const key = `${permissionRuleSubject(grant.principal)}#${grant.principal.artifactHash}`;
    let group = groups.get(key);
    if (!group) groups.set(key, group = { principal: grant.principal, decided: new Map(), byRule: [] });
    if (isRuleGrant(grant)) { group.byRule.push(grant); continue; }
    const domain = group.decided.get(grant.permission.domain);
    if (domain) domain.push(grant);
    else group.decided.set(grant.permission.domain, [grant]);
  }
  return [...groups].map(([key, group]) => ({
    key, principal: group.principal, byRule: group.byRule,
    decided: [...group.decided].map(([domain, list]) => ({ domain, grants: list })),
  }));
}

/** Parse what a user typed into a rule target: `link` or `link.open`. */
export function parseCapability(text: string): Pick<PermissionRuleTarget, 'domain' | 'operation'> | undefined {
  const value = text.trim();
  if (/^[a-z][a-z0-9-]*$/.test(value)) return { domain: value };
  if (/^[a-z][a-z0-9-]*\.[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)) return { operation: value };
  return undefined;
}
