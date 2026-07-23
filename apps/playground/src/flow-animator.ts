/**
 * flow-animator.ts -- Animates the visual protocol flow.
 *
 * Flashes topology nodes and edges as messages move through the layered
 * architecture view.
 */

import type { MessageTap, TappedMessage } from './shell-host.js';
import type { DemoTopology, EdgeFlasher } from './topology.js';
import {
  getAclRuntimeEdgeId,
  getNappletEdgeId,
  getNappletNodeId,
  getRuntimeServiceEdgeId,
  getShellAclEdgeId,
  getShellNodeId,
} from './topology.js';
import { recordEdgeColor, getEdgeColor, onColorStateChange, getPersistenceMode, setNodeOverlayColor } from './color-state.js';
import { animateTrace } from './trace-animator.js';
import { demoConfig } from './demo-config.js';
const TOPOLOGY_NODE_ACL = 'topology-node-acl';
const TOPOLOGY_NODE_RUNTIME = 'topology-node-runtime';
const TOPOLOGY_NODE_SERVICE_SIGNER = 'topology-node-service-signer';
const TOPOLOGY_NODE_SERVICE_NOTIFICATIONS = 'topology-node-service-notifications';

function flashClass(el: Element, cls: string): void {
  el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), demoConfig.get('demo.FLASH_DURATION'));
}

function flashEdge(edgeId: string, cls: 'active' | 'blocked'): void {
  const edge = document.getElementById(edgeId);
  if (edge) flashClass(edge, cls);
}



function getNappletName(topology: DemoTopology, windowId?: string): string | null {
  if (!windowId) return null;
  const frame = document.getElementById(windowId);
  const containerId = frame?.parentElement?.id;
  if (!containerId) return null;

  const napplet = topology.napplets.find((candidate) => candidate.frameContainerId === containerId);
  return napplet?.name ?? null;
}

function detectServiceTarget(topology: DemoTopology, msg: TappedMessage): string | null {
  // Envelope-shape: route by domain prefix.
  if (msg.envelopeType) {
    const domain = msg.parsed.domain ?? msg.envelopeType.split('.')[0];
    // identity envelopes touch the identity service node.
    // Signer node updates separately via signer-connection state.
    if (domain === 'identity' && topology.services.includes('identity')) return 'identity';
    if (domain === 'notify' && topology.services.includes('notifications')) return 'notifications';
    if (domain === 'keys' && topology.services.includes('keys')) return 'keys';
    if (domain === 'media' && topology.services.includes('media')) return 'media';
    if (domain === 'theme' && topology.services.includes('theme')) return 'theme';
    if (domain === 'storage' && topology.services.includes('storage')) return 'storage';
    if (domain === 'relay' && topology.services.includes('relay')) return 'relay';
    return null;
  }

  return null;
}

function isNotificationTopic(msg: TappedMessage): boolean {
  return Boolean(msg.envelopeType) && msg.parsed.domain === 'notify';
}

/**
 * Identify which node in the highlight path is the failure point.
 * ACL denials → ACL node. Infrastructure errors → runtime or relevant service.
 * Falls back to the last node in the path if source is unclear.
 */
function identifyFailureNode(nodes: string[], msg: TappedMessage): number {
  const rawArr = Array.isArray(msg.raw) ? msg.raw : null;
  const reasonString = rawArr && typeof rawArr[3] === 'string' ? rawArr[3] : '';

  // ACL denial: failure at the ACL node
  if (reasonString.startsWith('denied:')) {
    const aclIndex = nodes.indexOf(TOPOLOGY_NODE_ACL);
    if (aclIndex !== -1) return aclIndex;
  }

  // Infrastructure error (no signer, timeout, etc.): failure at runtime or service
  if (
    reasonString.includes('no signer') ||
    reasonString.includes('signer')
  ) {
    const signerIndex = nodes.indexOf(TOPOLOGY_NODE_SERVICE_SIGNER);
    if (signerIndex !== -1) return signerIndex;
  }

  if (
    reasonString.includes('relay') ||
    reasonString.includes('timeout') ||
    reasonString.includes('not wired') ||
    reasonString.includes('mock')
  ) {
    const runtimeIndex = nodes.indexOf(TOPOLOGY_NODE_RUNTIME);
    if (runtimeIndex !== -1) return runtimeIndex;
  }

  // Fallback: last node in path
  return nodes.length - 1;
}

