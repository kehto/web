/** Styles for the conformance web UI; light and dark via `prefers-color-scheme`. */
export const UI_STYLES = `
:root { --bg: #ffffff; --fg: #1a1a1a; --muted: #5c5c66; --line: #dcdce2; --card: #f6f6f9;
  --pass: #1a7f37; --fail: #c62828; --skip: #6b6b76; --gap: #8a5a00; --core: #2f4fb0; --nap: #6b3fb5; --wire: #00707a; --policy: #8c3b6e; --catalog: #4a5a2a; }
@media (prefers-color-scheme: dark) { :root { --bg: #121216; --fg: #e9e9ee; --muted: #a0a0ad; --line: #2c2c35; --card: #1b1b22;
  --pass: #4cc46d; --fail: #ff6b6b; --skip: #9a9aa6; --gap: #f0b44c; --core: #8ea6ff; --nap: #c3a2ff; --wire: #5cd3dc; --policy: #ef8fc8; --catalog: #b6cf7a; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 14px/1.45 system-ui, -apple-system, Segoe UI, sans-serif; }
#app { max-width: 1200px; margin: 0 auto; padding: 16px; }
h1 { font-size: 20px; margin: 0 0 8px; } h2 { font-size: 17px; margin: 0 0 8px; display: inline; } h3 { font-size: 15px; margin: 16px 0 8px; }
section { margin: 16px 0; }
.controls { display: flex; flex-wrap: wrap; gap: 8px 16px; align-items: center; }
.controls input { min-width: 220px; } input, select, button { font: inherit; padding: 4px 8px; border: 1px solid var(--line); border-radius: 6px; background: var(--card); color: var(--fg); }
button { cursor: pointer; } .live { color: var(--pass); font-weight: 600; } .download { color: var(--core); }
.verdict { border: 1px solid var(--line); border-left: 6px solid var(--pass); border-radius: 8px; padding: 12px 16px; background: var(--card); }
.verdict-fail { border-left-color: var(--fail); }
.counts { display: flex; flex-wrap: wrap; gap: 16px; list-style: none; padding: 0; margin: 8px 0; }
.count-pass strong { color: var(--pass); } .count-fail strong { color: var(--fail); } .count-skip strong { color: var(--skip); } .count-spec-gap strong { color: var(--gap); }
.statement { font-weight: 600; } .meta { color: var(--muted); margin: 0; }
.scroll { overflow-x: auto; } table { border-collapse: collapse; width: 100%; } th, td { border-bottom: 1px solid var(--line); padding: 4px 8px; text-align: left; vertical-align: top; }
.cell-off { color: var(--muted); } .cell-untested, .cell-fail { color: var(--fail); }
.badge { display: inline-block; border-radius: 999px; padding: 0 8px; font-size: 12px; border: 1px solid currentColor; white-space: nowrap; }
.badge-pass { color: var(--pass); } .badge-fail { color: var(--fail); } .badge-skip { color: var(--skip); } .badge-spec-gap, .badge-warning { color: var(--gap); }
.badge-nip5d-core { color: var(--core); } .badge-nap-spec { color: var(--nap); } .badge-wire-contract { color: var(--wire); } .badge-kehto-policy { color: var(--policy); } .badge-catalog { color: var(--catalog); }
.badge-uncovered { color: var(--fail); } .badge-merged { color: var(--pass); } .badge-draft { color: var(--gap); }
.check { border: 1px solid var(--line); border-radius: 6px; margin: 4px 0; padding: 4px 8px; background: var(--card); }
.check summary { cursor: pointer; } .check .variant { color: var(--muted); } .check-fail { border-color: var(--fail); } .check-spec-gap { border-color: var(--gap); }
pre { overflow-x: auto; background: var(--bg); padding: 8px; border-radius: 6px; font-size: 12px; }
.transcript code { font-size: 12px; word-break: break-all; } .tap-host { color: var(--muted); }
.running { color: var(--muted); }
`;
