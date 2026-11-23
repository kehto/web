declare const console: { warn(message: string): void };

/** Stable identifier on the host diagnostic for an ignored unrecognized type. */
export const KEHTO_UNRECOGNIZED_MESSAGE_TYPE = 'KEHTO_UNRECOGNIZED_MESSAGE_TYPE';

/** Distinct domain/type pairs one diagnostic reports before it goes quiet. */
export const UNRECOGNIZED_TYPE_WARNING_LIMIT = 16;

const PRINTABLE_TYPE = /^[a-z][a-zA-Z0-9]{0,31}(\.[a-zA-Z0-9]{1,32}){1,4}$/;
const PRINTABLE_TYPE_LENGTH = 64;

/**
 * Records that a message was dropped because its `type` is not defined by the
 * domain's NAP. It never replies to the napplet.
 *
 * @param domain - The domain the caller owns, as a fixed string such as `serial`.
 * @param type - The napplet-supplied `type`. It is logged only when it is a short,
 *   plain `domain.action` string.
 */
export type IgnoreUnrecognizedType = (domain: string, type: unknown) => void;

/** Options for {@link createUnrecognizedTypeDiagnostic}. */
export interface UnrecognizedTypeDiagnosticOptions {
  /** Where the warning goes. Default: `console.warn`. */
  warn?: (message: string) => void;
}

/**
 * Create the host-side diagnostic for unrecognized message types.
 *
 * NIP-5D (nostr-protocol/nips#2303 at dskvr/nips@f60550c3) says "Messages with
 * an unrecognized `type` MUST be silently ignored" and that this prevents
 * capability probing, so a service drops such a message and calls the returned
 * function instead of answering. The host still hears about it once:
 *
 * - one warning per domain/type pair per diagnostic instance;
 * - at most {@link UNRECOGNIZED_TYPE_WARNING_LIMIT} pairs, then one final line
 *   and silence, so a napplet cannot flood the log with invented types;
 * - the type is printed only when it is a plain `domain.action` string of at
 *   most 64 characters. Anything else is reported as `<unprintable>`. Payloads,
 *   ids and window ids are never logged.
 *
 * Create one per service or runtime instance, not per message.
 *
 * @param options - Optional warning sink.
 * @returns A function to call for every dropped message.
 * @example
 * ```ts
 * import { createUnrecognizedTypeDiagnostic } from '@kehto/runtime';
 *
 * const ignoreUnrecognized = createUnrecognizedTypeDiagnostic();
 * function handleMessage(windowId: string, message: NappletMessage, send: Send): void {
 *   if (message.type === 'serial.open') return open(windowId, message, send);
 *   ignoreUnrecognized('serial', message.type); // no reply
 * }
 * ```
 */
export function createUnrecognizedTypeDiagnostic(
  options: UnrecognizedTypeDiagnosticOptions = {},
): IgnoreUnrecognizedType {
  const warn = options.warn ?? ((message: string): void => console.warn(message));
  const seen = new Set<string>();
  let exhausted = false;
  return (domain, type) => {
    if (exhausted) return;
    const printable = typeof type === 'string' && type.length <= PRINTABLE_TYPE_LENGTH && PRINTABLE_TYPE.test(type);
    const label = printable ? type : '<unprintable>';
    const key = `${domain}\u0000${label}`;
    if (seen.has(key)) return;
    if (seen.size >= UNRECOGNIZED_TYPE_WARNING_LIMIT) {
      exhausted = true;
      warn(`[${KEHTO_UNRECOGNIZED_MESSAGE_TYPE}] Reached ${UNRECOGNIZED_TYPE_WARNING_LIMIT} distinct unrecognized types; further ones are ignored without a warning.`);
      return;
    }
    seen.add(key);
    warn(`[${KEHTO_UNRECOGNIZED_MESSAGE_TYPE}] Ignored "${label}": the ${domain} NAP does not define this type, so the napplet gets no reply (NIP-5D ignores unrecognized types). If a napplet needs it, it is a newer NAP revision or an extension this host has not implemented. Warned once per type, at most ${UNRECOGNIZED_TYPE_WARNING_LIMIT} types per instance.`);
  };
}
