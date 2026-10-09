/** Origin-local presentation preferences, separate from runtime settings. */
export const PAJA_SIDEBAR_SECTIONS_STORAGE_KEY = 'kehto:paja:sidebar-sections:v1';
const SECTION_IDS = {
  pointer: 'runtime-pointer-section',
  interfaces: 'paja-section-interfaces',
  acl: 'paja-section-acl',
  signer: 'paja-section-signer',
  'resource-servers': 'paja-section-resource-servers',
  messages: 'paja-section-messages',
} as const;
type SectionKey = keyof typeof SECTION_IDS;

/**
 * Restore independent native details without replacing any live controls.
 * @returns Disposer for every section toggle listener.
 * @example
 * const dispose = installPajaSidebarSections();
 * window.addEventListener('pagehide', dispose, { once: true });
 */
export function installPajaSidebarSections(): () => void {
  const collapsed: Partial<Record<SectionKey, boolean>> = {};
  const keys = Object.keys(SECTION_IDS) as SectionKey[];
  try {
    const value: unknown = JSON.parse(localStorage.getItem(PAJA_SIDEBAR_SECTIONS_STORAGE_KEY) ?? 'null');
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      for (const key of keys) {
        if (Object.hasOwn(value, key) && typeof (value as Record<string, unknown>)[key] === 'boolean') {
          collapsed[key] = (value as Record<string, boolean>)[key];
        }
      }
    }
  } catch {
    // Untrusted or unavailable storage must never block host startup.
  }
  const disposers: (() => void)[] = [];
  for (const key of keys) {
    const section = document.getElementById(SECTION_IDS[key]) as HTMLDetailsElement | null;
    if (!section) continue;
    section.open = collapsed[key] !== true;
    let lastOpen = section.open;
    const toggle = (): void => {
      if (section.open === lastOpen) return;
      lastOpen = section.open;
      collapsed[key] = !lastOpen;
      try {
        localStorage.setItem(PAJA_SIDEBAR_SECTIONS_STORAGE_KEY, JSON.stringify(collapsed));
      } catch {
        // Native toggles remain usable in-session if persistence is denied.
      }
    };
    section.addEventListener('toggle', toggle);
    disposers.push(() => section.removeEventListener('toggle', toggle));
  }
  return () => disposers.forEach((dispose) => dispose());
}
