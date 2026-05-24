import type { NappletMessage } from '@kehto/shell';

export interface TappedMessage {
  index: number;
  timestamp: number;
  direction: 'napplet->shell' | 'shell->napplet';
  verb: string;
  windowId?: string;
  raw: unknown[] | NappletMessage;
  envelope?: NappletMessage;
  envelopeType?: string;
  parsed: {
    subId?: string;
    eventKind?: number;
    eventId?: string;
    topic?: string;
    success?: boolean;
    reason?: string;
    pubkey?: string;
    domain?: string;
  };
}

export interface MessageTap {
  messages: TappedMessage[];
  recordOutbound(msg: unknown[], windowId?: string): void;
  recordOutboundEnvelope(envelope: NappletMessage, windowId?: string): void;
  recordInboundEnvelope(envelope: NappletMessage, windowId?: string): void;
  install(shellWindow: Window): void;
  onMessage(callback: (msg: TappedMessage) => void): () => void;
  filter(criteria: { verb?: string; direction?: string; envelopeType?: string }): TappedMessage[];
  clear(): void;
}

const KNOWN_VERBS = new Set([
  'EVENT', 'REQ', 'CLOSE', 'AUTH', 'OK', 'EOSE', 'NOTICE', 'CLOSED', 'COUNT',
]);

function parseMessage(raw: unknown[]): TappedMessage['parsed'] {
  const verb = raw[0] as string;
  const parsed: TappedMessage['parsed'] = {};
  switch (verb) {
    case 'EVENT': parseEventMessage(raw, parsed); break;
    case 'REQ': parsed.subId = raw[1] as string; break;
    case 'CLOSE': parsed.subId = raw[1] as string; break;
    case 'AUTH': parseAuthMessage(raw, parsed); break;
    case 'OK':
      parsed.eventId = raw[1] as string;
      parsed.success = raw[2] as boolean;
      parsed.reason = raw[3] as string;
      break;
    case 'EOSE': parsed.subId = raw[1] as string; break;
    case 'NOTICE': parsed.reason = raw[1] as string; break;
    case 'CLOSED':
      parsed.subId = raw[1] as string;
      parsed.reason = raw[2] as string;
      break;
  }
  return parsed;
}

function parseEventMessage(raw: unknown[], parsed: TappedMessage['parsed']): void {
  const eventValue = raw.length === 2 ? raw[1] : raw.length === 3 ? raw[2] : null;
  if (raw.length === 3) parsed.subId = raw[1] as string;
  if (typeof eventValue !== 'object' || eventValue === null) return;
  const event = eventValue as Record<string, unknown>;
  parsed.eventId = event.id as string;
  parsed.eventKind = event.kind as number;
  parsed.pubkey = event.pubkey as string;
  const tags = (event.tags as string[][] | undefined) ?? [];
  const topic = tags.find((tag) => tag[0] === 't');
  if (topic) parsed.topic = topic[1];
}

function parseAuthMessage(raw: unknown[], parsed: TappedMessage['parsed']): void {
  if (typeof raw[1] !== 'object' || raw[1] === null) return;
  const event = raw[1] as Record<string, unknown>;
  parsed.eventId = event.id as string;
  parsed.eventKind = event.kind as number;
  parsed.pubkey = event.pubkey as string;
}

function parseEnvelope(envelope: NappletMessage): TappedMessage['parsed'] {
  const type = envelope.type;
  const domain = type.includes('.') ? type.split('.')[0] : type;
  const parsed: TappedMessage['parsed'] = { domain };
  const env = envelope as NappletMessage & Record<string, unknown>;
  if (typeof env.id === 'string') parsed.eventId = env.id;
  if (typeof env.subscriptionId === 'string') parsed.subId = env.subscriptionId;
  if (typeof env.error === 'string') parsed.reason = env.error;
  return parsed;
}

export function createMessageTap(resolveWindowId?: (source: MessageEventSource | null) => string | undefined): MessageTap {
  const messages: TappedMessage[] = [];
  const listeners: Array<(msg: TappedMessage) => void> = [];
  let idx = 0;

  function record(
    direction: TappedMessage['direction'],
    raw: unknown[] | NappletMessage,
    windowId?: string,
  ): void {
    const isEnvelope =
      !Array.isArray(raw) &&
      typeof raw === 'object' &&
      raw !== null &&
      typeof (raw as NappletMessage).type === 'string';
    const envelope = isEnvelope ? (raw as NappletMessage) : undefined;
    const envelopeType = envelope?.type;
    const verb = envelope
      ? 'ENVELOPE'
      : Array.isArray(raw) && typeof raw[0] === 'string' && KNOWN_VERBS.has(raw[0] as string)
        ? (raw[0] as string)
        : 'UNKNOWN';
    const parsed = envelope ? parseEnvelope(envelope) : parseMessage(raw as unknown[]);
    const msg: TappedMessage = {
      index: idx++,
      timestamp: Date.now(),
      direction,
      verb,
      windowId,
      raw,
      envelope,
      envelopeType,
      parsed,
    };
    messages.push(msg);
    for (const callback of listeners) {
      try { callback(msg); } catch { return; }
    }
  }

  return {
    messages,
    recordOutbound(msg: unknown[], windowId?: string) {
      if (Array.isArray(msg)) record('shell->napplet', msg, windowId);
    },
    recordOutboundEnvelope(envelope: NappletMessage, windowId?: string) {
      record('shell->napplet', envelope, windowId);
    },
    recordInboundEnvelope(envelope: NappletMessage, windowId?: string) {
      record('napplet->shell', envelope, windowId);
    },
    install(shellWindow: Window) {
      shellWindow.addEventListener('message', (event: MessageEvent) => {
        const windowId = resolveWindowId?.(event.source);
        if (Array.isArray(event.data)) {
          record('napplet->shell', event.data, windowId);
        } else if (
          typeof event.data === 'object' &&
          event.data !== null &&
          typeof (event.data as NappletMessage).type === 'string'
        ) {
          record('napplet->shell', event.data as NappletMessage, windowId);
        }
      }, true);
    },
    onMessage(callback) {
      listeners.push(callback);
      return () => {
        const i = listeners.indexOf(callback);
        if (i !== -1) listeners.splice(i, 1);
      };
    },
    filter(criteria) {
      return messages.filter((message) => {
        if (criteria.verb && message.verb !== criteria.verb) return false;
        if (criteria.direction && message.direction !== criteria.direction) return false;
        if (criteria.envelopeType && message.envelopeType !== criteria.envelopeType) return false;
        return true;
      });
    },
    clear() {
      messages.length = 0;
      idx = 0;
    },
  };
}
