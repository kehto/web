export function hasNappletDomain(domain: string): boolean {
  const napplet = window.napplet as Record<string, unknown> | undefined;
  return typeof napplet === 'object' && napplet !== null && domain in napplet;
}

export function getMissingNapDomains(domains: readonly string[]): string[] {
  return domains.filter((domain) => !hasNappletDomain(domain));
}
