
import type { DemoTopology, DemoTopologyNode, TopologyNodeRole } from './topology.js';
import type { DemoProtocolPath, MessageTap, NappletInfo, TappedMessage } from './shell-host.js';
import { getAclDenials, getGlobalAclDenials, type AclHistoryEntry } from './acl-history.js';
import { DEMO_CAPABILITY_LABELS } from './acl-panel.js';
import type { Capability } from '@kehto/shell';

export interface NodeActivityEntry {
  path: DemoProtocolPath | string;
  direction: TappedMessage['direction'];
  blocked: boolean;
  timestamp: number;
}

const ACTIVITY_RING_SIZE = 12;

/**
 * Envelope-domain → topology-service-id aliases.
 *
 * NAP envelope `type` is domain-dot-action (e.g. `notify.sent`). The topology
 * service name is usually identical to the domain, except `notify` envelopes
 * route to the `notifications` service node (the topology service is named
 * `notifications` for legacy-UI consistency; the NAP domain is `notify`).
 * Add more aliases here if future domain-vs-topology-id drift appears.
 */
const SERVICE_DOMAIN_ALIAS: Record<string, string> = {
  notify: 'notifications',
};

// Per-node bounded ring buffer of recent activity
const nodeActivityRings = new Map<string, NodeActivityEntry[]>();

function pushActivity(nodeId: string, entry: NodeActivityEntry): void {
  let ring = nodeActivityRings.get(nodeId);
  if (!ring) {
    ring = [];
    nodeActivityRings.set(nodeId, ring);
  }
  ring.push(entry);
  if (ring.length > ACTIVITY_RING_SIZE) ring.shift();
}

export function getNodeActivity(nodeId: string): NodeActivityEntry[] {
  return nodeActivityRings.get(nodeId) ?? [];
}

export interface SummaryField {
  label: string;
  value: string;
}

export interface NodeDetail {
  /** Stable topology node id, e.g. "topology-node-shell" */
  id: string;
  /** Node role for role-specific rendering */
  role: TopologyNodeRole;
  /** Human-readable node title / label */
  title: string;
  /** 2-4 compact summary fields for collapsed node view */
  summaryFields: SummaryField[];
  /** Richer sections for the inspector panel */
  inspectorSections: InspectorSection[];
  /** Recent per-node activity derived from live tap signals */
  recentActivity: NodeActivityEntry[];
  /** ACL denial history entries for this node (napplet role only). */
  aclDenials: AclHistoryEntry[];
  /** Whether drill-down / inspector is supported for this node */
  drillDownSupported: boolean;
  /** Recent tapped envelopes for this napplet (napplet role only). */
  recentEnvelopes?: TappedMessage[];
}

export interface InspectorSection {
  heading: string;
  items: SummaryField[];
}

interface NodeDetailSources {
  /** All current napplets mapped by windowId */
  napplets: Map<string, NappletInfo>;
  /** Number of registered services */
  serviceCount: number;
  /** Registered service names */
  serviceNames: string[];
  /** Host public key (truncated) */
  hostPubkey: string;
  /** Total tapped message count */
  totalMessages: number;
  /** Total blocked messages */
  totalBlocked: number;
}

function truncate(s: string, max = 20): string {
  return s.length > max ? `${s.substring(0, max)}…` : s;
}

function nodeDetailBase(
  node: DemoTopologyNode,
  role: TopologyNodeRole,
  summaryFields: SummaryField[],
  inspectorSections: InspectorSection[],
  activity: NodeActivityEntry[],
  aclDenials: AclHistoryEntry[] = [],
): NodeDetail {
  return {
    id: node.id,
    role,
    title: node.label,
    summaryFields,
    inspectorSections,
    recentActivity: activity,
    aclDenials,
    drillDownSupported: true,
  };
}

function buildNappletDetail(
  node: DemoTopologyNode,
  sources: NodeDetailSources,
  options?: NodeDetailOptions,
): NodeDetail {
  return buildHostedSurfaceDetail(node, sources, options, 'napplet');
}

