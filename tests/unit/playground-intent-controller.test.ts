import { describe, expect, it, vi } from 'vitest';
import type { IntentDispatchParams } from '@kehto/services';
import { PlaygroundIntentController } from '../../apps/playground/src/playground-intent-controller.js';

const params: IntentDispatchParams = {
  handler: 'nip5d:35129:publisher:profile', sender: 'nip5d:35129:publisher:feed',
  archetype: 'profile', action: 'open', convention: 'napplet:profile/open', payload: { pubkey: 'a'.repeat(64) },
};

describe('PlaygroundIntentController', () => {
  it('retains delivery at acceptance and completes after authenticated readiness', async () => {
    let release!: () => void;
    const ready = new Promise<void>((resolve) => { release = resolve; });
    const send = vi.fn();
    const controller = new PlaygroundIntentController({
      openOrReuse: () => ({ id: 'target' }), waitForReady: () => ready, isCurrent: () => true, send,
    });
    const accepted = controller.accept(params);
    expect(accepted.completion).toBeInstanceOf(Promise);
    expect(send).not.toHaveBeenCalled();
    release();
    await expect(accepted.completion).resolves.toBeUndefined();
    expect(send).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ sender: params.sender }));
  });

  it('reports terminal delivery failure through completion and host callback', async () => {
    const onTerminal = vi.fn();
    const controller = new PlaygroundIntentController({
      openOrReuse: () => null, waitForReady: () => undefined, isCurrent: () => false, send: () => undefined, onTerminal,
    });
    await expect(controller.accept(params).completion).rejects.toThrow('open-failed');
    expect(onTerminal).toHaveBeenCalledWith(expect.objectContaining({ handler: params.handler }), 'open-failed');
  });
});
