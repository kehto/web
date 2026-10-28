import { describe, expect, it, vi } from 'vitest';
import type { NappletMessage } from '@napplet/core';
import type { ServiceHandler } from '@kehto/runtime';
import { createPajaWindowScope, scopePajaService } from './browser-operation-scope.js';
import { createPajaRelayBackend } from './browser-relay-runtime.js';
import { createPajaDevSigner, PAJA_DEV_SIGNER_PUBKEY } from './browser-dev-runtime.js';
import { normalizePajaSimulation } from './simulation.js';
import type { PajaConfirmationRequest } from './browser-adapter.js';

const simulation = normalizePajaSimulation({ relay: { mode: 'memory', urls: ['wss://relay.example'] } });
const template = { kind: 1, created_at: 1, tags: [], content: 'scope proof' };
const source = (windowId: string) => ({ windowId, napplet: { dTag: windowId, aggregateHash: `artifact-${windowId}` }, runtimeScope: `manifest:${windowId}:artifact:one` });

describe('Paja operation source scopes', () => {
  it('preserves each authenticated source through interleaved signing and publication, ignoring message claims', async () => {
    const requests: PajaConfirmationRequest[] = [];
    const approvals = new Map<string, (value: boolean) => void>();
    const confirm = (request: PajaConfirmationRequest) => {
      requests.push(request);
      if (request.action !== 'sign') return true;
      return new Promise<boolean>(resolve => approvals.set(request.signerContext!.windowId, resolve));
    };
    const backend = createPajaRelayBackend(() => simulation, confirm);
    const base: ServiceHandler = { descriptor: { name: 'scope-test', version: '1' }, handleMessage() {} };
    const service = scopePajaService(base, ['scope-test.write'], (windowId, isCurrent) => {
      const scope = createPajaWindowScope({ backend, source: source(windowId), isCurrent,
        getPubkey: () => PAJA_DEV_SIGNER_PUBKEY,
        getSigner: origin => createPajaDevSigner(() => simulation, confirm, origin),
      });
      return { descriptor: base.descriptor, handleMessage(_id, _message, send) {
        void scope.getSigner()!.signEvent!(template).then(event => scope.backend.publish(['wss://relay.example'], event!))
          .then(() => send({ type: 'scope-test.result', ok: true } as NappletMessage));
      } };
    });
    const resultA = vi.fn(), resultB = vi.fn();
    service.handleMessage('one', { type: 'scope-test.write', signerContext: source('forged') } as NappletMessage, resultA);
    service.handleMessage('two', { type: 'scope-test.write' } as NappletMessage, resultB);
    approvals.get('two')!(true);
    await vi.waitFor(() => expect(resultB).toHaveBeenCalledOnce());
    approvals.get('one')!(true);
    await vi.waitFor(() => expect(resultA).toHaveBeenCalledOnce());
    expect(requests.flatMap(request => request.action === 'publish' ? [request.signerContext?.windowId] : [])).toEqual(['two', 'one']);
    expect(requests.flatMap(request => request.action === 'sign' ? [request.signerContext?.windowId] : [])).toEqual(['one', 'two']);
    backend.close();
  });

  it('does not publish after approval when the owning source has expired', async () => {
    let current = true;
    let approve!: (value: boolean) => void;
    const backend = createPajaRelayBackend(() => simulation, request => request.action === 'publish'
      ? new Promise(resolve => { approve = resolve; }) : true);
    const scope = createPajaWindowScope({ backend, source: source('one'), isCurrent: () => current,
      getPubkey: () => PAJA_DEV_SIGNER_PUBKEY,
      getSigner: origin => createPajaDevSigner(() => simulation, () => true, origin),
    });
    const event = await scope.getSigner()!.signEvent!(template);
    const pending = scope.backend.publish(['wss://relay.example'], event!);
    await vi.waitFor(() => expect(approve).toBeTypeOf('function'));
    current = false;
    approve(true);
    await expect(pending).rejects.toThrow('publish denied');
    expect(await backend.query(['wss://relay.example'], [{ kinds: [1] }])).toEqual([]);
    backend.close();
  });

  it('replaces cached authority after an account/version change and invalidates it on revocation or removal', () => {
    let key = 'version-one/account-one';
    const lifetimes: (() => boolean)[] = [];
    const destroyed = vi.fn();
    const base: ServiceHandler = { descriptor: { name: 'scope-test', version: '1' }, handleMessage() {} };
    const service = scopePajaService(base, ['scope-test.write'], (_windowId, isCurrent) => {
      lifetimes.push(isCurrent);
      return { ...base, onWindowDestroyed: destroyed };
    }, () => key);
    const write = () => service.handleMessage('one', { type: 'scope-test.write' } as NappletMessage, () => {});
    write();
    expect(lifetimes[0]!()).toBe(true);
    key = 'version-two/account-two';
    write();
    expect(lifetimes[0]!()).toBe(false);
    expect(lifetimes[1]!()).toBe(true);
    service.onCapabilityRevoked?.('one', 'relay:write');
    expect(lifetimes[1]!()).toBe(false);
    write();
    service.onWindowDestroyed?.('one');
    expect(lifetimes[2]!()).toBe(false);
    expect(destroyed).toHaveBeenCalledTimes(3);
  });

  it('does not reuse account consent when the signer reports another public key', async () => {
    const confirm = vi.fn(() => true);
    const backend = createPajaRelayBackend(() => simulation, confirm);
    const scope = createPajaWindowScope({ backend, source: source('one'), isCurrent: () => true,
      getPubkey: () => 'a'.repeat(64), getSigner: () => ({ getPublicKey: () => 'b'.repeat(64) }),
    });
    const event = await createPajaDevSigner(() => simulation, () => true).signEvent!(template);
    await expect(scope.backend.publish(['wss://relay.example'], event!)).rejects.toThrow('account changed');
    expect(confirm).not.toHaveBeenCalled();
    backend.close();
  });

  it('identifies signerless host-generated publications without borrowing a real account', async () => {
    const confirm = vi.fn(() => true);
    const backend = createPajaRelayBackend(() => simulation, confirm);
    const scope = createPajaWindowScope({ backend, source: source('cvm-napplet'), isCurrent: () => true,
      getPubkey: () => '', getSigner: () => null,
    });
    const event = await createPajaDevSigner(() => simulation, () => true).signEvent!(template);
    await scope.backend.publish(['wss://relay.example'], event!);
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({ action: 'publish', signerContext: expect.objectContaining({
      windowId: 'cvm-napplet', signerPubkey: 'host-generated',
      runtimeScope: expect.stringMatching(/^manifest:cvm-napplet:artifact:one\|host-session:[a-f0-9]{32}$/),
    }) }));
    backend.close();
  });
});
