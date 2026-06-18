
import type { TappedMessage, NappletInfo } from './shell-host.js';
import { demoConfig } from './demo-config.js';

const VERB_COLORS: Record<string, string> = {
  AUTH: 'var(--nap-theme-accent-secondary, #b388ff)',
  EVENT: 'var(--nap-theme-success, #39ff14)',
  REQ: 'var(--nap-theme-info, #00f0ff)',
  CLOSE: 'var(--nap-theme-danger, #ff3b3b)',
  OK: 'var(--nap-theme-muted, #888899)',
  EOSE: 'var(--nap-theme-warning, #ffbf00)',
  NOTICE: 'var(--nap-theme-warning, #ffbf00)',
  CLOSED: 'var(--nap-theme-danger, #ff3b3b)',
  COUNT: 'var(--nap-theme-info, #00f0ff)',
  SYSTEM: 'var(--nap-theme-accent-secondary, #b388ff)',
  ENVELOPE: 'var(--nap-theme-info, #00f0ff)',
};

const ARROW_HEAD_SIZE = 7;
const MIN_VIEWBOX_WIDTH = 1000;

export interface SequenceDiagramOptions {
  width?: number;
}

/**
 * Derive the lane list for a set of tapped messages.
 *
 * Napplet lanes come from resolving msg.windowId → NappletInfo.name; Shell
 * is always centred. Napplet names are sorted alphabetical, then split at
 * the midpoint index so the list is deterministic and balanced across the
 * shell axis.
 *
 * @param messages - Tapped messages to scan for windowId references
 * @param nappletInfos - windowId → NappletInfo map (from shell-host getNapplets())
 * @returns Ordered lane-name list, with 'Shell' always present and centred
 */
function deriveLanes(
  messages: TappedMessage[],
  nappletInfos: Map<string, NappletInfo>,
): string[] {
  const napplets = new Set<string>();
  for (const m of messages) {
    if (!m.windowId) continue;
    const info = nappletInfos.get(m.windowId);
    if (info?.name) napplets.add(info.name);
  }
  const sorted = Array.from(napplets).sort();
  const mid = Math.ceil(sorted.length / 2);
  return [...sorted.slice(0, mid), 'Shell', ...sorted.slice(mid)];
}

/** Even-spacing X-coordinate for a lane index (0-based) in a laneCount-lane diagram. */
function laneX(index: number, laneCount: number, vbWidth: number): number {
  return ((index + 1) / (laneCount + 1)) * vbWidth;
}

/** Locate the lane index for a given napplet name (or 'Shell'); -1 if not present. */
function laneIndexOf(lanes: string[], name: string): number {
  return lanes.indexOf(name);
}

/**
 * Resolve from/to lane X-coordinates for a message given the dynamic lane list.
 *
 * Envelope-shape messages (NUB) are always shell↔napplet; lane is resolved
 * via msg.windowId → NappletInfo.name. Legacy NIP-01 bot:response and
 * chat:message topics are preserved as special cases where the named
 * napplet is still present in the lane list.
 *
 * Returns {from, to} in viewBox coordinates; falls back to the shell lane
 * on both sides if the message cannot be attributed to a napplet lane
 * (e.g. system messages without windowId).
 */
function getLaneEndpoints(
  msg: TappedMessage,
  lanes: string[],
  nappletInfos: Map<string, NappletInfo>,
  vbWidth: number,
): { from: number; to: number } {
  const shellIdx = laneIndexOf(lanes, 'Shell');
  const shellX = laneX(shellIdx, lanes.length, vbWidth);

  // Resolve napplet lane via windowId → name
  let nappletIdx = -1;
  if (msg.windowId) {
    const info = nappletInfos.get(msg.windowId);
    if (info?.name) nappletIdx = laneIndexOf(lanes, info.name);
  }

  // Legacy NIP-01 topic hints (preserved for any remaining non-envelope traffic)
  if (nappletIdx < 0 && !msg.envelopeType) {
    if (msg.parsed.topic === 'bot:response') nappletIdx = laneIndexOf(lanes, 'bot');
    else if (msg.parsed.topic === 'chat:message') nappletIdx = laneIndexOf(lanes, 'chat');
  }

  if (nappletIdx < 0) {
    // Unattributable — draw a self-loop at the shell lane.
    return { from: shellX, to: shellX };
  }

  const nappletX = laneX(nappletIdx, lanes.length, vbWidth);
  return msg.direction === 'napplet->shell'
    ? { from: nappletX, to: shellX }
    : { from: shellX, to: nappletX };
}

function createArrow(fromX: number, toX: number, y: number, color: string): string {
  const direction = toX > fromX ? 1 : -1;
  const endX = toX - (ARROW_HEAD_SIZE * direction);
  let svg = `<line x1="${fromX}" y1="${y}" x2="${endX}" y2="${y}" stroke="${color}" stroke-width="2" />`;
  svg += `<polygon points="${toX},${y} ${endX},${y - ARROW_HEAD_SIZE / 2} ${endX},${y + ARROW_HEAD_SIZE / 2}" fill="${color}" />`;
  return svg;
}

