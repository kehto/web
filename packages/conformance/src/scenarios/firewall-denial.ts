/**
 * scenarios/firewall-denial.ts — Denial through the legacy Firewall gate.
 *
 * `catalog/firewall-denial` is the Firewall sibling of `catalog/acl-denial`.
 * ACL does not gate every domain (common, lists, serial, ble, webrtc, link and
 * gamepad have no capability), so a target that keeps a legacy behavioral
 * Firewall is driven through that gate too: for every advertised domain with a
 * request case, one endpoint is blocked at the Firewall, and the check proves
 * the gate fired, the backend never ran, and the endpoint saw only a message
 * type the owning NAP defines (silence, or the canonical reply).
 *
 * It needs `TargetSession.openLegacyFirewall`; a target without that gate
 * skips the check.
 */
import { FIXTURES } from '../fixtures/index.js';
import type { DomainFixture, OperationCase } from '../fixtures/types.js';
import { fail, pass, skip, type CheckOutcome } from '../model.js';
import { defineScenario, type Check, type CollectContext } from '../scenario.js';
import type { TargetSession } from '../target.js';

type Envelope = Readonly<Record<string, unknown>>;

/** The request a domain is denied on, and the reply type its NAP defines. */
interface FirewallRequest {
  readonly request: OperationCase;
  readonly canonical: string;
}

/** One request denied at the Firewall. */
export interface FirewallRow {
  readonly domain: string;
  readonly request: string;
  readonly canonical: string;
  /** Requests the Firewall rejected for the blocked endpoint. */
  readonly rejections: number;
  readonly backendCalls: number;
  /** Every runtime -> napplet message of this domain the blocked endpoint got after its request. */
  readonly replies: readonly Envelope[];
  /** Pushes the NAP defines for the domain; one may race the request and is not a reply. */
  readonly pushes: readonly string[];
}

interface FirewallFacts {
  readonly gate: boolean;
  readonly rows: readonly FirewallRow[];
}

const CONTROLS = ['firewall.block', 'firewall.rejections', 'backend.calls'] as const;

/**
 * The first correlated request, or, for a domain with none (NAP-GAMEPAD has
 * "no request/result pairs"), the first subscribe whose push is its reply.
 */
function requestOf(fixture: DomainFixture): FirewallRequest | undefined {
  const request = fixture.cases.find((item) => item.reply !== null && !item.noId);
  if (request) return { request, canonical: request.reply ?? `${request.type}.result` };
  const push = (fixture.pushes ?? []).find((item) => item.subscribe?.noId);
  return push?.subscribe ? { request: push.subscribe, canonical: push.type } : undefined;
}

async function denyAtFirewall(
  scoped: TargetSession, context: CollectContext, fixture: DomainFixture, { request, canonical }: FirewallRequest,
): Promise<FirewallRow> {
  const envelope = { type: request.type, ...(request.noId ? {} : { id: `firewall-${request.id}` }), ...request.payload };
  const match = request.noId ? { type: canonical } : { id: envelope.id };
  const endpoint = await scoped.loadProbe({
    plan: {
      label: `firewall-${fixture.domain}`, timeoutMs: context.timeoutMs,
      steps: [
        { op: 'mark', name: 'loaded' },
        { op: 'waitSignal', name: 'go' },
        { op: 'send', envelope },
        { op: 'expect', as: 'reply', match, timeoutMs: context.settleMs * 3 },
      ],
    },
    dTag: `probe-firewall-${fixture.domain}`, grants: [fixture.domain], optional: [fixture.domain], rawWire: true,
  });
  await endpoint.waitMark('loaded', context.timeoutMs * 2);
  await scoped.control('firewall.block', { endpoint: endpoint.id });
  const before = await scoped.control('backend.calls', fixture.domain) as number;
  const from = scoped.transcript().length;
  endpoint.signal('go');
  await endpoint.report(context.timeoutMs * 3);
  const after = await scoped.control('backend.calls', fixture.domain) as number;
  const rejections = await scoped.control('firewall.rejections', { endpoint: endpoint.id }) as number;
  // Judge every message the endpoint got, not just the one the probe matched:
  // a fire-and-forget request has no id to match on.
  const replies = scoped.transcript().slice(from)
    .filter((entry) => entry.tap === 'host' && entry.endpoint === endpoint.id && entry.direction === 'runtime->napplet')
    .map((entry) => entry.envelope as Envelope)
    .filter((reply) => String(reply?.type).startsWith(`${fixture.domain}.`));
  await scoped.destroyEndpoint(endpoint.id);
  const pushes = (fixture.pushes ?? []).map((push) => push.type).filter((type) => type !== canonical);
  return { domain: fixture.domain, request: request.type, canonical, rejections, backendCalls: after - before, replies, pushes };
}

