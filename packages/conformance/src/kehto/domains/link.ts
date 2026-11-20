import { createLinkService } from '@kehto/services';
import type { DomainBackendModule } from './types.js';

/** NAP-LINK backend: the reference link service with an opener that only records the URL. */
export const LINK_BACKEND: DomainBackendModule = {
  domain: 'link',
  create() {
    const opened: string[] = [];
    return {
      services: { link: createLinkService({ open: ({ url }) => { opened.push(url.href); return { status: 'opened' }; } }) },
      adapter: { link: { isAvailable: () => true } },
      controls: {
        /** Evidence: every URL the shell handed to its opener, oldest first. */
        'link.opened': () => [...opened],
      },
    };
  },
};