export function buildHighlightPath(topology: DemoTopology, msg: TappedMessage): { nodes: string[]; edges: string[] } | null {
  const nappletName = getNappletName(topology, msg.windowId);
  if (!nappletName && isNotificationTopic(msg)) {
    const nodes = [
      TOPOLOGY_NODE_ACL,
      TOPOLOGY_NODE_RUNTIME,
      TOPOLOGY_NODE_SERVICE_NOTIFICATIONS,
    ];
    const edges = [
      getAclRuntimeEdgeId(),
      getRuntimeServiceEdgeId('notifications'),
    ];
    return msg.direction === 'napplet->shell'
      ? { nodes, edges }
      : { nodes: [...nodes].reverse(), edges: [...edges].reverse() };
  }
  if (!nappletName) return null;

  const serviceTarget = detectServiceTarget(topology, msg);
  const nodes: string[] = [
    getNappletNodeId(nappletName),
    getShellNodeId(),
    TOPOLOGY_NODE_ACL,
    TOPOLOGY_NODE_RUNTIME,
  ];
  const edges: string[] = [
    getNappletEdgeId(nappletName),
    getShellAclEdgeId(),
    getAclRuntimeEdgeId(),
  ];

  function getServiceNodeIdForTarget(target: string): string {
    if (target === 'signer') return TOPOLOGY_NODE_SERVICE_SIGNER;
    if (target === 'notifications') return TOPOLOGY_NODE_SERVICE_NOTIFICATIONS;
    return `topology-node-service-${target}`;
  }

  if (msg.direction === 'napplet->shell' && serviceTarget) {
    nodes.push(getServiceNodeIdForTarget(serviceTarget));
    edges.push(getRuntimeServiceEdgeId(serviceTarget));
  }

  if (msg.direction === 'shell->napplet' && serviceTarget) {
    nodes.unshift(getServiceNodeIdForTarget(serviceTarget));
    edges.unshift(getRuntimeServiceEdgeId(serviceTarget));
  }

  return { nodes, edges };
}

