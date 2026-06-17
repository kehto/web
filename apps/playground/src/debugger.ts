
import { getNapplets, type DemoProtocolPath, type MessageTap, type TappedMessage } from './shell-host.js';
import { renderSequenceDiagram } from './sequence-diagram.js';
import { replaceChildrenFromTrustedHtml } from './dom-utils.js';

/** Verb-to-color mapping for the dark terminal theme */
const VERB_COLORS: Record<string, string> = {
  AUTH: 'var(--nap-theme-accent-secondary, #b388ff)',     // purple
  EVENT: 'var(--nap-theme-success, #39ff14)',    // neon green
  REQ: 'var(--nap-theme-info, #00f0ff)',      // neon blue
  CLOSE: 'var(--nap-theme-danger, #ff3b3b)',    // red
  OK: 'var(--nap-theme-muted, #888899)',       // gray
  EOSE: 'var(--nap-theme-warning, #ffbf00)',     // amber
  NOTICE: 'var(--nap-theme-warning, #ffbf00)',   // amber
  CLOSED: 'var(--nap-theme-danger, #ff3b3b)',   // red
  COUNT: 'var(--nap-theme-info, #00f0ff)',      // blue
  SYSTEM: 'var(--nap-theme-accent-secondary, #ff00ff)',   // pink (for ACL changes)
  ENVELOPE: 'var(--nap-theme-info, #00f0ff)', // cyan — NIP-5D envelope-shape messages
  UNKNOWN: 'var(--nap-theme-muted, #555555)',  // dim gray
};

const DIRECTION_ARROWS: Record<string, string> = {
  'napplet->shell': '-->',
  'shell->napplet': '<--',
};

export const DEBUGGER_PATH_LABELS: DemoProtocolPath[] = [
  'identity-bind',
  'relay-publish',
  'relay-subscribe',
  'ifc-send',
  'ifc-receive',
  'state-read',
  'state-write',
  'identity-request',
  'relay-publish-signed',
];

function extractEvent(msg: TappedMessage): Record<string, unknown> | null {
  if (msg.verb !== 'EVENT' || !Array.isArray(msg.raw)) return null;
  const candidate = msg.direction === 'shell->napplet' ? msg.raw[2] : msg.raw[1];
  if (candidate && typeof candidate === 'object') return candidate as Record<string, unknown>;
  return null;
}

function pathFromReason(reason?: string): DemoProtocolPath | null {
  if (!reason) return null;
  if (reason.includes('state:read')) return 'state-read';
  if (reason.includes('state:write')) return 'state-write';
  if (reason.includes('sign:event')) return 'identity-request';
  if (reason.includes('relay:read')) return 'relay-subscribe';
  if (reason.includes('relay:write')) return 'relay-publish';
  return null;
}

