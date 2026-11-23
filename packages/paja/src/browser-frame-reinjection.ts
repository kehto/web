import { originRegistry } from '@kehto/shell';

/**
 * Domains that appeared in or left Paja's advertised set during one host
 * wiring change, such as a signer connect that makes `webrtc` routable.
 */
export interface PajaDomainChange {
  readonly added: readonly string[];
  readonly removed: readonly string[];
}

/**
 * What each launched napplet Window asked for, so a later domain change can
 * tell whether it would change that frame's injection. `null` means the
 * napplet declared nothing and is offered every available domain.
 */
const declaredByWindow = new WeakMap<Window, ReadonlySet<string> | null>();

/**
 * Record the domains a frame's napplet declared before its admission starts.
 *
 * @param frame - The frame being launched; its current Window is the key.
 * @param required - Declared required domains.
 * @param optional - Declared optional domains.
 * @param declared - Whether the napplet declared any domain at all.
 * @example
 * ```ts
 * recordPajaFrameDeclarations(frame, ['relay'], ['identity'], true);
 * ```
 */
export function recordPajaFrameDeclarations(
  frame: HTMLIFrameElement,
  required: readonly string[],
  optional: readonly string[],
  declared: boolean,
): void {
  const win = frame.contentWindow;
  if (win) declaredByWindow.set(win, declared ? new Set([...required, ...optional]) : null);
}

/**
 * Compare two advertised domain lists.
 *
 * @param before - Domains advertised before the change.
 * @param after - Domains advertised after it.
 * @returns The added and removed domains.
 * @example
 * ```ts
 * diffPajaDomains(['relay'], ['relay', 'webrtc']); // { added: ['webrtc'], removed: [] }
 * ```
 */
export function diffPajaDomains(before: readonly string[], after: readonly string[]): PajaDomainChange {
  return {
    added: after.filter((domain) => !before.includes(domain)),
    removed: before.filter((domain) => !after.includes(domain)),
  };
}

/**
 * Decide whether a domain change requires a fresh frame. NIP-5D (nips#2303
 * head f60550c3, Transport) injects `window.napplet` before any napplet script
 * runs, and presence of a domain object means that domain is available, so a
 * frame's domains are fixed for its document. Only a change to the set
 * that frame would be offered needs a new document: an added domain it
 * declared (or any domain, when it declared none), or a removed domain it was
 * admitted. Anything else, including a shell-user identity change on its own,
 * leaves the frame running (NAP-IDENTITY pushes `identity.changed` instead).
 *
 * @param frame - The frame to check, or null when none is mounted.
 * @param change - The advertised-domain change.
 * @returns True when the frame must be reloaded to see the new domain set.
 * @example
 * ```ts
 * if (pajaFrameNeedsReinjection(frame, change)) state.reload();
 * ```
 */
export function pajaFrameNeedsReinjection(frame: HTMLIFrameElement | null | undefined, change: PajaDomainChange): boolean {
  if (change.added.length === 0 && change.removed.length === 0) return false;
  const win = frame?.contentWindow;
  // No committed napplet yet (booting, error page, pending approval): its
  // admission may already hold the old set, so start it again.
  if (!win || originRegistry.getWindowId(win) === undefined) return true;
  const declared = declaredByWindow.get(win);
  if (declared === undefined) return true;
  const admitted = originRegistry.getEnvironment(win)?.capabilities.domains ?? [];
  return change.removed.some((domain) => admitted.includes(domain))
    || change.added.some((domain) => declared === null || declared.has(domain));
}

/** Tracks Paja's advertised domain set between host wiring changes. */
export interface PajaReinjectionGate {
  /** Take the current advertised set as the baseline. */
  snapshot(): void;
  /**
   * Re-read the advertised set and report whether `frame` needs a fresh document.
   * Without a baseline it answers true, which keeps the old reload-always behavior.
   */
  shouldReload(frame: HTMLIFrameElement | null | undefined): boolean;
}

/**
 * Create the gate Paja consults before reloading a frame on a host wiring change.
 *
 * @param readDomains - Reads the domains Paja advertises right now.
 * @returns The gate.
 * @example
 * ```ts
 * const gate = createPajaReinjectionGate(() => buildShellCapabilities(adapter).domains);
 * gate.snapshot();
 * if (gate.shouldReload(frame)) state.reload();
 * ```
 */
export function createPajaReinjectionGate(readDomains: () => readonly string[]): PajaReinjectionGate {
  let advertised: readonly string[] | null = null;
  return {
    snapshot() { advertised = [...readDomains()]; },
    shouldReload(frame) {
      const next = [...readDomains()];
      const previous = advertised;
      advertised = next;
      return previous === null || pajaFrameNeedsReinjection(frame, diffPajaDomains(previous, next));
    },
  };
}
