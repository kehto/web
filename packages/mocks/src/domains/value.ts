/**
 * domains/value.ts — Mock NAP-VALUE service.
 *
 * Spec: naps/NAP-VALUE.md @ napplet/naps PR #30 head e468764d9f8a (draft)
 * Routes: value.quote, value.send, value.status
 * Pushes: value.status.changed
 * Spec gaps / decisions:
 * - The wire table lists `result` as always present on `value.send.result`,
 *   while the prose says a top-level `error` without a transfer is returned
 *   when no transfer was created. The mock follows the prose: policy and
 *   validation failures reply `{ id, error }` only; consent denial and
 *   payment failures create a transfer and reply a structured `result`.
 * - Settlement is asynchronous: `send` returns `pending`; `settle()` (or the
 *   `settleMs` timer) flips it to `settled`, discloses the preimage, debits
 *   the wallet, and pushes `value.status.changed`.
 * - Consent is modeled by `approveNext(boolean)`; without a queued decision
 *   the `autoApprove` option (default `true`) decides.
 * - Errors use the NAP's listed strings plus `"insufficient funds"`, which
 *   the open-ended error list does not name.
 */
import type { NostrEvent } from '@napplet/core';
import type { NappletMessage } from '@kehto/runtime';
import { DEFAULT_CLOCK, DEFAULT_SCHEDULER, defineMockService, pushToWindow } from '../core/handler.js';
import { mockEventId, mockHex, mockSignature } from '../core/rng.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';
import { MOCK_ACCOUNTS } from '../fixtures/nostr.js';

/**
 * Spec document the mock was written against.
 *
 * @example
 * ```ts
 * VALUE_SPEC_REF.pr === 30;
 * ```
 */
export const VALUE_SPEC_REF: NapSpecRef = {
  nap: 'NAP-VALUE',
  status: 'draft',
  source: 'pr',
  pr: 30,
  sha: 'e468764d9f8a',
  path: 'naps/NAP-VALUE.md',
};

/**
 * `ValueTransferState` enumeration.
 *
 * @example
 * ```ts
 * const state: ValueTransferState = 'settled';
 * ```
 */
export type ValueTransferState = 'pending' | 'settled' | 'failed' | 'cancelled';

/**
 * `ValueRequest` as sent by a napplet.
 *
 * @example
 * ```ts
 * const request: ValueRequest = { rail: 'zap', amountMsat: 21_000, target: { type: 'zap', pubkey: 'ab…' } };
 * ```
 */
export interface ValueRequest {
  rail: string;
  amountMsat: number;
  comment?: string;
  target: Record<string, unknown> & { type: string };
  metadata?: Record<string, unknown>;
}

/**
 * `ValueStatus` snapshot (`ValueResult` is the same shape without `updatedAt`).
 *
 * @example
 * ```ts
 * const status: ValueStatus = { ok: true, transferId: 'value-1', status: 'pending', rail: 'zap', amountMsat: 21_000, updatedAt: 1 };
 * ```
 */
export interface ValueStatus {
  ok: boolean;
  transferId: string;
  status: ValueTransferState;
  rail: string;
  amountMsat: number;
  event?: NostrEvent;
  preimage?: string;
  error?: string;
  updatedAt: number;
}

/**
 * A transfer the mock keeps, with its owning window and fee.
 *
 * @example
 * ```ts
 * const transfer = createMockValueService().mock.state().transfers.get('value-1');
 * ```
 */
export interface MockValueTransfer extends ValueStatus {
  windowId: string;
  feesMsat: number;
  request: ValueRequest;
}

/**
 * In-memory state of the value mock.
 *
 * @example
 * ```ts
 * const state = createMockValueService({ balanceSats: 10 }).mock.state();
 * state.balanceMsat === 10_000;
 * ```
 */
