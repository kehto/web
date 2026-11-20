/**
 * scenarios/nip5d-load.ts — NIP-5D checks about how a napplet document is loaded:
 * sandboxing, artifact provenance, namespace injection, and manifest declarations.
 *
 * Authority: NIP-5D (nostr-protocol/nips#2303) at the head recorded in `authority.ts`.
 */
import { fail, pass, skip, type CheckOutcome } from '../model.js';
import type { RealmSnapshot } from '../probe/plan.js';
import { defineScenario, runProbe, sameSet, sorted, type Check, type CollectContext } from '../scenario.js';
import type { FrameEvidence, ProbeRejection } from '../target.js';

/** A domain name no runtime advertises. */
export const UNAVAILABLE_DOMAIN = 'conformance-unavailable';

interface LoadedFacts {
  readonly evidence: FrameEvidence;
  readonly granted: readonly string[];
  readonly classic: RealmSnapshot | null;
  readonly module: RealmSnapshot | null;
  /** sha256 of the srcdoc with its single inserted host segment removed, or `null` when it is not artifact + one insertion. */
  readonly loadedHash: string | null;
  /** The host-owned segment found in the srcdoc. */
  readonly injected: string;
}

interface LoadFacts {
  readonly advertised: readonly string[];
  readonly policy: 'strict' | 'warn';
  /** Every advertised domain granted and declared. */
  readonly all: LoadedFacts | null;
  /** One domain granted while every advertised domain is declared optional. */
  readonly narrow: (LoadedFacts & { readonly explicitGrants: readonly string[] }) | null;
  /** A required domain no runtime can expose. */
  readonly required: { readonly rejection: ProbeRejection | null; readonly warnings: readonly string[]; readonly booted: boolean };
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Split `srcdoc` into the artifact and one contiguous inserted segment, when that is what it is. */
function splitInjection(srcdoc: string, artifact: string): { injected: string; remainder: string } | null {
  let prefix = 0;
  while (prefix < artifact.length && srcdoc[prefix] === artifact[prefix]) prefix += 1;
  const tail = artifact.length - prefix;
  if (srcdoc.length < artifact.length || srcdoc.slice(srcdoc.length - tail) !== artifact.slice(prefix)) return null;
  return { injected: srcdoc.slice(prefix, srcdoc.length - tail), remainder: srcdoc.slice(0, prefix) + srcdoc.slice(srcdoc.length - tail) };
}

async function loaded(context: CollectContext, label: string, grants: readonly string[] | 'all', optional?: readonly string[]): Promise<LoadedFacts | null> {
  const { endpoint, report } = await runProbe(context, {
    plan: { label, steps: [] }, dTag: `probe-${label}`, grants, ...(optional ? { optional } : {}),
  });
  if (endpoint.rejection) return null;
  const evidence = endpoint.evidence();
  const split = splitInjection(evidence.srcdoc, evidence.artifact);
  return {
    evidence,
    granted: endpoint.grantedDomains,
    classic: report?.classic ?? null,
    module: report?.module ?? null,
    loadedHash: split ? await sha256Hex(split.remainder) : null,
    injected: split?.injected ?? '',
  };
}

async function collect(context: CollectContext): Promise<LoadFacts> {
  const advertised = context.advertised.domains;
  const all = await loaded(context, 'load-all', 'all');
  const explicit = context.anchor ? [context.anchor.domain] : [];
  const narrowLoaded = await loaded(context, 'load-narrow', explicit, [...advertised, UNAVAILABLE_DOMAIN]);
  const refused = await context.session.loadProbe({
    plan: { label: 'load-required-missing', steps: [], timeoutMs: context.timeoutMs },
    dTag: 'probe-load-required-missing', requires: [UNAVAILABLE_DOMAIN], grants: 'all',
  });
  const refusedReport = refused.rejection ? null : await refused.report(context.timeoutMs);
  return {
    advertised,
    policy: context.target.requiredDomainPolicy,
    all,
    narrow: narrowLoaded ? { ...narrowLoaded, explicitGrants: explicit } : null,
    required: { rejection: refused.rejection, warnings: refused.warnings, booted: refusedReport !== null },
  };
}

const NOT_LOADED = fail('The probe did not load, so there is no evidence to judge');

function sandbox(facts: LoadFacts): CheckOutcome {
  if (!facts.all) return NOT_LOADED;
  const tokens = facts.all.evidence.sandbox.split(/\s+/).filter(Boolean);
  const diagnostics = { sandbox: facts.all.evidence.sandbox, origin: facts.all.classic?.origin, storage: facts.all.classic?.storage };
  if (tokens.includes('allow-same-origin')) return fail('The probe iframe carries allow-same-origin', diagnostics);
  if (!tokens.includes('allow-scripts')) return fail('The probe iframe sandbox lacks allow-scripts', diagnostics);
  if (facts.all.classic?.origin !== 'null') return fail('The probe document does not have an opaque origin', diagnostics);
  if (facts.all.classic.storage !== 'blocked') return fail('The probe document can reach localStorage', diagnostics);
  if (tokens.length !== 1) return fail('The sandbox attribute carries tokens beyond allow-scripts', diagnostics);
  return pass('sandbox="allow-scripts", opaque origin, no storage', diagnostics);
}

function provenance(facts: LoadFacts): CheckOutcome {
  if (!facts.all) return NOT_LOADED;
  const { evidence, loadedHash, injected, classic } = facts.all;
  const diagnostics = { src: evidence.src, verifiedHash: evidence.verifiedHash, loadedHash, boundIdentity: evidence.boundIdentity, href: classic?.href, injectedBytes: injected.length };
  if (evidence.src !== null) return fail('The probe iframe has a navigated src', diagnostics);
  if (classic?.href !== 'about:srcdoc') return fail('The probe document is not a srcdoc document', diagnostics);
  if (loadedHash === null) return fail('The srcdoc is not the verified artifact plus one contiguous host insertion', diagnostics);
  if (loadedHash !== evidence.verifiedHash) return fail('The bytes in srcdoc do not hash to the verified artifact hash', diagnostics);
  if (evidence.boundIdentity?.artifactHash !== evidence.verifiedHash) return fail('The runtime bound a different artifact hash than the one verified', diagnostics);
  if (!injected || evidence.artifact.includes(injected)) return fail('The host prelude is missing or overlaps the signed artifact bytes', diagnostics);
  return pass('Verified bytes reach the frame through srcdoc; the host prelude sits outside them', diagnostics);
}

function injectionOrder(facts: LoadFacts): CheckOutcome {
  if (!facts.all) return NOT_LOADED;
  const { classic, module, granted } = facts.all;
  const diagnostics = { granted, classic: classic?.domains, module: module?.domains };
  if (!classic || !module) return fail('The probe produced no realm snapshot from its first classic or module script', diagnostics);
  if (classic.napplet !== 'object') return fail('window.napplet did not exist when the first authored classic script ran', diagnostics);
  for (const [kind, snapshot] of [['classic', classic], ['module', module]] as const) {
    const missing = granted.filter((domain) => !snapshot.domains.includes(domain));
    if (missing.length) return fail(`Granted domains were absent when the first ${kind} script ran: ${missing.join(', ')}`, diagnostics);
  }
  return pass('Every granted domain object existed before authored classic and module scripts ran', diagnostics);
}

function injectionScope(facts: LoadFacts): CheckOutcome {
  if (!facts.all || !facts.narrow) return NOT_LOADED;
  const cases = [
    { name: 'all-granted', injected: facts.all.classic?.domains ?? [], granted: facts.all.granted, ceiling: facts.advertised },
    { name: 'one-granted', injected: facts.narrow.classic?.domains ?? [], granted: facts.narrow.granted, ceiling: facts.narrow.explicitGrants },
  ];
  for (const item of cases) {
    const diagnostics = { case: item.name, injected: sorted(item.injected), granted: sorted(item.granted), hostGrants: sorted(item.ceiling) };
    if (!sameSet(item.injected, item.granted)) return fail(`Injected objects differ from the endpoint's live grants (${item.name})`, diagnostics);
    const widened = item.granted.filter((domain) => !item.ceiling.includes(domain));
    if (widened.length) return fail(`Domains were exposed beyond the explicit host grants: ${widened.join(', ')} (${item.name})`, diagnostics);
    if (item.injected.includes(UNAVAILABLE_DOMAIN)) return fail('A declared but unavailable domain was injected', diagnostics);
  }
  return pass('Injected objects equal live host grants; optional declarations did not widen them', {
    all: sorted(facts.all.granted), narrow: sorted(facts.narrow.granted),
  });
}

function noWindowNostr(facts: LoadFacts): CheckOutcome {
  if (!facts.all?.classic) return NOT_LOADED;
  const { nostr, nostrPresent, signingGlobals } = facts.all.classic;
  const diagnostics = { typeofNostr: nostr, nostrPresent, signingGlobals };
  if (nostr !== 'undefined' || nostrPresent) return fail('The napplet frame has a window.nostr global', diagnostics);
  if (signingGlobals.length) return fail(`The napplet frame has signing globals: ${signingGlobals.join(', ')}`, diagnostics);
  return pass('No NIP-07 global or signing authority is present in the napplet realm', diagnostics);
}

function portPrivate(facts: LoadFacts): CheckOutcome {
  if (!facts.all?.classic) return NOT_LOADED;
  const ports = facts.all.classic.reachablePorts;
  if (ports.length) return fail('A MessagePort is reachable from napplet code', { reachablePorts: ports });
  return pass('No MessagePort is reachable from window or the injected namespace');
}

function manifestCapabilities(facts: LoadFacts): CheckOutcome {
  if (!facts.narrow) return fail('A probe whose optional domains include an unavailable one did not load; missing O domains must not prevent loading');
  if (!facts.all) return NOT_LOADED;
  const { rejection, warnings, booted } = facts.required;
  const diagnostics = { rejection, warnings, booted };
  if (rejection) return pass(`An unavailable required domain was rejected (${rejection.reason}); a missing optional domain did not block loading`, diagnostics);
  if (warnings.length) return pass('An unavailable required domain produced a warning; a missing optional domain did not block loading', diagnostics);
  return fail('A napplet requiring an unavailable domain loaded with neither a rejection nor a warning', diagnostics);
}

function requiresPreflight(facts: LoadFacts): CheckOutcome {
  if (facts.policy !== 'strict') return skip('The target does not declare a strict required-domain policy');
  const { rejection, booted } = facts.required;
  const diagnostics = { rejection, booted };
  if (!rejection) return fail('The strict target loaded a napplet whose required domain is unavailable', diagnostics);
  if (rejection.executed || booted) return fail('The napplet executed before the required-domain rejection', diagnostics);
  if (rejection.stage !== 'preflight') return fail('The rejection happened after a document was assigned', diagnostics);
  if (!rejection.deniedRequired.includes(UNAVAILABLE_DOMAIN)) return fail('The rejection does not name the missing required domain', diagnostics);
  return pass('An unsupported required domain is rejected before any frame document exists', diagnostics);
}

const authority = ['nip5d'] as const;
const checks: readonly Check<LoadFacts>[] = [
  { id: 'nip5d/sandbox', title: 'Probe iframe is sandboxed with allow-scripts only', scope: 'nip5d-core', severity: 'error', authority, evaluate: sandbox },
  { id: 'nip5d/artifact-provenance', title: 'Verified bytes load through srcdoc with the prelude outside them', scope: 'nip5d-core', severity: 'error', authority, evaluate: provenance },
  { id: 'nip5d/injection-order', title: 'Granted domain objects exist before authored code runs', scope: 'nip5d-core', severity: 'error', authority, evaluate: injectionOrder },
  { id: 'nip5d/injection-scope', title: 'Injected objects exactly match live host grants', scope: 'nip5d-core', severity: 'error', authority, evaluate: injectionScope },
  { id: 'nip5d/no-window-nostr', title: 'No window.nostr or signing authority in the napplet frame', scope: 'nip5d-core', severity: 'error', authority, evaluate: noWindowNostr },
  { id: 'nip5d/port-private', title: 'The retained NAP port is not reachable from napplet code', scope: 'nip5d-core', severity: 'error', authority, evaluate: portPrivate },
  { id: 'nip5d/manifest-capabilities', title: 'Required and optional declarations are checked, never granted', scope: 'nip5d-core', severity: 'error', authority, evaluate: manifestCapabilities },
  { id: 'kehto/requires-preflight', title: 'Unsupported required domains are rejected before execution', scope: 'kehto-policy', severity: 'error', authority, evaluate: requiresPreflight },
];

/** NIP-5D document-loading checks. */
export const NIP5D_LOAD_SCENARIO = defineScenario<LoadFacts>({ id: 'nip5d-load', collect, checks });
