import { describe, expect, it, vi } from 'vitest';
import { confirmPajaExternalLink } from './browser-link.js';

const request = { windowId: 'window-1', url: new URL('https://example.test/article'),
  options: { label: 'Read article' } };

describe('Paja LINK confirmation', () => {
  it('opens the approved exact link for the current verified artifact', async () => {
    const confirm = vi.fn(async () => true);
    const open = vi.fn(() => true);
    const result = await confirmPajaExternalLink(request, confirm,
      () => ({ dTag: 'reader', aggregateHash: 'sha256:current' }), open);
    expect(result).toEqual({ status: 'opened' });
    expect(confirm).toHaveBeenCalledWith(expect.objectContaining({
      action: 'link', windowId: 'window-1', url: 'https://example.test/article',
      napplet: { dTag: 'reader', aggregateHash: 'sha256:current' },
    }));
    expect(open).toHaveBeenCalledOnce();
  });

  it('drops a stale allow after approval cancellation', async () => {
    const controller = new AbortController();
    let answer!: (value: boolean) => void;
    const confirm = () => new Promise<boolean>((resolve) => { answer = resolve; });
    const open = vi.fn(() => true);
    const pending = confirmPajaExternalLink({ ...request, signal: controller.signal }, confirm,
      () => ({ dTag: 'reader', aggregateHash: 'sha256:current' }), open);
    controller.abort();
    answer(true);
    expect(await pending).toEqual({ status: 'denied' });
    expect(open).not.toHaveBeenCalled();
  });

  it('does not reuse a confirmation after artifact replacement', async () => {
    let hash = 'sha256:first';
    let answer!: (value: boolean) => void;
    const confirm = () => new Promise<boolean>((resolve) => { answer = resolve; });
    const open = vi.fn(() => true);
    const pending = confirmPajaExternalLink(request, confirm,
      () => ({ dTag: 'reader', aggregateHash: hash }), open);
    hash = 'sha256:second';
    answer(true);
    expect(await pending).toEqual({ status: 'denied' });
    expect(open).not.toHaveBeenCalled();
  });
});
