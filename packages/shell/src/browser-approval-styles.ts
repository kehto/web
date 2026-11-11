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
.kehto-fw-hint, .kehto-fw-identity { color: var(--fw-muted); font-size: 11px; overflow-wrap: anywhere; }
.kehto-fw-error { color: var(--fw-deny); font-size: 12px; }
.kehto-fw-error:empty { display: none; }
.kehto-fw-rules, .kehto-fw-management, .kehto-fw-grants { display: grid; gap: 8px; }
.kehto-fw-rule-list li { display: grid; grid-template-columns: minmax(0, 1fr) auto 26px; align-items: center; gap: 6px; padding: 4px 0; border-bottom: 1px solid var(--fw-line); }
.kehto-fw-rule-name { display: grid; }
.kehto-fw-rule-name small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.kehto-fw-icon { width: 26px; padding: 0; }
.kehto-fw-rule-add { display: grid; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 6px; }
.kehto-fw-rule-add input { padding: 0 8px; }
.kehto-fw-napplet { border: 1px solid var(--fw-line); border-radius: 6px; background: var(--fw-bg); }
.kehto-fw-napplet > summary { display: flex; align-items: center; flex-wrap: wrap; gap: 2px; padding: 8px 10px; cursor: pointer; }
.kehto-fw-napplet > summary small { margin-left: auto; }
.kehto-fw-napplet > :not(summary) { margin: 0 10px 8px; }
.kehto-fw-by-rule { display: flex; align-items: center; justify-content: space-between; gap: 8px; color: var(--fw-muted); font-size: 12px; }
.kehto-fw-domain { border-top: 1px solid var(--fw-line); padding-top: 6px; }
.kehto-fw-domain > summary { display: flex; align-items: center; justify-content: space-between; gap: 8px; cursor: pointer; }
.kehto-fw-domain > ul { margin: 6px 0; }
.kehto-fw-domain li { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; gap: 2px 8px; padding: 6px 8px; border-radius: 4px; background: var(--fw-inset); }
.kehto-fw-domain li code { grid-column: 1 / 3; grid-row: 2; }
.kehto-fw-domain li small { grid-column: 1 / 3; grid-row: 3; }
.kehto-fw-domain li button { grid-column: 3; grid-row: 1 / span 3; align-self: center; }
.kehto-fw-effect { font-size: 10px; font-weight: 700; text-transform: uppercase; }
.kehto-fw-allow { color: var(--fw-allow); }
.kehto-fw-deny { color: var(--fw-deny); }
.kehto-fw-footer { display: flex; flex-wrap: wrap; gap: 6px; }
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