export interface MockValueState {
  /** Wallet balance in millisatoshis. */
  balanceMsat: number;
  /** Transfers by id, oldest first. */
  transfers: Map<string, MockValueTransfer>;
  /** Queued consent decisions consumed by the next `send` calls. */
  consentQueue: boolean[];
  /** Monotonic transfer counter. */
  nextSeq: number;
  /** Pending settlement timers by transfer id. */
  timers: Map<string, () => void>;
}

/**
 * Factory options for the value mock.
 *
 * @example
 * ```ts
 * const service = createMockValueService({ balanceSats: 50_000, settleMs: 10 });
 * ```
 */
export interface MockValueOptions extends MockServiceOptions {
  /** Seeded wallet balance in satoshis. Default `100000`. */
  balanceSats?: number;
  /** Per-transfer policy cap in millisatoshis. Default `100000000` (100k sats). */
  maxAmountMsat?: number;
  /** Rails the shell supports. Default `['zap', 'lnurl']`. */
  rails?: readonly string[];
  /** Consent decision when `approveNext` has nothing queued. Default `true`. */
  autoApprove?: boolean;
  /** When set, settle each pending transfer after this many ms via the scheduler. */
  settleMs?: number;
}

/**
 * The value mock service type.
 *
 * @example
 * ```ts
 * const value = createMockValueService();
 * value.approveNext(true);
 * value.settle();
 * ```
 */
export type MockValueService = MockService<MockValueState> & {
  /**
   * Queue the consent decision for the next `value.send`.
   *
   * @param approved - `true` to approve, `false` to cancel as the user.
   */
  approveNext(approved: boolean): void;
  /**
   * Settle pending transfers (all when `transferId` is omitted), pushing
   * `value.status.changed` to the owning window.
   *
   * @param transferId - A single transfer to settle.
   * @returns Transfer ids that were settled.
   */
  settle(transferId?: string): string[];
  /**
   * Fail a pending transfer with the given error, pushing `value.status.changed`.
   *
   * @param transferId - Transfer to fail.
   * @param error - Error reason, e.g. `payment failed`.
   * @returns Whether a pending transfer was failed.
   */
  failTransfer(transferId: string, error?: string): boolean;
};

const DEFAULT_RAILS: readonly string[] = Object.freeze(['zap', 'lnurl']);
const SHELL_USER = MOCK_ACCOUNTS[0]!;

