import type { PermissionPolicyOptions, PermissionRequirement, PermissionScope } from './permission-types.js';

const DOMAIN = /^[a-z][a-z0-9-]*$/;

/** Internal bounded non-empty text check; diagnostics never echo its value. */
export function permissionText(value: unknown, max = 4096): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= max && !/[\u0000-\u001f\u007f]/.test(value);
}

function virtualPath(value: string): string {
  if (!value.startsWith('/') || value.includes('\\') || value.includes('%') || value.includes('?') || value.includes('#')) {
    throw new TypeError('Permission paths must be canonical absolute virtual paths');
  }
  if (value === '/') return value;
  const segments = value.slice(1).split('/');
  if (segments.some((part) => !part || part === '.' || part === '..')) {
    throw new TypeError('Permission paths must not contain empty or traversal segments');
  }
  return value;
}

/**
 * Normalize a permission scope without changing protocol payload or cache keys.
 * @param scope - Host-selected matching semantics and untrusted requested value.
 * @returns A detached immutable scope, or throws for unsafe matching input.
 * @example normalizePermissionScope({ kind: 'origin', value: 'https://EXAMPLE.com:443' });
 */
export function normalizePermissionScope(scope: PermissionScope): PermissionScope {
  if (!scope || !permissionText(scope.value)) throw new TypeError('Invalid permission scope');
  let value = scope.value;
  if (scope.kind === 'origin') {
    const url = new URL(value);
    if (!['https:', 'http:', 'wss:', 'ws:'].includes(url.protocol) || url.username || url.password
      || url.pathname !== '/' || url.search || url.hash || url.hostname.includes('*')) {
      throw new TypeError('Network scopes must identify a single origin');
    }
    value = url.origin;
  } else if (scope.kind === 'directory') {
    value = virtualPath(value);
  } else if (scope.kind === 'exact') {
    if (value.startsWith('/')) virtualPath(value);
  } else {
    throw new TypeError('Unknown permission scope');
  }
  return Object.freeze({ kind: scope.kind, value });
}

/** Internal normalization shared by grant ingestion and request evaluation. */
export function normalizeRequirement(value: PermissionRequirement, options: PermissionPolicyOptions): PermissionRequirement {
  if (!value || typeof value.domain !== 'string' || !DOMAIN.test(value.domain) || !permissionText(value.operation, 128)) {
    throw new TypeError('Invalid permission operation');
  }
  const scope = normalizePermissionScope(value.scope);
  if (value.category === 'interface') {
    if (value.operation !== 'access' || scope.kind !== 'exact' || scope.value !== value.domain) {
      throw new TypeError('Interface permission must name its domain');
    }
  } else {
    if (!value.operation.startsWith(`${value.domain}.`) || value.operation.length <= value.domain.length + 1) {
      throw new TypeError('Permission operation must belong to its domain');
    }
    if (value.category === 'network') {
      if (scope.kind !== 'origin') throw new TypeError('Network permission requires an origin');
    } else if (value.category === 'resource') {
      if (scope.kind === 'origin') throw new TypeError('Resource permission requires a resource scope');
    } else if (!value.category.startsWith('extension:') || !options.extensions?.includes(value.category) || scope.kind !== 'exact') {
      throw new TypeError('Unknown permission category');
    }
  }
  return Object.freeze({ category: value.category, domain: value.domain, operation: value.operation, scope });
}

/** Internal scope comparison; directory matching always uses segment boundaries. */
export function permissionScopeMatches(granted: PermissionScope, requested: PermissionScope): boolean {
  if (granted.kind === requested.kind && granted.value === requested.value) return true;
  if (granted.kind !== 'directory' || !requested.value.startsWith('/')) return false;
  virtualPath(requested.value);
  return granted.value === '/' || granted.value === requested.value || requested.value.startsWith(`${granted.value}/`);
}
