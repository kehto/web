/**
 * Stylesheet for {@link createBrowserApprovalUi}. The UI ships no styles of its
 * own; a host adds this to a `<style>` element or writes its own against the
 * same class names. Colors read `--kehto-fw-*` custom properties so a host
 * theme can restyle it without overriding rules.
 *
 * @example
 * ```ts
 * const style = document.createElement('style');
 * style.textContent = BROWSER_APPROVAL_UI_STYLES;
 * document.head.append(style);
 * ```
 */
export const BROWSER_APPROVAL_UI_STYLES = `
.kehto-approval-ui { --fw-bg: var(--kehto-fw-bg, #181b19); --fw-inset: var(--kehto-fw-inset, #0b0d0b); --fw-line: var(--kehto-fw-line, #30352f); --fw-text: var(--kehto-fw-text, #f4f0df); --fw-muted: var(--kehto-fw-muted, #a9ad9f); --fw-accent: var(--kehto-fw-accent, #d8c36a); --fw-allow: var(--kehto-fw-allow, #9fce7c); --fw-deny: var(--kehto-fw-deny, #f08a7b); min-width: 0; max-width: 100%; color: var(--fw-text); display: grid; gap: 14px; }
.kehto-approval-ui * { box-sizing: border-box; min-width: 0; }
.kehto-approval-ui h2, .kehto-approval-ui h3, .kehto-approval-ui p, .kehto-approval-ui ul { margin: 0; padding: 0; }
.kehto-approval-ui ul { list-style: none; display: grid; gap: 4px; }
.kehto-approval-ui h3 { font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--fw-muted); }
.kehto-approval-ui code { font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; overflow-wrap: anywhere; }
.kehto-approval-ui small { color: var(--fw-muted); font-size: 11px; }
.kehto-approval-ui button { white-space: nowrap; }
.kehto-approval-ui [hidden] { display: none !important; }
.kehto-approval-badge { margin: 0 6px; padding: 1px 6px; border: 1px solid var(--fw-line); border-radius: 999px; color: var(--fw-muted); font-size: 10px; text-transform: uppercase; }
.kehto-fw-hint { color: var(--fw-muted); font-size: 11px; }
.kehto-fw-error { color: var(--fw-deny); font-size: 11px; }
.kehto-fw-error:empty { display: none; }
.kehto-fw-rules, .kehto-fw-management { display: grid; gap: 4px; }
.kehto-fw-head { display: flex; align-items: center; justify-content: space-between; height: 22px; }
.kehto-fw-row { display: flex; align-items: center; gap: 6px; height: 24px; padding: 0 4px; border-radius: 4px; font-size: 12px; list-style: none; white-space: nowrap; }
.kehto-fw-row::-webkit-details-marker { display: none; }
summary.kehto-fw-row { cursor: pointer; }
.kehto-fw-row:hover { background: color-mix(in srgb, var(--fw-text) 7%, transparent); }
summary.kehto-fw-row::before { content: '›'; width: 8px; color: var(--fw-muted); transition: transform 120ms; }
details[open] > summary.kehto-fw-row::before { transform: rotate(90deg); }
.kehto-fw-row > * { flex: none; }
.kehto-fw-row > .kehto-fw-name { flex: 0 1 auto; overflow: hidden; text-overflow: ellipsis; }
.kehto-fw-row > .kehto-fw-name small { margin-left: 6px; }
.kehto-fw-row > code:not(.kehto-fw-name) { flex: 1 1 0; overflow: hidden; text-overflow: ellipsis; color: var(--fw-muted); }
.kehto-fw-row > small, .kehto-fw-row > select { margin-left: auto; }
.kehto-fw-row > code:not(.kehto-fw-name) + small { margin-left: 0; }
.kehto-fw-row > small { font-variant-numeric: tabular-nums; }
.kehto-fw-row .kehto-approval-badge { margin: 0; padding: 0 5px; font-size: 9px; }
.kehto-fw-row select { height: 20px; min-height: 0; padding: 0 2px; font-size: 11px; }
.kehto-fw-dot { width: 7px; height: 7px; border-radius: 50%; background: var(--fw-muted); }
.kehto-fw-dot.kehto-fw-allow { background: var(--fw-allow); }
.kehto-fw-dot.kehto-fw-deny { background: var(--fw-deny); }
.kehto-fw-dot.kehto-fw-ask, .kehto-fw-dot.kehto-fw-mixed { background: var(--fw-accent); }
.kehto-approval-ui button.kehto-fw-icon { width: 20px; height: 20px; min-height: 0; padding: 0; border-color: transparent; background: transparent; color: var(--fw-muted); font-size: 14px; line-height: 1; }
.kehto-approval-ui button.kehto-fw-icon:hover:not(:disabled), .kehto-approval-ui button.kehto-fw-icon:focus-visible { color: var(--fw-text); border-color: var(--fw-line); }
.kehto-approval-ui button.kehto-fw-icon:disabled { opacity: 0.3; cursor: default; }
.kehto-fw-row > .kehto-fw-icon { opacity: 0.35; }
.kehto-fw-row:hover > .kehto-fw-icon, .kehto-fw-row > .kehto-fw-icon:focus-visible { opacity: 1; }
.kehto-fw-rule-list { gap: 0 !important; }
.kehto-fw-rule-list li.kehto-fw-row { padding-right: 0; }
.kehto-fw-rule-list li.kehto-fw-row > select + .kehto-fw-icon { margin-left: 0; }
.kehto-fw-rule-list li.kehto-fw-row > select:last-child { margin-right: 26px; }
.kehto-fw-rule-add { display: flex; gap: 4px; align-items: center; margin-top: 2px; }
.kehto-fw-rule-add input { flex: 1 1 0; height: 22px; min-height: 0; padding: 0 6px; font-size: 11px; }
.kehto-fw-rule-add select { flex: 0 1 auto; max-width: 96px; height: 22px; min-height: 0; padding: 0 2px; font-size: 11px; }
.kehto-fw-grants { display: grid; }
.kehto-fw-napplet > :not(summary) { margin-left: 14px; }
.kehto-fw-domain > :not(summary) { margin-left: 14px; }
.kehto-fw-identity, .kehto-fw-more { padding: 0 4px 4px 18px; color: var(--fw-muted); font-size: 11px; overflow-wrap: anywhere; }
.kehto-fw-more { display: grid; gap: 2px; }
.kehto-fw-grant > summary.kehto-fw-row::before, .kehto-fw-by-rule::before { content: ''; width: 8px; transform: none; }
.kehto-fw-more code { font-size: 11px; }
.kehto-fw-grant[open] > summary.kehto-fw-row > code { color: var(--fw-text); }
.kehto-approval-dialog { width: min(480px, calc(100% - 32px)); max-height: calc(100% - 32px); overflow: auto; padding: 20px; border: 1px solid var(--fw-line); border-radius: 8px; background: var(--fw-bg); color: var(--fw-text); box-shadow: 0 18px 60px rgb(0 0 0 / 0.45); }
.kehto-approval-dialog[open] { display: grid; gap: 12px; }
.kehto-approval-dialog::backdrop { background: rgb(0 0 0 / 0.68); }
.kehto-approval-eyebrow { color: var(--fw-accent); font-size: 11px; font-weight: 700; text-transform: uppercase; }
.kehto-approval-dialog h2 { font-size: 18px; line-height: 1.25; }
.kehto-approval-scopes li { display: grid; gap: 2px; padding: 8px 10px; border: 1px solid var(--fw-line); border-radius: 4px; background: var(--fw-inset); }
.kehto-approval-scopes li span { color: var(--fw-muted); font-size: 11px; }
.kehto-approval-scopes { max-height: 220px; overflow: auto; }
.kehto-approval-note, .kehto-approval-identity { color: var(--fw-muted); font-size: 11px; overflow-wrap: anywhere; }
.kehto-approval-identity summary { cursor: pointer; }
.kehto-approval-remember { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; }
.kehto-approval-remember span { color: var(--fw-muted); font-size: 11px; margin-right: 2px; }
.kehto-approval-remember button[aria-pressed="true"] { border-color: var(--fw-accent); color: var(--fw-accent); }
.kehto-approval-remember button:disabled { opacity: 0.45; cursor: default; }
.kehto-approval-rule { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.kehto-approval-rule input { margin: 0; flex: none; }
.kehto-approval-actions { display: flex; justify-content: flex-end; gap: 8px; }
.kehto-approval-actions button { min-width: 88px; }
.kehto-approval-primary { border-color: var(--fw-accent); color: var(--fw-accent); font-weight: 700; }
`;
