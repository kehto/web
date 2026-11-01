/**
 * Confirmation requests Paja raises before user-visible operations.
 *
 * Each variant carries only what the confirmation dialog shows and logs; prompt
 * bodies, credentials and secrets stay out of these records.
 */

import type { NostrEvent } from '@napplet/core';
import type { PajaSignerRequestContext } from './browser-signer-consent.js';

/** Confirmation request emitted before Paja signs, publishes, or uploads. */
export type PajaConfirmationRequest = (
  | {
      readonly action: 'sign' | 'publish';
      readonly event: NostrEvent | Partial<NostrEvent>;
      readonly signerContext?: PajaSignerRequestContext;
    }
  | {
      readonly action: 'upload';
      readonly windowId: string;
      readonly napplet: { readonly dTag: string; readonly aggregateHash: string };
      readonly filename?: string;
      readonly size: number;
      readonly mimeType?: string;
      readonly server: string;
      readonly warning: string;
    }
  | {
      readonly action: 'link';
      readonly windowId: string;
      readonly napplet: { readonly dTag: string; readonly aggregateHash: string };
      readonly url: string;
      readonly label?: string;
    }
  | {
      readonly action: 'serial' | 'ble';
      readonly windowId: string;
      readonly label?: string;
      readonly details: string;
    }
  | {
      readonly action: 'notify';
      readonly windowId: string;
      readonly napplet: { readonly dTag: string; readonly aggregateHash: string };
      readonly channel?: string;
    }
  | {
      readonly action: 'webrtc';
      readonly windowId: string;
      readonly napplet: { readonly dTag: string; readonly aggregateHash: string };
      readonly scope: string;
      readonly warning: string;
    }
  | {
      readonly action: 'dm';
      readonly recipients: readonly string[];
      readonly content: string;
      readonly warning: string;
    }
  | {
      /** NAP-LLM disclosure consent before one generation is submitted. */
      readonly action: 'llm';
      readonly windowId: string;
      readonly napplet: { readonly dTag: string; readonly aggregateHash: string };
      readonly connection: string;
      readonly model: string;
      readonly route: string;
      readonly messages: number;
      readonly characters: number;
      readonly images: number;
      readonly format: 'text' | 'json';
      readonly warning: string;
    }
  | {
      /** A napplet asked for a model while no compatible connection is configured. */
      readonly action: 'llm-configure';
      readonly windowId: string;
      readonly napplet: { readonly dTag: string; readonly aggregateHash: string };
      readonly requirements: string;
      readonly configured: number;
    }
  | {
      readonly action: 'fs';
      readonly windowId: string;
      readonly kind: 'file' | 'files' | 'directory' | 'save-file';
      readonly description: string;
    }) & {
      readonly isCurrent?: () => boolean;
      /** Withdraws the request: a queued prompt is dropped and an open dialog closes as denied. */
      readonly signal?: AbortSignal;
    };

