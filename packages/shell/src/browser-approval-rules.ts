import { setPermissionRule } from '@kehto/runtime';
import type { PermissionRuleAction, PermissionRuleScope, PermissionRuleTarget, PermissionRules } from '@kehto/runtime';
import { RULE_ACTION_LABELS, parseCapability } from './browser-approval-format.js';
import { element, select } from './browser-approval-dom.js';

const ACTIONS = (['allow', 'ask', 'deny'] as const).map((action) => [action, RULE_ACTION_LABELS[action]] as const);
const EVERY_NAPPLET = '';

/** Host-owned default rules the UI reads and replaces; storage is the host's. */
export interface BrowserApprovalRules {
  /** Current rules. Read on every render, never mirrored by the UI. */
  get(): PermissionRules;
  /** Persist and apply replacement rules. Throwing keeps the previous rules. */
  set(rules: PermissionRules): void;
  /** The host's shipped defaults, offered as "Restore defaults" when present. */
  defaults?(): PermissionRules;
}

/** A napplet the user can scope a rule to. */
export interface RuleSubject {
  readonly subject: string;
  readonly label: string;
}

interface RulesEditorOptions {
  readonly rules: BrowserApprovalRules;
  /** Napplets known to the host right now, for the scope picker and row labels. */
  readonly subjects: () => readonly RuleSubject[];
  /** Capabilities worth suggesting, such as those seen in stored grants. */
  readonly suggestions: () => readonly string[];
  /** Called after rules were replaced so the host can re-evaluate live grants. */
  readonly onChange: () => void;
}

interface RuleRow {
  readonly target: PermissionRuleTarget;
  readonly action: PermissionRuleAction;
}

function scopeRows(scope: PermissionRuleScope | PermissionRules, napplet?: string): RuleRow[] {
  const base = napplet === undefined ? {} : { napplet };
  return [
    ...(napplet !== undefined && scope.default !== undefined ? [{ target: base, action: scope.default }] : []),
    ...Object.entries(scope.domains).map(([domain, action]) => ({ target: { ...base, domain }, action })),
    ...Object.entries(scope.operations).map(([operation, action]) => ({ target: { ...base, operation }, action })),
  ];
}

function capabilityText(target: PermissionRuleTarget): string {
  return target.operation ?? (target.domain !== undefined ? `${target.domain} (whole interface)` : 'Everything');
}

/**
 * Editor for host default rules: one default action, then exceptions by
 * interface or operation, for every napplet or a single one.
 *
 * @param document - Document that owns the editor.
 * @param options - Host rule store, known napplets, suggestions and change hook.
 * @returns The editor root and a render function reading the live rules.
 */
export function createRulesEditor(document: Document, options: RulesEditorOptions): { readonly root: HTMLElement; refresh(): void } {
  const root = element(document, 'section', undefined, 'kehto-fw-rules');
  root.setAttribute('aria-label', 'Default rules');
  const hint = element(document, 'p',
    'Applied when no remembered decision covers a request. The most specific rule wins. Tightening a rule stops napplets that relied on it.', 'kehto-fw-hint');
  const list = element(document, 'ul', undefined, 'kehto-fw-rule-list');
  const form = element(document, 'form', undefined, 'kehto-fw-rule-add');
  const scope = element(document, 'select');
  scope.setAttribute('aria-label', 'Rule applies to');
  const capability = element(document, 'input');
  capability.type = 'text';
  capability.setAttribute('aria-label', 'Interface or operation');
  capability.setAttribute('placeholder', 'link or link.open');
  capability.setAttribute('list', 'kehto-fw-capabilities');
  capability.setAttribute('autocomplete', 'off');
  capability.setAttribute('spellcheck', 'false');
  const suggestions = element(document, 'datalist');
  suggestions.id = 'kehto-fw-capabilities';
  const action = select(document, 'Rule action', ACTIONS, 'ask');
  const add = element(document, 'button', 'Add rule');
  add.type = 'submit';
  form.append(scope, capability, suggestions, action, add);
  const error = element(document, 'p', undefined, 'kehto-fw-error');
  error.setAttribute('role', 'alert');
  const restore = element(document, 'button', 'Restore defaults');
  restore.type = 'button';
  root.append(element(document, 'h3', 'Default rules'), hint, list, form, error, restore);

  function apply(next: () => PermissionRules): void {
    try {
      options.rules.set(next());
      error.textContent = '';
    } catch {
      error.textContent = 'That rule could not be saved.';
    }
    options.onChange();
  }

  function row(label: string, capabilityLabel: string, entry: RuleRow, removable: boolean): HTMLLIElement {
    const item = element(document, 'li');
    const name = element(document, 'span', undefined, 'kehto-fw-rule-name');
    name.append(element(document, 'code', capabilityLabel), element(document, 'small', label));
    const choice = select(document, `Action for ${capabilityLabel}, ${label}`, ACTIONS, entry.action);
    choice.addEventListener('change', () => {
      apply(() => setPermissionRule(options.rules.get(), entry.target, choice.value as PermissionRuleAction));
    });
    item.append(name, choice);
    if (removable) {
      const remove = element(document, 'button', '×', 'kehto-fw-icon');
      remove.type = 'button';
      remove.setAttribute('aria-label', `Remove rule for ${capabilityLabel}, ${label}`);
      remove.addEventListener('click', () => apply(() => setPermissionRule(options.rules.get(), entry.target, undefined)));
      item.append(remove);
    }
    return item;
  }

  function refresh(): void {
    const rules = options.rules.get();
    const subjects = options.subjects();
    const labelFor = (subject: string): string => subjects.find((item) => item.subject === subject)?.label ?? subject;
    list.replaceChildren(
      row('every napplet', 'Everything else', { target: {}, action: rules.default }, false),
      ...scopeRows(rules).map((entry) => row('every napplet', capabilityText(entry.target), entry, true)),
      ...Object.entries(rules.napplets).flatMap(([subject, napplet]) => scopeRows(napplet, subject)
        .map((entry) => row(labelFor(subject), capabilityText(entry.target), entry, true))),
    );
    const chosen = scope.value;
    const known = new Map([...subjects, ...Object.keys(rules.napplets).map((subject) => ({ subject, label: labelFor(subject) }))]
      .map((item) => [item.subject, item.label]));
    scope.replaceChildren(...[[EVERY_NAPPLET, 'Every napplet'] as const, ...known].map(([value, text]) => {
      const option = element(document, 'option', text);
      option.value = value;
      return option;
    }));
    scope.value = known.has(chosen) ? chosen : EVERY_NAPPLET;
    suggestions.replaceChildren(...[...new Set(options.suggestions())].sort().map((value) => {
      const option = element(document, 'option');
      option.value = value;
      return option;
    }));
    restore.hidden = !options.rules.defaults;
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const target = parseCapability(capability.value);
    if (!target) {
      error.textContent = 'Enter an interface such as link, or an operation such as link.open.';
      return;
    }
    const napplet = scope.value === EVERY_NAPPLET ? {} : { napplet: scope.value };
    apply(() => setPermissionRule(options.rules.get(), { ...napplet, ...target }, action.value as PermissionRuleAction));
    if (!error.textContent) capability.value = '';
  });
  restore.addEventListener('click', () => {
    const defaults = options.rules.defaults;
    if (defaults) apply(() => defaults());
  });

  return { root, refresh };
}