export function classifyTappedMessagePath(msg: TappedMessage): DemoProtocolPath | null {
  // Envelope-shape messages: dispatch on envelope domain + action
  if (msg.envelopeType) {
    const [domain, action] = msg.envelopeType.split('.', 2);
    if (domain === 'identity') return 'identity-request';
    if (domain === 'relay') {
      if (action === 'publish' || action === 'publishEncrypted') return 'relay-publish';
      if (action === 'subscribe' || action === 'event' || action === 'eose') return 'relay-subscribe';
      return msg.direction === 'napplet->shell' ? 'relay-publish' : 'relay-subscribe';
    }
    if (domain === 'storage') {
      if (action === 'getItem' || action === 'keys' || action === 'getItem.result' || action === 'keys.result') return 'state-read';
      if (action === 'setItem' || action === 'removeItem' || action === 'clear') return 'state-write';
      return 'state-read';
    }
    if (domain === 'ifc' || domain === 'inc') {
      // The migrated playground napplets now post inc.* envelopes; the legacy
      // nub-* fixtures still post ifc.*. Both classify to the same audit path
      // labels (ifc-send/ifc-receive) so demo-audit-correctness stays valid.
      return msg.direction === 'napplet->shell' ? 'ifc-send' : 'ifc-receive';
    }
    if (domain === 'notify') return 'ifc-receive';
    if (domain === 'theme' || domain === 'keys' || domain === 'media') {
      return msg.direction === 'napplet->shell' ? 'ifc-send' : 'ifc-receive';
    }
    if (domain === 'shell') return 'identity-bind';
    return null;
  }

  // Legacy NIP-01 fallback (retained for any residual array traffic)
  if (msg.verb === 'AUTH') return 'identity-bind';
  if (msg.verb === 'REQ' || msg.verb === 'EOSE' || msg.verb === 'CLOSE' || msg.verb === 'CLOSED') {
    return 'relay-subscribe';
  }
  if (msg.verb === 'OK') {
    return pathFromReason(msg.parsed.reason);
  }
  if (msg.verb !== 'EVENT') return null;

  const event = extractEvent(msg);
  const kind = typeof event?.kind === 'number' ? (event.kind as number) : msg.parsed.eventKind;
  const topic = typeof event?.tags === 'object'
    ? ((event?.tags as string[][] | undefined)?.find((tag) => tag[0] === 't')?.[1] ?? msg.parsed.topic)
    : msg.parsed.topic;

  // Raw NIP-01 kind 29003 traffic maps to IFC path labels.
  if (kind === 29003) {
    if (topic === 'shell:state-get' || topic === 'shell:state-keys') return 'state-read';
    if (topic === 'shell:state-set' || topic === 'shell:state-remove' || topic === 'shell:state-clear') return 'state-write';
    return msg.direction === 'napplet->shell' ? 'ifc-send' : 'ifc-receive';
  }

  return msg.direction === 'napplet->shell' ? 'relay-publish' : 'relay-subscribe';
}

export class NappletDebugger extends HTMLElement {
  private shadow: ShadowRoot;
  private logContainer!: HTMLElement;
  private filterVerb: string = '';
  private filterDirection: string = '';
  private autoScroll: boolean = true;
  private paused: boolean = false;
  private messageBuffer: TappedMessage[] = [];
  private allMessages: TappedMessage[] = [];
  private unsubscribe?: () => void;
  private sequenceResizeObserver?: ResizeObserver;
  private activeTab: 'log' | 'sequence' = 'log';

  constructor() {
    super();
    this.shadow = this.attachShadow({ mode: 'open' });
  }

  connectedCallback() {
    this.render();
  }

  disconnectedCallback() {
    if (this.unsubscribe) this.unsubscribe();
    this.sequenceResizeObserver?.disconnect();
    this.sequenceResizeObserver = undefined;
  }

  /**
   * Connect to a message tap for real-time updates.
   */
  connectTap(tap: MessageTap): void {
    for (const msg of tap.messages) {
      this.addMessage(msg);
    }
    // Subscribe to new messages
    this.unsubscribe = tap.onMessage((msg) => {
      if (!this.paused) {
        this.addMessage(msg);
      } else {
        this.messageBuffer.push(msg);
      }
    });
  }

  /**
   * Add a system event to the log (e.g., ACL changes).
   */
  addSystemMessage(text: string): void {
    const msg: TappedMessage = {
      index: -1,
      timestamp: Date.now(),
      direction: 'shell->napplet',
      verb: 'SYSTEM',
      raw: ['SYSTEM', text],
      parsed: { reason: text },
    };
    this.addMessage(msg);
  }

