#!/usr/bin/env node
/**
 * generate-napplet-bindings.mjs — Derive the napplet-facing binding table for
 * every `extension` mock from its NAP document at the exact ref the mock was
 * written against, and write `src/napplet-bindings.ts`.
 *
 * Usage (after `pnpm build`, so `dist/` holds the registry):
 *   node scripts/generate-napplet-bindings.mjs            # fetch with `gh`
 *   node scripts/generate-napplet-bindings.mjs --docs DIR # read DIR/<domain>.md
 *   node scripts/generate-napplet-bindings.mjs --check    # exit 1 on drift
 *
 * Binding rule (documented in README "Napplet bindings"):
 * - every napplet → host row of the Wire Protocol table becomes one method;
 *   the API Surface operation name is used when it maps to that wire type,
 *   otherwise the wire action;
 * - parameters are that request's wire fields (minus `id`) in table order;
 * - a method expects a reply only when a `<type>.result` row exists and the
 *   row is not limited to refusals; it resolves with the result's single named
 *   field when the table lists exactly one (besides `id`/`error`), otherwise
 *   with the whole payload minus `type`/`id`;
 * - host → napplet rows without `.result` are push events; API rows of the form
 *   "handler for X" become named handlers over the pushes they list.
 * API rows backed by local caches ("latest …") or local helpers have no wire
 * message and are reported as gaps rather than bound.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'src', 'napplet-bindings.ts');

/**
 * Documents whose wire section states the envelope in prose instead of a table.
 * Requests carry the API row's parameters; results carry `value`.
 */
const PROSE_ENVELOPE = Object.freeze({ soulseek: { resultField: 'value' } });

/**
 * Return the rows of the first markdown table under a `## <heading>` section.
 * @param {string} doc
 * @param {string} heading
 * @returns {string[][]}
 */
export function sectionRows(doc, heading) {
  const lines = doc.split('\n');
  const start = lines.findIndex((line) => line.trim() === `## ${heading}`);
  if (start < 0) return [];
  const rows = [];
  for (const line of lines.slice(start + 1)) {
    if (/^## /.test(line)) break;
    if (!line.startsWith('|')) {
      if (rows.length > 0 && heading === 'API Surface') break;
      continue;
    }
    const cells = line.slice(1, line.endsWith('|') ? -1 : undefined).split('|').map((cell) => cell.trim());
    if (cells.every((cell) => /^:?-+:?$/.test(cell))) continue;
    rows.push(cells);
  }
  return rows;
}

/**
 * Field names listed in a wire-table payload cell, in order. Type
 * annotations in parentheses are dropped; `?` marks optional fields.
 * @param {string} cell
 * @returns {string[]}
 */
export function payloadFields(cell) {
  const withoutTypes = cell.replace(/\([^)]*\)/g, '');
  const names = [];
  for (const match of withoutTypes.matchAll(/`([a-zA-Z][a-zA-Z0-9]*)\??`/g)) {
    if (!names.includes(match[1])) names.push(match[1]);
  }
  return names;
}

/**
 * Parse one NAP document into a binding.
 * @param {string} domain
 * @param {string} doc
 * @returns {{ methods: Record<string, { type: string, params: string[], reply: boolean, result?: string }>, events: string[], handlers: Record<string, string[]>, gaps: string[] }}
 */