async function collect(context: CollectContext): Promise<FirewallFacts> {
  if (!context.session.openLegacyFirewall) return { gate: false, rows: [] };
  const scoped = await context.session.openLegacyFirewall();
  try {
    if (!CONTROLS.every((name) => scoped.controls.includes(name))) return { gate: false, rows: [] };
    const rows: FirewallRow[] = [];
    for (const domain of scoped.advertised().domains) {
      if (domain === 'shell' || (context.domains.length && !context.domains.includes(domain))) continue;
      const fixture = FIXTURES[domain];
      const request = fixture ? requestOf(fixture) : undefined;
      if (fixture && request) rows.push(await denyAtFirewall(scoped, context, fixture, request));
    }
    return { gate: true, rows };
  } finally {
    await scoped.dispose();
  }
}

/**
 * Judge one row.
 *
 * @param row - One Firewall-denied request.
 * @returns The problem, or `null` when the denial was handled as the NAP allows.
 */
export function judgeFirewallDenial(row: FirewallRow): string | null {
  if (row.rejections === 0) return `the Firewall gate never saw ${row.request}`;
  if (row.backendCalls > 0) return `the ${row.domain} backend ran ${row.backendCalls} times after the Firewall rejected ${row.request}`;
  // NAP-RESOURCE defines `resource.*.error`; no other NAP defines an `.error` reply.
  const allowed = (type: unknown): boolean => type === row.canonical || row.pushes.includes(String(type))
    || (row.domain === 'resource' && type === `${row.request}.error`);
  const stray = row.replies.find((reply) => !allowed(reply.type));
  if (stray) {
    return `Firewall denial was answered with ${String(stray.type)}, a type ${row.domain}'s NAP does not define (expected silence or ${row.canonical})`;
  }
  return null;
}

function firewallDenial(facts: FirewallFacts): CheckOutcome {
  if (!facts.gate) return skip('The target has no legacy Firewall gate (openLegacyFirewall with firewall.block / firewall.rejections / backend.calls)');
  if (!facts.rows.length) return skip('No advertised domain with a request case in this variant');
  const problems = facts.rows.map((row) => ({ ...row, problem: judgeFirewallDenial(row) })).filter((row) => row.problem);
  const diagnostics = { problems, tested: facts.rows.map((row) => row.domain) };
  if (problems.length) return fail(`${problems.length} domains mishandled a Firewall denial`, diagnostics);
  return pass(`Firewall denial ran no backend and was silent or canonical in ${facts.rows.length} domains`, diagnostics);
}

const checks: readonly Check<FirewallFacts>[] = [
  { id: 'catalog/firewall-denial', title: 'Firewall denial runs no backend and answers only as the NAP allows', scope: 'wire-contract', severity: 'error', authority: ['nap-package'], evaluate: firewallDenial },
];

/** Denial through the legacy Firewall gate. */
export const FIREWALL_DENIAL_SCENARIO = defineScenario<FirewallFacts>({ id: 'firewall-denial', collect, checks });
