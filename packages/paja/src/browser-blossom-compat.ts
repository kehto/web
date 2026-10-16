let warned = false;

/** Report deprecated Blossom prefix use once per host module lifetime. */
export function warnLegacyBlossomPrefix(value: string): void {
  if (warned || !/^blossom:sha256:/i.test(value)) return;
  warned = true;
  console.warn('[KEHTO_COMPAT_BLOSSOM_SHA256] Replace blossom:sha256:<hash> with blossom:<hash>; preserve any extension and hints. Warning shown once per host module lifetime.');
}