  private render(): void {
    replaceChildrenFromTrustedHtml(this.shadow, `
      <style>
        :host {
          display: flex;
          flex-direction: column;
          height: 100%;
          font-family: 'JetBrains Mono', monospace;
          font-size: 12px;
          color: var(--nap-theme-text, #e0e0e0);
          background: var(--nap-theme-background, #0a0a0f);
        }
        .tabs {
          display: flex;
          border-bottom: 1px solid var(--nap-theme-border, #2a2a3a);
          background: var(--nap-theme-surface-2, #12121a);
        }
        .tab {
          padding: 6px 16px;
          cursor: pointer;
          color: var(--nap-theme-muted, #888);
          border-bottom: 2px solid transparent;
          transition: all 0.15s;
        }
        .tab:hover { color: var(--nap-theme-text, #ccc); }
        .tab.active {
          color: var(--nap-theme-primary, #00f0ff);
          border-bottom-color: var(--nap-theme-primary, #00f0ff);
        }
        .controls {
          display: flex;
          gap: 8px;
          padding: 6px 12px;
          background: var(--nap-theme-surface-2, #12121a);
          border-bottom: 1px solid var(--nap-theme-border, #2a2a3a);
          align-items: center;
        }
        .controls select, .controls button {
          background: var(--nap-theme-surface-1, #1a1a28);
          color: var(--nap-theme-text, #e0e0e0);
          border: 1px solid var(--nap-theme-border, #2a2a3a);
          padding: 2px 8px;
          font-family: inherit;
          font-size: 11px;
          border-radius: 3px;
          cursor: pointer;
        }
        .controls select:hover, .controls button:hover {
          border-color: var(--nap-theme-primary, #00f0ff);
        }
        .controls label {
          color: var(--nap-theme-muted, #888);
          font-size: 11px;
        }
        .log-container {
          flex: 1;
          overflow-y: auto;
          padding: 4px 0;
        }
        .log-entry {
          padding: 2px 12px;
          display: flex;
          gap: 8px;
          line-height: 1.6;
          border-bottom: 1px solid var(--nap-theme-border, #0f0f18);
        }
        .log-entry:hover {
          background: var(--nap-theme-surface-1, #1a1a28);
        }
        .log-time {
          color: var(--nap-theme-muted, #555);
          min-width: 80px;
          flex-shrink: 0;
        }
        .log-dir {
          min-width: 30px;
          flex-shrink: 0;
          text-align: center;
        }
        .log-verb {
          min-width: 60px;
          flex-shrink: 0;
          font-weight: 600;
        }
        .log-detail {
          color: var(--nap-theme-muted, #888);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .log-system {
          color: var(--nap-theme-primary, #ff00ff);
          font-style: italic;
          padding: 4px 12px;
          border-bottom: 1px solid var(--nap-theme-border, #0f0f18);
        }
        .msg-count {
          color: var(--nap-theme-muted, #555);
          margin-left: auto;
          font-size: 11px;
        }
        .sequence-placeholder {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--nap-theme-muted, #555);
        }
        .tab-content { display: none; flex: 1; flex-direction: column; overflow: hidden; }
        .tab-content.active { display: flex; }
      </style>

      <div class="tabs">
        <div class="tab active" data-tab="log">Live Log</div>
        <div class="tab" data-tab="sequence">Sequence</div>
        <span class="msg-count" id="msg-count">0 messages</span>
      </div>

      <div class="tab-content active" id="tab-log">
        <div class="controls">
          <label>Verb:</label>
          <select id="filter-verb">
            <option value="">all</option>
            <option value="AUTH">AUTH</option>
            <option value="EVENT">EVENT</option>
            <option value="REQ">REQ</option>
            <option value="OK">OK</option>
            <option value="EOSE">EOSE</option>
            <option value="CLOSE">CLOSE</option>
            <option value="CLOSED">CLOSED</option>
            <option value="NOTICE">NOTICE</option>
          </select>
          <label>Dir:</label>
          <select id="filter-dir">
            <option value="">all</option>
            <option value="napplet->shell">napplet->shell</option>
            <option value="shell->napplet">shell->napplet</option>
          </select>
          <button id="btn-clear">Clear</button>
          <button id="btn-pause">Pause</button>
        </div>
        <div class="log-container" id="log-container"></div>
      </div>

      <div class="tab-content" id="tab-sequence">
        <div class="sequence-container" id="sequence-container" style="flex:1;overflow:auto;padding:8px;"></div>
      </div>
    `);

    this.logContainer = this.shadow.getElementById('log-container')!;
    this.observeSequenceContainer();

    this.shadow.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        const tabName = (tab as HTMLElement).dataset.tab as 'log' | 'sequence';
        this.activeTab = tabName;
        this.shadow.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        this.shadow.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        this.shadow.getElementById(`tab-${tabName}`)?.classList.add('active');
        if (tabName === 'sequence') {
          this.updateSequenceDiagram();
        }
      });
    });

    // Filter controls
    this.shadow.getElementById('filter-verb')?.addEventListener('change', (e) => {
      this.filterVerb = (e.target as HTMLSelectElement).value;
      this.rerender();
    });
    this.shadow.getElementById('filter-dir')?.addEventListener('change', (e) => {
      this.filterDirection = (e.target as HTMLSelectElement).value;
      this.rerender();
    });

    // Clear button
    this.shadow.getElementById('btn-clear')?.addEventListener('click', () => {
      this.messageBuffer = [];
      this.allMessages = [];
      this.logContainer.replaceChildren();
      const seqContainer = this.shadow.getElementById('sequence-container');
      if (seqContainer) seqContainer.replaceChildren();
      this.updateCount(0);
    });

    // Pause/Resume button
    this.shadow.getElementById('btn-pause')?.addEventListener('click', () => {
      this.paused = !this.paused;
      const btn = this.shadow.getElementById('btn-pause')!;
      btn.textContent = this.paused ? 'Resume' : 'Pause';
      if (!this.paused) {
        // Flush buffered messages
        for (const msg of this.messageBuffer) {
          this.addMessage(msg);
        }
        this.messageBuffer = [];
      }
    });
  }

  private getRowLabel(msg: TappedMessage): string {
    // Envelope-shape messages: show literal envelope type string (e.g. "relay.publish")
    if (msg.envelopeType) return msg.envelopeType;
    // Legacy NIP-01 array: show verb
    return msg.verb;
  }

  private createLogElement(msg: TappedMessage): HTMLDivElement {
    if (msg.verb === 'SYSTEM') {
      const el = document.createElement('div');
      el.className = 'log-system';
      el.textContent = `[system] ${msg.parsed.reason || ''}`;
      return el;
    }

    const el = document.createElement('div');
    el.className = 'log-entry';
    const time = new Date(msg.timestamp).toLocaleTimeString('en', {
      hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit', fractionalSecondDigits: 3
    } as Intl.DateTimeFormatOptions);
    const color = VERB_COLORS[msg.verb] || VERB_COLORS.UNKNOWN;
    const arrow = DIRECTION_ARROWS[msg.direction] || '???';

    const timeEl = document.createElement('span');
    timeEl.className = 'log-time';
    timeEl.textContent = time;
    const dirEl = document.createElement('span');
    dirEl.className = 'log-dir';
    dirEl.style.color = color;
    dirEl.textContent = arrow;
    const verbEl = document.createElement('span');
    verbEl.className = 'log-verb';
    verbEl.style.color = color;
    verbEl.textContent = this.getRowLabel(msg);
    const detailEl = document.createElement('span');
    detailEl.className = 'log-detail';
    detailEl.textContent = this.formatDetail(msg);
    el.append(timeEl, dirEl, verbEl, detailEl);
    return el;
  }

  private addMessage(msg: TappedMessage): void {
    // Always store for sequence diagram (regardless of filters)
    this.allMessages.push(msg);
    this.updateSequenceDiagram();

    if (this.filterVerb && msg.verb !== this.filterVerb) return;
    if (this.filterDirection && msg.direction !== this.filterDirection) return;

    this.logContainer.appendChild(this.createLogElement(msg));

    // Auto-scroll
    if (this.autoScroll) {
      this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }

    this.updateCount(this.logContainer.children.length);
  }

  private updateSequenceDiagram(): void {
    if (this.activeTab !== 'sequence') return;
    const container = this.shadow.getElementById('sequence-container');
    if (!container) return;
    const width = Math.max(1000, Math.floor(container.clientWidth || container.getBoundingClientRect().width || 0));
    replaceChildrenFromTrustedHtml(container, renderSequenceDiagram(this.allMessages, getNapplets(), { width }));
    container.scrollTop = container.scrollHeight;
  }

  private observeSequenceContainer(): void {
    this.sequenceResizeObserver?.disconnect();
    const container = this.shadow.getElementById('sequence-container');
    if (!container || typeof ResizeObserver === 'undefined') return;
    this.sequenceResizeObserver = new ResizeObserver(() => {
      if (this.activeTab === 'sequence') this.updateSequenceDiagram();
    });
    this.sequenceResizeObserver.observe(container);
  }

  private formatDetail(msg: TappedMessage): string {
    const p = msg.parsed;
    const path = classifyTappedMessagePath(msg);
    const pathPrefix = path ? `path:${path} ` : '';
    const rawArr = Array.isArray(msg.raw) ? msg.raw : null;
    // Envelope-shape messages: display the envelope type and domain
    if (msg.envelopeType) {
      return `${pathPrefix}type:${msg.envelopeType}${p.domain ? ` domain:${p.domain}` : ''}${p.eventId ? ` id:${p.eventId.substring(0, 8)}...` : ''}${p.reason ? ` ${p.reason}` : ''}`;
    }
    switch (msg.verb) {
      case 'AUTH':
        if (rawArr && typeof rawArr[1] === 'string') return `${pathPrefix}challenge: ${(rawArr[1] as string).substring(0, 16)}...`;
        return `${pathPrefix}kind:${p.eventKind} pubkey:${(p.pubkey || '').substring(0, 8)}...`;
      case 'EVENT':
        return `${pathPrefix}${p.subId ? `sub:${p.subId} ` : ''}kind:${p.eventKind}${p.topic ? ` topic:${p.topic}` : ''} id:${(p.eventId || '').substring(0, 8)}...`;
      case 'REQ':
        return `${pathPrefix}sub:${p.subId} filters:${JSON.stringify(rawArr ? rawArr.slice(2) : []).substring(0, 60)}`;
      case 'OK':
        return `${pathPrefix}${p.success ? 'accepted' : 'rejected'}${p.reason ? ` -- ${p.reason}` : ''} id:${(p.eventId || '').substring(0, 8)}...`;
      case 'EOSE':
        return `${pathPrefix}sub:${p.subId}`;
      case 'CLOSE':
        return `${pathPrefix}sub:${p.subId}`;
      case 'CLOSED':
        return `${pathPrefix}sub:${p.subId} reason:${p.reason || ''}`;
      case 'NOTICE':
        return `${pathPrefix}${p.reason || ''}`;
      default:
        return `${pathPrefix}${JSON.stringify(msg.raw).substring(0, 80)}`;
    }
  }

  private updateCount(count: number): void {
    const el = this.shadow.getElementById('msg-count');
    if (el) el.textContent = `${count} messages`;
  }

  private rerender(): void {
    const visible: HTMLElement[] = [];
    for (const msg of this.allMessages) {
      if (this.filterVerb && msg.verb !== this.filterVerb) continue;
      if (this.filterDirection && msg.direction !== this.filterDirection) continue;
      visible.push(this.createLogElement(msg));
    }
    this.logContainer.replaceChildren(...visible);
    this.updateCount(this.logContainer.children.length);
  }
}

// Register the custom element
customElements.define('napplet-debugger', NappletDebugger);
