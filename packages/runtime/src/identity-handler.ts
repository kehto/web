import type { NappletMessage } from '@napplet/core';

import type { RuntimeAdapter, ServiceRegistry } from './types.js';
import { createCanonicalDomainResult } from './domain-results.js';

type IdentityHandlerContext = {
  hooks: RuntimeAdapter;
  serviceRegistry: ServiceRegistry;
};

export type IdentityHandler = (windowId: string, msg: NappletMessage) => void;

export function createIdentityHandler(context: IdentityHandlerContext): IdentityHandler {
  return function handleIdentityMessage(windowId: string, msg: NappletMessage): void {
    const { hooks, serviceRegistry } = context;
    const identityService = serviceRegistry['identity'];
    if (identityService) {
      identityService.handleMessage(windowId, msg, (resp: NappletMessage) => hooks.sendToNapplet(windowId, resp));
      return;
    }

    const action = msg.type.slice('identity.'.length);
    const signer = hooks.auth.getSigner();
    const fallback = createCanonicalDomainResult(msg);
    if (!fallback) return;
    const sendResult = (payload: Record<string, unknown> = {}) => {
      hooks.sendToNapplet(windowId, { ...fallback, ...payload } as NappletMessage);
    };

    switch (action) {
      case 'getPublicKey':
        if (!signer) { sendResult({ pubkey: '' }); return; }
        Promise.resolve(signer.getPublicKey?.())
          .then((pubkey) => sendResult({ pubkey: pubkey ?? '' }))
          .catch(() => sendResult({ pubkey: '' }));
        return;
      case 'getRelays':
        if (!signer) { sendResult(); return; }
        Promise.resolve(signer.getRelays?.() ?? {})
          .then((relays) => sendResult({ relays }))
          .catch(() => sendResult());
        return;
      case 'getProfile': sendResult({ profile: null }); return;
      case 'getFollows': sendResult({ pubkeys: [] }); return;
      case 'getList': sendResult({ entries: [] }); return;
      case 'getZaps': sendResult({ zaps: [] }); return;
      case 'getMutes': sendResult({ pubkeys: [] }); return;
      case 'getBlocked': sendResult({ pubkeys: [] }); return;
      case 'getBadges': sendResult({ badges: [] }); return;
      default: return;
    }
  };
}
