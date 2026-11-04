/**
 * Block lifecycle builder shared by the NAP-LLM stream accumulators.
 *
 * Providers stream fragments; NAP-LLM streams blocks. The builder assigns each
 * block its `blockIndex` on first appearance, turns fragments into `start`,
 * `delta` and `end` events, and produces the terminal content in index order so
 * the streamed lifecycle and the authoritative result agree by construction.
 * Empty fragments are never emitted, and a block never starts without content,
 * so an empty provider block consumes no index.
 */

import type { LlmBlockEvent, LlmOutputPart } from './llm-types.js';

type TextualKind = 'text' | 'thinking';

type TextualBlock = {
  readonly kind: TextualKind;
  readonly index: number;
  text: string;
  open: boolean;
};

/** Accumulates provider fragments into ordered block events and terminal content. */
export interface LlmBlockBuilder {
  /**
   * Append a fragment to the block registered under `key`, starting it on first
   * appearance. An empty fragment starts nothing.
   * @returns Ordered events produced by this fragment.
   */
  append(kind: TextualKind, key: string, fragment: string): LlmBlockEvent[];
  /** End one open block. Unknown or already ended keys produce no events. */
  end(key: string): LlmBlockEvent[];
  /** End every block still open, in index order. */
  closeAll(): LlmBlockEvent[];
  /** Terminal content ordered by `blockIndex`. */
  content(): LlmOutputPart[];
}

/**
 * Create an empty block builder for one generation.
 *
 * @returns A builder with text and thinking blocks.
 * @example
 * const blocks = createLlmBlockBuilder();
 * const events = blocks.append('text', 'text', 'Hello');
 */
export function createLlmBlockBuilder(): LlmBlockBuilder {
  const blocks = new Map<string, TextualBlock>();
  let next = 0;
  return {
    append(kind, key, fragment) {
      if (fragment === '') return [];
      const events: LlmBlockEvent[] = [];
      let block = blocks.get(key);
      if (!block) {
        block = { kind, index: next++, text: '', open: true };
        blocks.set(key, block);
        events.push({ event: 'start', block: kind, blockIndex: block.index });
      }
      if (!block.open) return [];
      block.text += fragment;
      events.push({ event: 'delta', block: kind, blockIndex: block.index, text: fragment });
      return events;
    },
    end(key) {
      const block = blocks.get(key);
      if (!block?.open) return [];
      block.open = false;
      return [{ event: 'end', block: block.kind, blockIndex: block.index }];
    },
    closeAll() {
      const events: LlmBlockEvent[] = [];
      for (const block of [...blocks.values()].sort((a, b) => a.index - b.index)) {
        if (!block.open) continue;
        block.open = false;
        events.push({ event: 'end', block: block.kind, blockIndex: block.index });
      }
      return events;
    },
    content() {
      return [...blocks.values()].sort((a, b) => a.index - b.index).map((block) => ({ type: block.kind, text: block.text }));
    },
  };
}