function buildHostedSurfaceDetail(
  node: DemoTopologyNode,
  sources: NodeDetailSources,
  options: NodeDetailOptions | undefined,
  role: 'napplet' | 'runtime-demo',
): NodeDetail {
  const name = node.name ?? node.label;
  // Find the matching NappletInfo for this topology node
  let info: NappletInfo | undefined;
  let nappletWindowId = '';
  for (const [wid, ni] of sources.napplets) {
    if (ni.name === name) { info = ni; nappletWindowId = wid; break; }
  }

  const identityStatus = info?.identityBound ? 'identity-bound' : 'pending';
  const pubkeyDisplay = info?.pubkey ? truncate(info.pubkey, 12) : '—';
  const denials = nappletWindowId ? getAclDenials(nappletWindowId) : [];
  const activity = getNodeActivity(node.id);

  const summaryFields: SummaryField[] = [
    { label: 'identity', value: identityStatus },
    { label: 'pubkey', value: pubkeyDisplay },
    { label: 'activity', value: `${activity.length} recent` },
  ];

  const inspectorSections: InspectorSection[] = [
    {
      heading: 'Current State',
      items: [
        { label: 'identity', value: identityStatus },
        { label: 'pubkey', value: info?.pubkey ? truncate(info.pubkey, 24) : '—' },
        { label: 'dTag', value: info?.dTag ?? '—' },
        { label: 'aggregateHash', value: info?.aggregateHash ? truncate(info.aggregateHash, 16) : '—' },
      ],
    },
  ];

  if (role === 'napplet') {
    inspectorSections.push({
      heading: 'ACL Capabilities',
      items: (() => {
        if (!info?.pubkey || !options?.checkCapability) {
          return [{ label: 'status', value: info?.pubkey ? 'checking...' : 'not identity-bound' }];
        }
        const dTag = info.dTag ?? '';
        const hash = info.aggregateHash ?? '';
        const allCaps: Capability[] = [
          'relay:read', 'relay:write', 'cache:read', 'cache:write',
          'hotkey:forward', 'state:read', 'state:write',
          'identity:read', 'keys:bind', 'keys:forward',
          'media:control', 'notify:send', 'notify:channel', 'theme:read',
        ];
        const items: SummaryField[] = [];
        for (const cap of allCaps) {
          const allowed = options.checkCapability(info.pubkey, dTag, hash, cap);
          const label = DEMO_CAPABILITY_LABELS[cap as Capability] ?? cap;
          items.push({ label, value: allowed ? 'granted' : 'revoked' });
        }
        items.push({ label: 'recorded denials', value: `${denials.length}` });
        return items;
      })(),
    });
  }

  // Populate recent envelopes from tap (last 10 envelope-type messages for this windowId)
  const recentEnvelopes = options?.tap
    ? options.tap.messages
        .filter(m => m.windowId === nappletWindowId && !!m.envelopeType)
        .slice(-10)
    : [];

  return {
    id: node.id,
    role,
    title: node.label,
    summaryFields,
    inspectorSections,
    recentActivity: activity,
    aclDenials: role === 'napplet' ? denials : [],
    drillDownSupported: true,
    recentEnvelopes,
  };
}

function buildShellDetail(
  node: DemoTopologyNode,
  sources: NodeDetailSources,
): NodeDetail {
  const nappletCount = sources.napplets.size;
  const pubkeyDisplay = truncate(sources.hostPubkey, 16);
  const activity = getNodeActivity(node.id);

  const summaryFields: SummaryField[] = [
    { label: 'pubkey', value: pubkeyDisplay },
    { label: 'napplets', value: `${nappletCount}` },
    { label: 'messages', value: `${sources.totalMessages}` },
  ];

  const inspectorSections: InspectorSection[] = [
    {
      heading: 'Current State',
      items: [
        { label: 'host pubkey', value: sources.hostPubkey ? truncate(sources.hostPubkey, 32) : '—' },
        { label: 'loaded napplets', value: `${nappletCount}` },
        { label: 'total messages', value: `${sources.totalMessages}` },
        { label: 'blocked messages', value: `${sources.totalBlocked}` },
      ],
    },
  ];

  return nodeDetailBase(node, 'shell', summaryFields, inspectorSections, activity);
}

