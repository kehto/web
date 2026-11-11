import type { PermissionGrant, PermissionPrincipal } from '@kehto/runtime';
import {
  LIFETIME_LABELS, describeRequirement, groupGrants, principalIdentity, principalSummary,
} from './browser-approval-format.js';
import type { GrantGroup } from './browser-approval-format.js';
import { element } from './browser-approval-dom.js';

interface GrantListOptions {
  readonly labelForPrincipal: (principal: PermissionPrincipal) => string;
  /** Revoke through the live runtime, then re-render. */
  readonly revoke: (grants: readonly PermissionGrant[]) => void;
}

const SHORT_LIFETIME: Readonly<Record<PermissionGrant['lifetime'], string>> = Object.freeze({
  once: 'once', session: 'session', persistent: 'always',
});

/**
 * Grant list as a tree of single-line rows: napplet, interface, grant. Every
 * row shows a status dot, a name and a count or lifetime; identity, the full
 * scope and the remaining facts appear only when a row is expanded.
 *
 * @param document - Document that owns the list.
 * @param options - Host label and the runtime-backed revoke action.
 * @returns The list root and a render function for a fresh grant snapshot.
 */
export function createGrantList(document: Document, options: GrantListOptions): { readonly root: HTMLElement; render(grants: readonly PermissionGrant[]): void } {
  const root = element(document, 'div', undefined, 'kehto-fw-grants');
  // Expansion is the user's; a re-render after each decision keeps it.
  const closedNapplets = new Set<string>();
  const openRows = new Set<string>();

  /** Icon button; the label carries the meaning for assistive tech and as a tooltip. */
  function icon(glyph: string, label: string, grants: readonly PermissionGrant[]): HTMLButtonElement {
    const node = element(document, 'button', glyph, 'kehto-fw-icon');
    node.type = 'button';
    node.title = label;
    node.setAttribute('aria-label', label);
    node.addEventListener('click', (event) => {
      // The button sits in a summary: acting must not also toggle the row.
      event.preventDefault();
      event.stopPropagation();
      options.revoke(grants);
    });
    return node;
  }

  function track(details: HTMLDetailsElement, key: string, open: Set<string>, invert: boolean): void {
    details.open = open.has(key) !== invert;
    details.addEventListener('toggle', () => {
      if (details.open !== invert) open.add(key);
      else open.delete(key);
    });
  }

  function dot(effect: 'allow' | 'deny' | 'mixed'): HTMLSpanElement {
    const node = element(document, 'span', undefined, `kehto-fw-dot kehto-fw-${effect}`);
    node.setAttribute('aria-hidden', 'true');
    return node;
  }

  function effectOf(grants: readonly PermissionGrant[]): 'allow' | 'deny' | 'mixed' {
    const denied = grants.filter((grant) => grant.effect === 'deny').length;
    return denied === 0 ? 'allow' : denied === grants.length ? 'deny' : 'mixed';
  }

  function grantRow(group: GrantGroup, grant: PermissionGrant): HTMLDetailsElement {
    const text = describeRequirement(grant.permission);
    const scope = grant.permission.scope;
    const details = element(document, 'details', undefined, 'kehto-fw-grant');
    track(details, `${group.key}#${grant.id}`, openRows, false);
    const row = element(document, 'summary', undefined, 'kehto-fw-row');
    row.append(dot(grant.effect), element(document, 'span', text.action, 'kehto-fw-name'));
    if (text.target !== undefined) row.append(element(document, 'code', text.target));
    row.append(
      element(document, 'small', SHORT_LIFETIME[grant.lifetime]),
      icon('×', `Revoke ${grant.permission.operation} ${scope.kind}:${scope.value}`, [grant]),
    );
    const more = element(document, 'p', undefined, 'kehto-fw-more');
    more.append(
      element(document, 'span', `${grant.effect === 'allow' ? 'Allowed' : 'Blocked'} · ${LIFETIME_LABELS[grant.lifetime]}`),
      element(document, 'code', `${grant.permission.operation} ${scope.kind}:${scope.value}`),
    );
    details.append(row, more);
    return details;
  }

  function nappletGroup(group: GrantGroup): HTMLDetailsElement {
    const label = options.labelForPrincipal(group.principal);
    const all = [...group.decided.flatMap((domain) => domain.grants), ...group.byRule];
    const details = element(document, 'details', undefined, 'kehto-fw-napplet');
    track(details, group.key, closedNapplets, true);
    const summary = element(document, 'summary', undefined, 'kehto-fw-row');
    summary.append(
      dot(effectOf(all)),
      element(document, 'strong', label, 'kehto-fw-name'),
      element(document, 'span', group.principal.kind === 'verified' ? 'verified' : 'dev', 'kehto-approval-badge'),
      element(document, 'small', String(all.length)),
      icon('×', `Revoke every grant for ${label}`, all),
    );
    const identity = element(document, 'p', principalSummary(group.principal), 'kehto-fw-identity');
    identity.title = principalIdentity(group.principal);
    details.append(summary, identity);
    if (group.byRule.length) {
      const byRule = element(document, 'div', undefined, 'kehto-fw-row kehto-fw-by-rule');
      byRule.append(
        dot('allow'),
        element(document, 'span', `${group.byRule.length} allowed by default rules`, 'kehto-fw-name'),
        element(document, 'small', 'session'),
        icon('↺', `Reset default-rule grants for ${label}`, group.byRule),
      );
      details.append(byRule);
    }
    for (const domain of group.decided) {
      const section = element(document, 'details', undefined, 'kehto-fw-domain');
      track(section, `${group.key}#${domain.domain}`, openRows, false);
      const heading = element(document, 'summary', undefined, 'kehto-fw-row');
      heading.append(
        dot(effectOf(domain.grants)),
        element(document, 'code', domain.domain, 'kehto-fw-name'),
        element(document, 'small', String(domain.grants.length)),
        icon('×', `Revoke all ${domain.domain} decisions for ${label}`, domain.grants),
      );
      section.append(heading, ...domain.grants.map((grant) => grantRow(group, grant)));
      details.append(section);
    }
    return details;
  }

  function render(grants: readonly PermissionGrant[]): void {
    const groups = groupGrants(grants);
    root.replaceChildren(...(groups.length
      ? groups.map(nappletGroup)
      : [element(document, 'p', 'No grants yet.', 'kehto-fw-hint')]));
  }

  return { root, render };
}
