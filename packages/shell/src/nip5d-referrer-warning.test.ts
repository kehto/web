import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** A minimal iframe stand-in: observeFrame only listens for `load` and reads attributes. */
function frame(referrerpolicy?: string) {
  return {
    addEventListener: () => {},
    removeEventListener: () => {},
    getAttribute: (name: string) => (name === 'referrerpolicy' ? referrerpolicy ?? null : null),
  } as unknown as HTMLIFrameElement;
}

async function freshTransport() {
  vi.resetModules();
  const { createNip5dTransport } = await import('./nip5d-transport.js');
  return createNip5dTransport({ hooks: {}, runtime: {}, state: {} } as never);
}

describe('observeFrame referrer-policy guidance', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
  afterEach(() => warn.mockRestore());

  const referrerWarnings = () => warn.mock.calls.filter((call: unknown[]) => String(call[0]).includes('referrerpolicy'));

  it('warns once, naming the fix, when a napplet frame has no referrer policy', async () => {
    const transport = await freshTransport();
    transport.observeFrame(frame(), 'a');
    transport.observeFrame(frame('origin'), 'b');
    expect(referrerWarnings()).toHaveLength(1);
    expect(String(referrerWarnings()[0]?.[0])).toContain('denyNappletReferrer(frame)');
    expect(String(referrerWarnings()[0]?.[0])).toContain('renderNappletReferrerPolicyMeta()');
  });

  it('stays quiet for frames that carry no-referrer', async () => {
    const transport = await freshTransport();
    transport.observeFrame(frame('no-referrer'), 'a');
    expect(referrerWarnings()).toHaveLength(0);
  });
});