function buildAclDetail(
  node: DemoTopologyNode,
  sources: NodeDetailSources,
): NodeDetail {
  const activity = getNodeActivity(node.id);
  const blockedMessages = sources.totalBlocked;
  const blockedActivity = activity.filter((entry) => entry.blocked).length;
  const globalDenials = getGlobalAclDenials();

  const summaryFields: SummaryField[] = [
    { label: 'denied', value: `${blockedMessages}` },
    { label: 'recent blocks', value: `${blockedActivity}` },
    { label: 'napplets', value: `${sources.napplets.size}` },
  ];

  const inspectorSections: InspectorSection[] = [
    {
      heading: 'Current State',
      items: [
        { label: 'total denied', value: `${blockedMessages}` },
        { label: 'recent denials (buffer)', value: `${globalDenials.length}` },
        { label: 'napplets under gate', value: `${sources.napplets.size}` },
      ],
    },
  ];

  return nodeDetailBase(node, 'acl', summaryFields, inspectorSections, activity, globalDenials);
}

function buildRuntimeDetail(
  node: DemoTopologyNode,
  sources: NodeDetailSources,
): NodeDetail {
  const activity = getNodeActivity(node.id);
  const identityBoundCount = [...sources.napplets.values()].filter((n) => n.identityBound).length;

  const summaryFields: SummaryField[] = [
    { label: 'services', value: `${sources.serviceCount}` },
    { label: 'identity-bound napplets', value: `${identityBoundCount}` },
    { label: 'messages routed', value: `${sources.totalMessages}` },
  ];

  const inspectorSections: InspectorSection[] = [
    {
      heading: 'Current State',
      items: [
        { label: 'registered services', value: sources.serviceNames.join(', ') || 'none' },
        { label: 'identity-bound napplets', value: `${identityBoundCount}` },
        { label: 'total messages routed', value: `${sources.totalMessages}` },
      ],
    },
  ];

  return nodeDetailBase(node, 'runtime', summaryFields, inspectorSections, activity);
}

function buildServiceDetail(
  node: DemoTopologyNode,
  _sources: NodeDetailSources,
): NodeDetail {
  const name = node.name ?? node.label;
  const activity = getNodeActivity(node.id);
  const lastAction = activity.length > 0
    ? activity[activity.length - 1].path
    : '—';

  const summaryFields: SummaryField[] = [
    { label: 'service', value: name },
    { label: 'last action', value: lastAction },
    { label: 'activity', value: `${activity.length} recent` },
  ];

  const inspectorSections: InspectorSection[] = [
    {
      heading: 'Current State',
      items: [
        { label: 'service name', value: name },
        { label: 'last action', value: lastAction },
        { label: 'recent actions', value: `${activity.length}` },
      ],
    },
  ];

  return nodeDetailBase(node, 'service', summaryFields, inspectorSections, activity);
}

export interface NodeDetailOptions {
  napplets: Map<string, NappletInfo>;
  serviceNames: string[];
  hostPubkey: string;
  totalMessages: number;
  totalBlocked: number;
  /** Check a capability for a napplet. Returns true if allowed. */
  checkCapability?: (pubkey: string, dTag: string, hash: string, cap: string) => boolean;
  /** Message tap for recent envelope queries (napplet role). */
  tap?: MessageTap;
}

/**
 * Build a node detail record for a single topology node.
 *
 * @param node - Topology node with stable id and role
 * @param options - Live demo state sources
 * @returns NodeDetail record for collapsed summary and inspector
 */
