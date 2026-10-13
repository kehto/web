type NappletWindow = Window & {
  napplet?: Record<string, unknown>;
};

/** Return whether the runtime injected a domain for this load. */
export function hasDomain(
  napplet: Record<string, unknown> | undefined,
  domain: string,
): boolean {
  return Boolean(napplet?.[domain]);
}

/** Check a domain on the runtime-owned global without exposing it for calls. */
export function runtimeHasDomain(domain: string): boolean {
  return hasDomain((window as NappletWindow).napplet, domain);
}
