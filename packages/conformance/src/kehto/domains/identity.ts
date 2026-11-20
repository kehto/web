import { createIdentityService } from '@kehto/services';
import { FIXTURE_PEER_PUBKEY } from '../user.js';
import type { DomainBackendModule } from './types.js';

/** NAP-IDENTITY backend: the reference identity service over the fixture user. */
export const IDENTITY_BACKEND: DomainBackendModule = {
  domain: 'identity',
  create({ user }) {
    return {
      services: {
        identity: createIdentityService({
          getSigner: () => user.current(),
          getProfile: () => ({ name: 'conformance' }),
          getFollows: () => [FIXTURE_PEER_PUBKEY],
          getList: (listType) => [listType],
          getZaps: () => [],
          getMutes: () => [],
          getBlocked: () => [],
          getBadges: () => [],
        }),
      },
      controls: {
        'identity.signOut': (_payload, { bridge }) => { user.signedIn = false; bridge.publishIdentityChanged(''); },
        'identity.signIn': (_payload, { bridge }) => { user.signedIn = true; bridge.publishIdentityChanged(user.pubkey() ?? ''); },
      },
    };
  },
};
