import type { NappletMessage } from '@napplet/core';

import type { RuntimeAdapter, ServiceRegistry } from './types.js';

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

    const id = (msg as NappletMessage & { id?: string }).id ?? '';
    const action = msg.type.slice('identity.'.length);
    const signer = hooks.auth.getSigner();
    const sendError = (error: string) => {
      hooks.sendToNapplet(windowId, { type: `${msg.type}.error`, id, error } as NappletMessage);
    };
    const sendResult = (payload: Record<string, unknown>) => {
      hooks.sendToNapplet(windowId, { type: `${msg.type}.result`, id, ...payload } as NappletMessage);
    };

    switch (action) {
      case 'getPublicKey':
        if (!signer) { sendError('no signer configured'); return; }
        Promise.resolve(signer.getPublicKey?.())
          .then((pubkey) => sendResult({ pubkey }))
          .catch((err: unknown) => sendError((err as Error)?.message ?? 'getPublicKey failed'));
        return;
      case 'getRelays':
        if (!signer) { sendError('no signer configured'); return; }
        Promise.resolve(signer.getRelays?.() ?? {})
          .then((relays) => sendResult({ relays }))
          .catch((err: unknown) => sendError((err as Error)?.message ?? 'getRelays failed'));
        return;
      case 'getProfile': sendResult({ profile: null }); return;
      case 'getFollows': sendResult({ pubkeys: [] }); return;
      case 'getList': sendResult({ entries: [] }); return;
      case 'getZaps': sendResult({ zaps: [] }); return;
      case 'getMutes': sendResult({ pubkeys: [] }); return;
      case 'getBlocked': sendResult({ pubkeys: [] }); return;
      case 'getBadges': sendResult({ badges: [] }); return;
      default:
        sendError(`Unknown identity action: ${action}`);
    }
  };
}