/**
 * Render a dynamic-lane SVG swimlane diagram of protocol traffic.
 *
 * @param messages - Tapped messages to plot
 * @param nappletInfos - windowId → NappletInfo map; drives lane derivation.
 *                      Pass shell-host.getNapplets() from the caller.
 * @returns SVG markup as a string (safe to set via innerHTML).
 */
export function renderSequenceDiagram(
  messages: TappedMessage[],
  nappletInfos: Map<string, NappletInfo>,
  options: SequenceDiagramOptions = {},
): string {
  const protocolMessages = messages.filter((m) => m.verb !== 'SYSTEM');
  const HEADER_HEIGHT = demoConfig.get('demo.HEADER_HEIGHT');
  const ROW_HEIGHT = demoConfig.get('demo.ROW_HEIGHT');
  const height = HEADER_HEIGHT + (protocolMessages.length * ROW_HEIGHT) + 20;
  const vbWidth = Math.max(MIN_VIEWBOX_WIDTH, Math.floor(options.width ?? MIN_VIEWBOX_WIDTH));

  const lanes = deriveLanes(protocolMessages, nappletInfos);
  // Defensive fallback: if no napplets observed yet, draw a single Shell lane.
  const effectiveLanes = lanes.length > 0 ? lanes : ['Shell'];

  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="${height}" viewBox="0 0 ${vbWidth} ${height}" preserveAspectRatio="xMidYMin meet">`;
  svg += `<rect width="${vbWidth}" height="${height}" fill="var(--nap-theme-background, #0a0a0f)" />`;

  for (let i = 0; i < effectiveLanes.length; i++) {
    const x = laneX(i, effectiveLanes.length, vbWidth);
    svg += `<text x="${x}" y="16" text-anchor="middle" fill="var(--nap-theme-primary, #00f0ff)" font-family="monospace" font-size="13" font-weight="bold">${escapeXml(effectiveLanes[i])}</text>`;
  }

  for (let i = 0; i < effectiveLanes.length; i++) {
    const x = laneX(i, effectiveLanes.length, vbWidth);
    svg += `<line x1="${x}" y1="${HEADER_HEIGHT - 10}" x2="${x}" y2="${height}" stroke="var(--nap-theme-border, #2a2a3a)" stroke-width="1" stroke-dasharray="4,4" />`;
  }

  svg += `<line x1="0" y1="${HEADER_HEIGHT - 5}" x2="${vbWidth}" y2="${HEADER_HEIGHT - 5}" stroke="var(--nap-theme-border, #2a2a3a)" stroke-width="1" />`;

  for (let i = 0; i < protocolMessages.length; i++) {
    const msg = protocolMessages[i];
    const y = HEADER_HEIGHT + (i * ROW_HEIGHT) + ROW_HEIGHT / 2;
    const color = VERB_COLORS[msg.verb] || 'var(--nap-theme-muted, #555555)';
    const { from, to } = getLaneEndpoints(msg, effectiveLanes, nappletInfos, vbWidth);

    if (from !== to) {
      svg += createArrow(from, to, y, color);
    } else {
      svg += `<path d="M${from},${y - 4} C${from + 40},${y - 14} ${from + 40},${y + 14} ${from},${y + 4}" stroke="${color}" stroke-width="2" fill="none" />`;
    }

    // Label centered between lanes
    const labelX = Math.min(from, to) + Math.abs(to - from) / 2;
    const label = formatLabel(msg);
    svg += `<text x="${labelX}" y="${y - 6}" text-anchor="middle" fill="${color}" font-family="monospace" font-size="10">${escapeXml(label)}</text>`;
  }

  svg += '</svg>';
  return svg;
}

function formatLabel(msg: TappedMessage): string {
  // Envelope-shape messages: display the envelope type string directly
  if (msg.envelopeType) return msg.envelopeType;
  const rawArr = Array.isArray(msg.raw) ? msg.raw : null;
  const event = msg.verb === 'EVENT' && rawArr
    ? ((msg.direction === 'shell->napplet' ? rawArr[2] : rawArr[1]) as { kind?: number; tags?: string[][] } | undefined)
    : undefined;
  const topic = event?.tags?.find((tag) => tag[0] === 't')?.[1] ?? msg.parsed.topic;
  switch (msg.verb) {
    case 'AUTH':
      if (rawArr && typeof rawArr[1] === 'string') return 'AUTH challenge';
      return 'AUTH response';
    case 'OK':
      return msg.parsed.success ? 'OK (accepted)' : 'OK (denied)';
    case 'EVENT':
      // Raw kind labels for any NIP-01 event traffic.
      if (event?.kind === 29003) return `inc:${topic ?? 'unknown'}`;
      if (msg.parsed.topic) return `relay ${msg.parsed.topic}`;
      return `EVENT k:${msg.parsed.eventKind || '?'}`;
    case 'REQ':
      return `REQ ${msg.parsed.subId || ''}`.trim();
    case 'EOSE':
      return 'EOSE';
    case 'CLOSE':
      return 'CLOSE';
    case 'CLOSED':
      return `CLOSED ${(msg.parsed.reason || '').substring(0, 20)}`;
    case 'NOTICE':
      return 'NOTICE';
    default:
      return msg.verb;
  }
}

function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
