import { describe, expect, it, vi } from 'vitest';
import { confirmPajaExternalLink, hasPajaApprovalClick, notePajaApprovalClick } from './browser-link.js';

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

  it('opens inside the user activation and refuses once the source is no longer current', async () => {
    const confirm = vi.fn(async () => true);
    const open = vi.fn(() => true);
    let current = true;
    const identity = () => ({ dTag: 'reader', aggregateHash: 'sha256:current', isCurrent: () => current });
    const run = vi.fn(async (_request: unknown, operation: () => unknown) => operation());
    const activation = { run } as unknown as Parameters<typeof confirmPajaExternalLink>[4];
    await expect(confirmPajaExternalLink(request, confirm, identity, open, activation)).resolves.toEqual({ status: 'opened' });
    expect(confirm).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledOnce();
    current = false;
    await expect(confirmPajaExternalLink(request, confirm, identity, open, activation)).resolves.toEqual({ status: 'denied' });
    expect(open).toHaveBeenCalledOnce();
    run.mockRejectedValueOnce(new Error('dialog closed'));
    current = true;
    await expect(confirmPajaExternalLink(request, confirm, identity, open, activation)).resolves.toEqual({ status: 'denied' });
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

  it('opens a Firewall-approved link from the approving click without a second dialog', async () => {
    const confirm = vi.fn(async () => true);
    const open = vi.fn(() => true);
    const signal = new AbortController().signal;
    const result = await confirmPajaExternalLink({ ...request, signal }, confirm,
      () => ({ dTag: 'reader', aggregateHash: 'sha256:current' }), open, undefined, () => true);
    expect(result).toEqual({ status: 'opened' });
    expect(confirm).not.toHaveBeenCalled();
    expect(open).toHaveBeenCalledOnce();
  });

  it('still confirms when no click is live, the browser blocks the tab, or the Firewall did not approve', async () => {
    const confirm = vi.fn(async () => true);
    const identity = () => ({ dTag: 'reader', aggregateHash: 'sha256:current' });
    const signal = new AbortController().signal;

    const idle = vi.fn(() => true);
    await confirmPajaExternalLink({ ...request, signal }, confirm, identity, idle, undefined, () => false);
    expect(confirm).toHaveBeenCalledTimes(1);

    const blocked = vi.fn().mockReturnValueOnce(false).mockReturnValue(true);
    expect(await confirmPajaExternalLink({ ...request, signal }, confirm, identity, blocked, undefined, () => true))
      .toEqual({ status: 'opened' });
    expect(confirm).toHaveBeenCalledTimes(2);
    expect(blocked).toHaveBeenCalledTimes(2);

    const unapproved = vi.fn(() => true);
    await confirmPajaExternalLink(request, confirm, identity, unapproved, undefined, () => true);
    expect(confirm).toHaveBeenCalledTimes(3);
  });

  it('treats only a fresh approving click with live browser activation as openable', () => {
    vi.stubGlobal('navigator', { userActivation: { isActive: true } });
    try {
      // An unrelated click leaves the browser activated but approved nothing.
      expect(hasPajaApprovalClick(5_000)).toBe(false);
      notePajaApprovalClick(5_000);
      expect(hasPajaApprovalClick(5_400)).toBe(true);
      expect(hasPajaApprovalClick(6_001)).toBe(false);
      vi.stubGlobal('navigator', { userActivation: { isActive: false } });
      notePajaApprovalClick(7_000);
      expect(hasPajaApprovalClick(7_100)).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does not open from a live click once the approval was cancelled', async () => {
    const controller = new AbortController();
    controller.abort();
    const open = vi.fn(() => true);
    const result = await confirmPajaExternalLink({ ...request, signal: controller.signal }, vi.fn(async () => true),
      () => ({ dTag: 'reader', aggregateHash: 'sha256:current' }), open, undefined, () => true);
    expect(result).toEqual({ status: 'denied' });
    expect(open).not.toHaveBeenCalled();
  });
});
