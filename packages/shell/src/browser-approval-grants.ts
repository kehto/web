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

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * Grant list grouped by napplet, then interface, so identity is stated once
 * and hundreds of exact scopes collapse behind a count.
 *
 * @param document - Document that owns the list.
 * @param options - Host label and the runtime-backed revoke action.
 * @returns The list root and a render function for a fresh grant snapshot.
 */
export function createGrantList(document: Document, options: GrantListOptions): { readonly root: HTMLElement; render(grants: readonly PermissionGrant[]): void } {
  const root = element(document, 'div', undefined, 'kehto-fw-grants');
  // Collapsed state is the user's; a re-render after each decision keeps it.
  const closedNapplets = new Set<string>();
  const openDomains = new Set<string>();

  function button(text: string, label: string, grants: readonly PermissionGrant[]): HTMLButtonElement {
    const node = element(document, 'button', text);
    node.type = 'button';
    node.setAttribute('aria-label', label);
    node.addEventListener('click', () => options.revoke(grants));
    return node;
  }

  function track(details: HTMLDetailsElement, key: string, open: Set<string>, invert: boolean): void {
    details.open = open.has(key) !== invert;
    details.addEventListener('toggle', () => {
      if (details.open !== invert) open.add(key);
      else open.delete(key);
    });
  }

  function grantRow(grant: PermissionGrant): HTMLLIElement {
    const text = describeRequirement(grant.permission);
    const scope = grant.permission.scope;
    const row = element(document, 'li');
    row.append(
      element(document, 'span', grant.effect === 'allow' ? 'Allowed' : 'Blocked', `kehto-fw-effect kehto-fw-${grant.effect}`),
      element(document, 'span', text.action, 'kehto-fw-action'),
    );
    if (text.target !== undefined) row.append(element(document, 'code', text.target));
    row.append(
      element(document, 'small', LIFETIME_LABELS[grant.lifetime]),
      button('Revoke', `Revoke ${grant.permission.operation} ${scope.kind}:${scope.value}`, [grant]),
    );
    return row;
  }

  function nappletGroup(group: GrantGroup): HTMLDetailsElement {
    const label = options.labelForPrincipal(group.principal);
    const all = [...group.decided.flatMap((domain) => domain.grants), ...group.byRule];
    const details = element(document, 'details', undefined, 'kehto-fw-napplet');
    track(details, group.key, closedNapplets, true);
    const summary = element(document, 'summary');
    summary.append(
      element(document, 'strong', label),
      element(document, 'span', group.principal.kind === 'verified' ? 'verified' : 'development', 'kehto-approval-badge'),
      element(document, 'small', plural(all.length, 'grant')),
    );
    const identity = element(document, 'p', principalSummary(group.principal), 'kehto-fw-identity');
    identity.title = principalIdentity(group.principal);
    details.append(summary, identity);
    if (group.byRule.length) {
      const byRule = element(document, 'p', undefined, 'kehto-fw-by-rule');
      byRule.append(
        element(document, 'span', `${plural(group.byRule.length, 'scope')} allowed by default rules until it closes`),
        button('Reset', `Reset default-rule grants for ${label}`, group.byRule),
      );
      details.append(byRule);
    }
    for (const domain of group.decided) {
      const section = element(document, 'details', undefined, 'kehto-fw-domain');
      track(section, `${group.key}#${domain.domain}`, openDomains, false);
      const heading = element(document, 'summary');
      heading.append(element(document, 'code', domain.domain), element(document, 'small', plural(domain.grants.length, 'decision')));
      const rows = element(document, 'ul');
      rows.append(...domain.grants.map(grantRow));
      section.append(heading, rows, button(`Revoke all ${domain.domain}`, `Revoke all ${domain.domain} decisions for ${label}`, domain.grants));
      details.append(section);
    }
    details.append(button('Revoke everything for this napplet', `Revoke every grant for ${label}`, all));
    return details;
  }

  function render(grants: readonly PermissionGrant[]): void {
    const groups = groupGrants(grants);
    root.replaceChildren(...(groups.length
      ? groups.map(nappletGroup)
      : [element(document, 'p', 'No grants yet. Decisions you make appear here.', 'kehto-fw-hint')]));
  }

  return { root, render };
}