export function initFlowAnimator(tap: MessageTap, topology: DemoTopology, edgeFlasher?: EdgeFlasher): void {
  const flowLog = document.getElementById('shell-flow-log');

  // Live counters grouped by verb
  const counters: Record<string, { in: number; out: number; blocked: number }> = {};
  let totalMessages = 0;

  function renderCounters(): void {
    if (!flowLog) return;
    const verbs = Object.keys(counters).sort();
    const total = document.createElement('div');
    total.style.cssText = 'color:var(--nap-theme-muted, #666);margin-bottom:4px';
    total.textContent = `${totalMessages} total messages`;
    const rows = verbs.map((verb) => {
      const counter = counters[verb];
      const row = document.createElement('div');
      const label = document.createElement('span');
      label.style.cssText = 'color:var(--nap-theme-accent-secondary, #b388ff);font-weight:600';
      label.textContent = verb;
      row.appendChild(label);
      if (counter.in > 0) {
        const inbound = document.createElement('span');
        inbound.style.color = 'var(--nap-theme-success, #39ff14)';
        inbound.textContent = `↓${counter.in}`;
        row.append(document.createTextNode(' '), inbound);
      }
      if (counter.out > 0) {
        const outbound = document.createElement('span');
        outbound.style.color = 'var(--nap-theme-info, #00f0ff)';
        outbound.textContent = `↑${counter.out}`;
        row.append(document.createTextNode(' '), outbound);
      }
      if (counter.blocked > 0) {
        const blocked = document.createElement('span');
        blocked.style.color = 'var(--nap-theme-danger, #ff3b3b)';
        blocked.textContent = `✗${counter.blocked}`;
        row.append(document.createTextNode(' '), blocked);
      }
      return row;
    });
    flowLog.replaceChildren(total, ...rows);
  }

  tap.onMessage((msg) => {
    const rawArr = Array.isArray(msg.raw) ? msg.raw : null;
    const isOkFalse = msg.verb === 'OK' && rawArr?.[2] === false;
    const isClosedDenied = msg.verb === 'CLOSED' && typeof rawArr?.[2] === 'string' &&
      (String(rawArr[2]).includes('denied') || String(rawArr[2]).startsWith('blocked:'));
    const isBlocked = isOkFalse || isClosedDenied;

    // Simple: red for any failure, green for success. No amber.
    const cls: 'active' | 'blocked' = isBlocked ? 'blocked' : 'active';

    const highlightPath = buildHighlightPath(topology, msg);

    if (highlightPath && edgeFlasher) {
      const { nodes, edges } = highlightPath;
      const isFailure = cls === 'blocked';
      const mode = getPersistenceMode();
      const failureNodeIndex = isFailure ? identifyFailureNode(nodes, msg) : edges.length;
      const direction = msg.direction === 'napplet->shell' ? 'out' as const : 'in' as const;

      if (mode === 'trace') {
        // Trace: hop-by-hop sweep animation with node overlays
        animateTrace(edgeFlasher, edges, nodes, topology, cls, failureNodeIndex, direction);
      } else if (mode === 'flash') {
        // Flash: all edges flash simultaneously, revert after FLASH_DURATION. Like the original.
        for (let i = 0; i < edges.length; i++) {
          const edgeColor = i < failureNodeIndex ? 'active' as const : cls;
          edgeFlasher.flashDirection(edges[i], direction, edgeColor);
        }
        // Flash node overlays too
        for (let i = 0; i < nodes.length; i++) {
          const nodeColor = i < failureNodeIndex ? 'active' as const : cls;
          const overlayDir = direction === 'out' ? 'outbound' : 'inbound';
          setNodeOverlayColor(nodes[i], overlayDir, nodeColor);
        }
        // Revert node overlays after flash duration
        setTimeout(() => {
          for (const nodeId of nodes) {
            const overlayDir = direction === 'out' ? 'outbound' : 'inbound';
            setNodeOverlayColor(nodeId, overlayDir, null);
          }
        }, demoConfig.get('demo.FLASH_DURATION'));
      } else {
        // Persistent modes (rolling, decay, last-message): record state, rendered by onColorStateChange
        for (let i = 0; i < edges.length; i++) {
          if (i < failureNodeIndex) {
            recordEdgeColor(edges[i], direction, 'active');
          } else {
            recordEdgeColor(edges[i], direction, cls);
          }
        }
      }
    } else if (highlightPath) {
      // Fallback without edgeFlasher (unlikely but safe)
      highlightPath.edges.forEach((edgeId) => flashEdge(edgeId, cls));
    }

    totalMessages++;
    // Group by envelope type when available, otherwise by NIP-01 verb
    const counterKey = msg.envelopeType ?? msg.verb;
    if (!counters[counterKey]) counters[counterKey] = { in: 0, out: 0, blocked: 0 };
    if (isBlocked) counters[counterKey].blocked++;
    else if (msg.direction === 'napplet->shell') counters[counterKey].out++;
    else counters[counterKey].in++;
    renderCounters();

    // Log notification service activity with its direct-domain envelope type.
    if (isNotificationTopic(msg) && flowLog) {
      const topicLabel = msg.envelopeType ?? 'notify.unknown';
      const existing = flowLog.querySelector(`[data-notif-topic="${topicLabel}"]`);
      if (!existing) {
        const entry = document.createElement('div');
        entry.dataset.notifTopic = topicLabel;
        entry.style.cssText = 'color:var(--nap-theme-success, #39ff14);font-size:10px;margin-top:2px';
        entry.textContent = topicLabel;
        flowLog.appendChild(entry);
      }
    }
  });

  if (edgeFlasher) {
    onColorStateChange(() => {
      for (const edge of topology.edges) {
        for (const dir of ['out', 'in'] as const) {
          const color = getEdgeColor(edge.id, dir);
          edgeFlasher.setColor(edge.id, dir, color);
        }
      }
    });
  }
}
