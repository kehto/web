/**
 * webrtc-service.ts — NAP-WEBRTC reference service.
 *
 * Shell-mediated WebRTC sessions. The napplet requests `webrtc.*`; the shell
 * owns signaling, signing/encryption, SDP, ICE, peer connections, and policy.
 */

import type {
  NappletMessage,
  WebrtcEvent,
  WebrtcOpenRequest,
  WebrtcOpenResult,
} from '@napplet/core';
import type {
  WebrtcCloseMessage,
  WebrtcOpenMessage,
  WebrtcSendMessage,
} from '@napplet/nap/webrtc/types';
import type { ServiceDescriptor, ServiceHandler } from '@kehto/runtime';

const WEBRTC_SERVICE_VERSION = '1.0.0';

/** Context passed to host-provided NAP-WEBRTC hooks. */
export interface WebrtcServiceContext {
  /** Window id of the requesting napplet. */
  windowId: string;
  /** Emit a runtime-owned WebRTC event back to the requesting napplet. */
  emit(event: WebrtcEvent): void;
}

/** Options for {@link createWebrtcService}. */
export interface WebrtcServiceOptions {
  /** Host-owned WebRTC open hook. */
  open?: (
    request: WebrtcOpenRequest,
    context: WebrtcServiceContext,
  ) => WebrtcOpenResult | Promise<WebrtcOpenResult>;
  /** Host-owned WebRTC send hook. */
  send?: (
    sessionId: string,
    payload: unknown,
    context: WebrtcServiceContext,
  ) => void | Promise<void>;
  /** Host-owned WebRTC close hook. */
  close?: (
    sessionId: string,
    reason: string | undefined,
    context: WebrtcServiceContext,
  ) => void | Promise<void>;
  /** Optional host cleanup when a napplet window is destroyed. */
  destroyWindow?: (windowId: string) => void;
}

type Send = (msg: NappletMessage) => void;

const WEBRTC_DESCRIPTOR: ServiceDescriptor = {
  name: 'webrtc',
  version: WEBRTC_SERVICE_VERSION,
  description: 'NAP-WEBRTC reference handler for shell-mediated WebRTC sessions',
};

function errorMessage(err: unknown, fallback: string): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  return fallback;
}

function settle<T>(
  call: () => T | Promise<T>,
  send: Send,
  okFalse: (error: string) => NappletMessage,
  onValue: (value: T) => NappletMessage,
): void {
  let pending: Promise<T>;
  try {
    pending = Promise.resolve(call());
  } catch (err) {
    send(okFalse(errorMessage(err, 'webrtc request failed')));
    return;
  }
  pending
    .then((value) => send(onValue(value)))
    .catch((err) => send(okFalse(errorMessage(err, 'webrtc request failed'))));
}

function unsupported(resultType: string, id: string): NappletMessage {
  return {
    type: resultType,
    id,
    error: `${resultType.replace('.result', '')} unavailable`,
  } as NappletMessage;
}

function createContext(windowId: string, send: Send): WebrtcServiceContext {
  return {
    windowId,
    emit(event) {
      send({ type: 'webrtc.event', event } as NappletMessage);
    },
  };
}

/**
 * Create the NAP-WEBRTC reference service.
 *
 * @param options - Host WebRTC session hooks for webrtc.* requests.
 * @returns A runtime service handler for the `webrtc` domain.
 */
export function createWebrtcService(options: WebrtcServiceOptions = {}): ServiceHandler {
  return {
    descriptor: WEBRTC_DESCRIPTOR,
    handleMessage(windowId: string, message: NappletMessage, send: Send): void {
      const id = (message as NappletMessage & { id?: string }).id ?? '';
      const context = createContext(windowId, send);

      if (message.type === 'webrtc.open') {
        if (!options.open) {
          send(unsupported('webrtc.open.result', id));
          return;
        }
        const webrtcMessage = message as WebrtcOpenMessage;
        settle(
          () => options.open!(webrtcMessage.request, context),
          send,
          (error) => ({ type: 'webrtc.open.result', id, error } as NappletMessage),
          (result) => ({ type: 'webrtc.open.result', id, session: result.session } as NappletMessage),
        );
        return;
      }

      if (message.type === 'webrtc.send') {
        if (!options.send) {
          send(unsupported('webrtc.send.result', id));
          return;
        }
        const webrtcMessage = message as WebrtcSendMessage;
        settle(
          () => options.send!(webrtcMessage.sessionId, webrtcMessage.payload, context),
          send,
          (error) => ({ type: 'webrtc.send.result', id, error } as NappletMessage),
          () => ({ type: 'webrtc.send.result', id } as NappletMessage),
        );
        return;
      }

      if (message.type === 'webrtc.close') {
        if (!options.close) {
          send(unsupported('webrtc.close.result', id));
          return;
        }
        const webrtcMessage = message as WebrtcCloseMessage;
        settle(
          () => options.close!(webrtcMessage.sessionId, webrtcMessage.reason, context),
          send,
          (error) => ({ type: 'webrtc.close.result', id, error } as NappletMessage),
          () => ({ type: 'webrtc.close.result', id } as NappletMessage),
        );
        return;
      }

      send({
        type: `${message.type}.error`,
        id,
        error: `Unknown webrtc method: ${message.type}`,
      } as NappletMessage);
    },
    onWindowDestroyed(windowId: string): void {
      options.destroyWindow?.(windowId);
    },
  };
}