function isUint(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isValueRequest(raw: unknown): raw is ValueRequest {
  if (!raw || typeof raw !== 'object') return false;
  const request = raw as Record<string, unknown>;
  const target = request.target;
  if (typeof request.rail !== 'string' || !isUint(request.amountMsat)) return false;
  return !!target && typeof target === 'object' && typeof (target as { type?: unknown }).type === 'string';
}

function parseRequest(raw: unknown): ValueRequest | undefined {
  return isValueRequest(raw) ? raw : undefined;
}

function validateTarget(request: ValueRequest): string | undefined {
  const target = request.target;
  if (request.rail === 'zap') {
    if (target.type !== 'zap') return 'invalid target';
    const hasRecipient = typeof target.pubkey === 'string' || typeof target.eventId === 'string' || typeof target.address === 'string';
    return hasRecipient ? undefined : 'invalid target';
  }
  if (request.rail === 'lnurl') {
    return target.type === 'lnurl' && typeof target.lnurl === 'string' && target.lnurl.length > 0 ? undefined : 'invalid target';
  }
  return undefined;
}

function feeFor(amountMsat: number): number {
  return Math.max(1, Math.round(amountMsat / 1000));
}

function publicStatus(transfer: MockValueTransfer): ValueStatus {
  const { windowId: _w, feesMsat: _f, request: _r, ...status } = transfer;
  return status;
}

function zapRequestEvent(transferId: string, request: ValueRequest, createdAt: number): NostrEvent {
  const target = request.target;
  const tags: string[][] = [];
  if (typeof target.pubkey === 'string') tags.push(['p', target.pubkey]);
  if (typeof target.eventId === 'string') tags.push(['e', target.eventId]);
  if (typeof target.address === 'string') tags.push(['a', target.address]);
  tags.push(['amount', String(request.amountMsat)]);
  if (Array.isArray(target.relays)) tags.push(['relays', ...target.relays.filter((r): r is string => typeof r === 'string')]);
  const label = `zap-request:${transferId}`;
  return { id: mockEventId(label), pubkey: SHELL_USER.pubkey, created_at: createdAt, kind: 9734, tags, content: request.comment ?? '', sig: mockSignature(label) };
}

function zapReceiptEvent(transfer: MockValueTransfer, preimage: string, createdAt: number): NostrEvent {
  const label = `zap-receipt:${transfer.transferId}`;
  const tags = (transfer.event?.tags ?? []).filter((tag) => tag[0] === 'p' || tag[0] === 'e' || tag[0] === 'a');
  tags.push(['bolt11', `lnbc${Math.ceil(transfer.amountMsat / 1000)}n1mock${mockHex(`bolt11:${transfer.transferId}`, 16)}`]);
  tags.push(['preimage', preimage]);
  tags.push(['description', JSON.stringify(transfer.event ?? null)]);
  return { id: mockEventId(label), pubkey: mockHex('pubkey:zap-provider'), created_at: createdAt, kind: 9735, tags, content: '', sig: mockSignature(label) };
}

/**
 * Create the NAP-VALUE mock.
 *
 * @param options - Wallet seed, policy, consent, and settlement options.
 * @returns The mock service with consent and settlement controls.
 * @example
 * ```ts
 * const value = createMockValueService({ balanceSats: 1_000 });
 * value.approveNext(false); // next send is cancelled by the "user"
 * ```
 */
export function createMockValueService(options: MockValueOptions = {}): MockValueService {
  const rails = options.rails ?? DEFAULT_RAILS;
  const maxAmountMsat = options.maxAmountMsat ?? 100_000_000;
  const scheduler = options.scheduler ?? DEFAULT_SCHEDULER;
  const clock = options.clock ?? DEFAULT_CLOCK;

  const service = defineMockService<MockValueState>({
    domain: 'value',
    version: '0.1.0',
    description: 'Mock NAP-VALUE shell-mediated value transfer',
    kind: 'extension',
    pushes: { 'value.status.changed': null },
    initialState: () => ({
      balanceMsat: (options.balanceSats ?? 100_000) * 1000,
      transfers: new Map(),
      consentQueue: [],
      nextSeq: 1,
      timers: new Map(),
    }),
    routes: {
      'value.quote': ({ message, reply, clock }) => {
        const request = parseRequest(message.request);
        if (!request) {
          reply({ error: 'invalid target' });
          return;
        }
        const error = policyError(request);
        if (error) {
          reply({ quote: { ok: false, rail: request.rail, amountMsat: request.amountMsat, error }, error });
          return;
        }
        reply({ quote: { ok: true, rail: request.rail, amountMsat: request.amountMsat, feesMsat: feeFor(request.amountMsat), expiresAt: Math.floor(clock.now() / 1000) + 600 } });
      },
      'value.send': ({ message, reply, state, windowId, clock }) => {
        const request = parseRequest(message.request);
        if (!request) {
          reply({ error: 'invalid target' });
          return;
        }
        const error = policyError(request);
        if (error) {
          reply({ error });
          return;
        }
        const transfer = admit(state, windowId, request, clock.now());
        reply({ result: publicStatusWithoutUpdatedAt(transfer) });
        if (transfer.status === 'pending' && options.settleMs !== undefined) {
          const cancel = scheduler.schedule(options.settleMs, () => { state.timers.delete(transfer.transferId); settleOne(transfer.transferId); });
          state.timers.set(transfer.transferId, cancel);
        }
      },
      'value.status': ({ message, reply, state, windowId }) => {
        const transfer = typeof message.transferId === 'string' ? state.transfers.get(message.transferId) : undefined;
        if (!transfer || transfer.windowId !== windowId) {
          reply({ error: 'transfer not found' });
          return;
        }
        reply({ status: publicStatus(transfer) });
      },
    },
    onWindowDestroyed: (windowId, state) => {
      for (const [id, transfer] of state.transfers) {
        if (transfer.windowId !== windowId) continue;
        state.timers.get(id)?.();
        state.timers.delete(id);
        state.transfers.delete(id);
      }
    },
  }, options);

  function policyError(request: ValueRequest): string | undefined {
    if (!rails.includes(request.rail)) return 'unsupported rail';
    const targetError = validateTarget(request);
    if (targetError) return targetError;
    if (request.amountMsat === 0 || request.amountMsat > maxAmountMsat) return 'amount out of policy';
    return undefined;
  }

  function admit(state: MockValueState, windowId: string, request: ValueRequest, now: number): MockValueTransfer {
    const approved = state.consentQueue.length > 0 ? state.consentQueue.shift()! : (options.autoApprove ?? true);
    const transferId = `value-${state.nextSeq++}`;
    const feesMsat = feeFor(request.amountMsat);
    const base: MockValueTransfer = { ok: true, transferId, status: 'pending', rail: request.rail, amountMsat: request.amountMsat, updatedAt: Math.floor(now / 1000), windowId, feesMsat, request };
    if (!approved) Object.assign(base, { ok: false, status: 'cancelled', error: 'user cancelled' });
    else if (request.amountMsat + feesMsat > state.balanceMsat) Object.assign(base, { ok: false, status: 'failed', error: 'insufficient funds' });
    else if (request.rail === 'zap') base.event = zapRequestEvent(transferId, request, base.updatedAt);
    state.transfers.set(transferId, base);
    return base;
  }

  function changed(transfer: MockValueTransfer): void {
    pushToWindow(service, transfer.windowId, { type: 'value.status.changed', status: publicStatus(transfer) } as NappletMessage);
  }

  function settleOne(transferId: string): boolean {
    const state = service.mock.state();
    const transfer = state.transfers.get(transferId);
    if (!transfer || transfer.status !== 'pending') return false;
    state.timers.get(transferId)?.();
    state.timers.delete(transferId);
    const preimage = mockHex(`preimage:${transferId}`);
    const now = Math.floor(clock.now() / 1000);
    state.balanceMsat -= transfer.amountMsat + transfer.feesMsat;
    Object.assign(transfer, { status: 'settled', preimage, updatedAt: now });
    if (transfer.rail === 'zap') transfer.event = zapReceiptEvent(transfer, preimage, now);
    changed(transfer);
    return true;
  }

  const baseReset = service.mock.reset;
  service.mock.reset = () => {
    for (const cancel of service.mock.state().timers.values()) cancel();
    baseReset();
  };

  return Object.assign(service, {
    approveNext(approved: boolean) { service.mock.state().consentQueue.push(approved); },
    settle(transferId?: string): string[] {
      const ids = transferId !== undefined ? [transferId] : [...service.mock.state().transfers.keys()];
      return ids.filter((id) => settleOne(id));
    },
    failTransfer(transferId: string, error = 'payment failed'): boolean {
      const state = service.mock.state();
      const transfer = state.transfers.get(transferId);
      if (!transfer || transfer.status !== 'pending') return false;
      state.timers.get(transferId)?.();
      state.timers.delete(transferId);
      Object.assign(transfer, { ok: false, status: 'failed', error, updatedAt: Math.floor(clock.now() / 1000) });
      changed(transfer);
      return true;
    },
  });
}

function publicStatusWithoutUpdatedAt(transfer: MockValueTransfer): Omit<ValueStatus, 'updatedAt'> {
  const { updatedAt: _u, ...result } = publicStatus(transfer);
  return result;
}

/**
 * Registry row for NAP-VALUE.
 *
 * @example
 * ```ts
 * VALUE_MOCK_ENTRY.create?.({ seed: 1 });
 * ```
 */
export const VALUE_MOCK_ENTRY: MockDomainEntry = {
  domain: 'value',
  kind: 'extension',
  spec: VALUE_SPEC_REF,
  create: (options) => createMockValueService(options),
};
