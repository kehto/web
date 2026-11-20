import { describe, expect, it, vi } from 'vitest';
import {
  createUnrecognizedTypeDiagnostic,
  KEHTO_UNRECOGNIZED_MESSAGE_TYPE,
  UNRECOGNIZED_TYPE_WARNING_LIMIT,
} from './unrecognized-type.js';

declare const console: { warn(message: string): void };

// kehto/web#465. NIP-5D (nostr-protocol/nips#2303 @ dskvr/nips@f60550c3):
// "Messages with an unrecognized `type` MUST be silently ignored." The napplet
// gets nothing; only the host sees this diagnostic.
describe('createUnrecognizedTypeDiagnostic', () => {
  it('warns once per domain/type with the stable id and an actionable line', () => {
    const warn = vi.fn<(message: string) => void>();
    const ignore = createUnrecognizedTypeDiagnostic({ warn });

    ignore('serial', 'serial.bogus');
    ignore('serial', 'serial.bogus');
    ignore('serial', 'serial.other');
    ignore('ble', 'serial.bogus');

    expect(warn).toHaveBeenCalledTimes(3);
    const [first] = warn.mock.calls[0];
    expect(first.startsWith(`[${KEHTO_UNRECOGNIZED_MESSAGE_TYPE}]`)).toBe(true);
    expect(first).toContain('"serial.bogus"');
    expect(first).toContain('the serial NAP does not define this type');
    expect(first).toContain('no reply');
    expect(first).toContain(`at most ${UNRECOGNIZED_TYPE_WARNING_LIMIT} types per instance`);
  });

  it('never prints a type that is not a short plain domain.action string', () => {
    const warn = vi.fn<(message: string) => void>();
    const ignore = createUnrecognizedTypeDiagnostic({ warn });

    ignore('relay', 'relay.x\n[FAKE] forged line');
    ignore('relay', `relay.${'a'.repeat(80)}`);
    ignore('relay', 42);

    // All three collapse into one <unprintable> key for the domain.
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('"<unprintable>"');
    expect(warn.mock.calls[0][0]).not.toContain('FAKE');
  });

  it('goes quiet after the distinct-type limit with one final line', () => {
    const warn = vi.fn<(message: string) => void>();
    const ignore = createUnrecognizedTypeDiagnostic({ warn });

    for (let i = 0; i < UNRECOGNIZED_TYPE_WARNING_LIMIT + 10; i += 1) ignore('notify', `notify.bogus${i}`);

    expect(warn).toHaveBeenCalledTimes(UNRECOGNIZED_TYPE_WARNING_LIMIT + 1);
    expect(warn.mock.calls.at(-1)?.[0]).toContain('further ones are ignored without a warning');
  });

  it('keeps separate budgets per instance and defaults to console.warn', () => {
    const spy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    createUnrecognizedTypeDiagnostic()('keys', 'keys.bogus');
    createUnrecognizedTypeDiagnostic()('keys', 'keys.bogus');
    expect(spy).toHaveBeenCalledTimes(2);
    spy.mockRestore();
  });
});