export function buildNodeDetails(
  node: DemoTopologyNode,
  options: NodeDetailOptions,
): NodeDetail {
  const sources: NodeDetailSources = {
    napplets: options.napplets,
    serviceCount: options.serviceNames.length,
    serviceNames: options.serviceNames,
    hostPubkey: options.hostPubkey,
    totalMessages: options.totalMessages,
    totalBlocked: options.totalBlocked,
  };

  switch (node.role) {
    case 'napplet': return buildNappletDetail(node, sources, options);
    case 'runtime-demo': return buildHostedSurfaceDetail(node, sources, options, 'runtime-demo');
    case 'shell': return buildShellDetail(node, sources);
    case 'acl': return buildAclDetail(node, sources);
    case 'runtime': return buildRuntimeDetail(node, sources);
    case 'service': return buildServiceDetail(node, sources);
  }
}

/**
 * Build node detail records for all nodes in a topology.
 *
 * @param topology - Full demo topology
 * @param options - Live demo state sources
 * @returns Map from node id to NodeDetail
 */
export function buildAllNodeDetails(
  topology: DemoTopology,
  options: NodeDetailOptions,
): Map<string, NodeDetail> {
  const result = new Map<string, NodeDetail>();
  for (const node of topology.nodes) {
    result.set(node.id, buildNodeDetails(node, options));
  }
  return result;
}

/**
 * Wire up the activity projection — call once after the tap is installed.
 * Classifies each tapped message and pushes entries to the relevant node rings.
 *
 * @param tap - Live message tap from shell-host
 * @param topology - Demo topology for node id lookup
 * @param classifyPath - Path classifier from debugger (classifyTappedMessagePath); passed in to avoid circular imports
 */
export function installActivityProjection(
  tap: MessageTap,
  topology: DemoTopology,
  classifyPath: (msg: TappedMessage) => DemoProtocolPath | null,
): () => void {
  return tap.onMessage((msg) => {
    const path = classifyPath(msg) ?? msg.verb;
    const rawArr = Array.isArray(msg.raw) ? msg.raw : null;
    const isOkFalse = msg.verb === 'OK' && rawArr?.[2] === false;
    const isClosedDenied =
      msg.verb === 'CLOSED' &&
      typeof rawArr?.[2] === 'string' &&
      (String(rawArr[2]).includes('denied') || String(rawArr[2]).startsWith('blocked:'));
    const blocked = isOkFalse || isClosedDenied;

    const entry: NodeActivityEntry = {
      path,
      direction: msg.direction,
      blocked,
      timestamp: msg.timestamp,
    };

    // Shell node sees every message
    pushActivity('topology-node-shell', entry);

    // ACL and runtime node see every message
    pushActivity('topology-node-acl', entry);
    pushActivity('topology-node-runtime', entry);

    // Service node: identity/signing-related messages
    if (
      (path === 'identity-request' || path === 'relay-publish-signed') &&
      topology.services.includes('signer')
    ) {
      pushActivity('topology-node-service-signer', entry);
    }

    // Service node: route every envelope-shape message to its domain-matching
    // service node ring (identity / keys / media / notifications / relay /
    // storage / theme). The signer node above is kept on path-classification
    // rather than domain because its traffic predates NAP envelope shape.
    if (msg.envelopeType) {
      const rawDomain = msg.parsed.domain ?? msg.envelopeType.split('.')[0];
      if (rawDomain) {
        const serviceKey = SERVICE_DOMAIN_ALIAS[rawDomain] ?? rawDomain;
        if (topology.services.includes(serviceKey)) {
          pushActivity(`topology-node-service-${serviceKey}`, entry);
        }
      }
    }

    // Napplet node: messages belonging to a specific window
    if (msg.windowId) {
      for (const node of topology.nodes) {
        if (node.role === 'napplet' && node.name) {
          // Match windowId naming pattern: demo-{name}-{counter}
          if (msg.windowId.startsWith(`demo-${node.name}-`)) {
            pushActivity(node.id, entry);
          }
        }
      }
    }
  });
}