export function parseBinding(domain, doc) {
  const prose = PROSE_ENVELOPE[domain];
  const api = sectionRows(doc, 'API Surface').filter((row) => /^`[a-zA-Z]+`$/.test(row[0] ?? ''));
  const wire = sectionRows(doc, 'Wire Protocol').filter((row) => new RegExp(`^\`${domain}\\.`).test(row[0] ?? ''));
  const methods = {};
  const events = [];
  const handlers = {};
  const gaps = [];
  const opFor = new Map();

  for (const row of api) {
    const op = row[0].slice(1, -1);
    const params = row[1] ?? '';
    const wireCell = row[3] ?? '';
    if (/^handler for/i.test(params)) {
      const types = [...wireCell.matchAll(new RegExp(`\`(${domain}\\.[a-zA-Z.]+)\``, 'g'))].map((m) => m[1]);
      if (types.length > 0) handlers[op] = types;
      continue;
    }
    if (/local helper|^latest /i.test(wireCell)) {
      gaps.push(`${op}: ${/local helper/i.test(wireCell) ? 'local helper, no wire message' : `served from the latest ${wireCell.replace(/^latest\s+/i, '').replace(/`/g, '')} push`}`);
      continue;
    }
    const type = new RegExp(`\`(${domain}\\.[a-zA-Z]+)\``).exec(wireCell)?.[1];
    if (type) opFor.set(type, op);
    if (prose && type) {
      const params = row[1] === 'none' ? [] : payloadFields(row[1]);
      methods[op] = { type, params, reply: true, result: prose.resultField };
    }
  }

  const results = new Map();
  for (const row of wire) {
    const type = row[0].slice(1, -1);
    if (type.endsWith('.result')) results.set(type.slice(0, -'.result'.length), row);
  }
  for (const row of wire) {
    const type = row[0].slice(1, -1);
    const direction = row[1] ?? '';
    const toHost = /^napplet\s*(->|→)/.test(direction);
    if (type.endsWith('.result')) continue;
    if (!toHost) {
      events.push(type);
      continue;
    }
    const requestFields = payloadFields(row[2] ?? '');
    const params = requestFields.filter((name) => name !== 'id');
    const resultRow = results.get(type);
    const reply = Boolean(resultRow) && !/only when/i.test(resultRow?.[2] ?? '');
    const fields = resultRow ? payloadFields(resultRow[2] ?? '').filter((name) => name !== 'id' && name !== 'error') : [];
    const name = opFor.get(type) ?? type.slice(domain.length + 1);
    methods[name] = {
      type,
      params,
      reply,
      ...(requestFields.includes('id') ? {} : { id: false }),
      ...(reply && fields.length === 1 ? { result: fields[0] } : {}),
    };
  }
  for (const [type, op] of opFor) {
    if (!Object.values(methods).some((method) => method.type === type)) gaps.push(`${op}: ${type} has no wire request row`);
  }
  return { methods, events, handlers, gaps };
}

/**
 * Render the generated TypeScript module.
 * @param {Array<{ domain: string, spec: object, binding: ReturnType<typeof parseBinding> }>} entries
 * @returns {string}
 */
export function renderModule(entries) {
  const out = [];
  out.push('/**');
  out.push(' * napplet-bindings.ts — GENERATED by scripts/generate-napplet-bindings.mjs.');
  out.push(' * Do not edit by hand: change the generator or the pinned spec ref, then rerun');
  out.push(' * `pnpm --filter @kehto/mocks bindings:generate`.');
  out.push(' */');
  out.push("import type { MockNappletBinding } from './core/binding-types.js';");
  out.push('');
  out.push('/**');
  out.push(' * Napplet-facing binding per `extension` mock, derived from each NAP\'s wire table');
  out.push(' * at the ref recorded in the mock registry.');
  out.push(' *');
  out.push(' * @example');
  out.push(' * ```ts');
  out.push(" * MOCK_NAPPLET_BINDINGS.torrent.methods.add.type === 'torrent.add';");
  out.push(' * ```');
  out.push(' */');
  out.push('export const MOCK_NAPPLET_BINDINGS: Readonly<Record<string, MockNappletBinding>> = Object.freeze({');
  for (const { domain, spec, binding } of entries) {
    out.push(`  ${JSON.stringify(domain)}: {`);
    out.push(`    spec: { nap: ${JSON.stringify(spec.nap)}, sha: ${JSON.stringify(spec.sha)} },`);
    out.push('    methods: {');
    for (const [name, method] of Object.entries(binding.methods)) {
      const id = method.id === false ? ', id: false' : '';
      const result = method.result ? `, result: ${JSON.stringify(method.result)}` : '';
      out.push(`      ${JSON.stringify(name)}: { type: ${JSON.stringify(method.type)}, params: ${JSON.stringify(method.params)}, reply: ${method.reply}${id}${result} },`);
    }
    out.push('    },');
    out.push(`    events: ${JSON.stringify(binding.events)},`);
    out.push(`    handlers: ${JSON.stringify(binding.handlers)},`);
    out.push(`    gaps: ${JSON.stringify(binding.gaps)},`);
    out.push('  },');
  }
  out.push('});');
  out.push('');
  return out.join('\n');
}

function fetchDoc(spec) {
  const raw = execFileSync('gh', ['api', `repos/napplet/naps/contents/${spec.path}?ref=${spec.sha}`, '-q', '.content'], { encoding: 'utf8' });
  return Buffer.from(raw, 'base64').toString('utf8');
}

async function main(argv) {
  const docsIndex = argv.indexOf('--docs');
  const docsDir = docsIndex >= 0 ? argv[docsIndex + 1] : undefined;
  const check = argv.includes('--check');
  const { MOCK_NAP_REGISTRY } = await import(pathToFileURL(join(HERE, '..', 'dist', 'index.js')).href);
  const entries = MOCK_NAP_REGISTRY
    .filter((entry) => entry.kind === 'extension')
    .map((entry) => {
      const doc = docsDir ? readFileSync(join(docsDir, `${entry.domain}.md`), 'utf8') : fetchDoc(entry.spec);
      return { domain: entry.domain, spec: entry.spec, binding: parseBinding(entry.domain, doc) };
    });
  const source = renderModule(entries);
  if (check) {
    const current = readFileSync(OUT, 'utf8');
    if (current !== source) {
      console.error('napplet-bindings.ts is stale; run `pnpm --filter @kehto/mocks bindings:generate`.');
      process.exit(1);
    }
    console.log('napplet-bindings.ts is current.');
    return;
  }
  writeFileSync(OUT, source);
  console.log(`Wrote ${entries.length} bindings to src/napplet-bindings.ts`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  await main(process.argv.slice(2));
}
