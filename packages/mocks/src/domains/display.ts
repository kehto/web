/**
 * domains/display.ts — Mock NAP-DISPLAY service.
 *
 * Spec: naps/NAP-DISPLAY.md @ napplet/naps PR #97 head 2c2e1b5ca384 (draft)
 * Routes: display.list, display.push
 * Spec gaps / decisions:
 * - No `@napplet/nap/display/types` in nap 0.32.0; shapes are local.
 * - One seeded 32×8 LED matrix (`badge`); its RGB framebuffer lives in state
 *   so a shell/devtool can render what napplets pushed.
 * - A whole batch is validated before any pixel is applied; `too-large`
 *   fires when a batch exceeds `maxBatchPixels` (default: the display area).
 * - `denied` / `unavailable` are simulated per display id through options.
 * - `display.list` never fails in this mock (no shell policy to deny listing).
 */
import { defineMockService } from '../core/handler.js';
import type { MockDomainEntry, MockService, MockServiceOptions, NapSpecRef } from '../core/types.js';

/** NAP-DISPLAY document checked for this mock. */
export const DISPLAY_SPEC_REF: NapSpecRef = { nap: 'NAP-DISPLAY', status: 'draft', source: 'pr', pr: 97, sha: '2c2e1b5ca384', path: 'naps/NAP-DISPLAY.md' };

/** `DisplayType` from the NAP. */
export type MockDisplayType = 'lcd' | 'eink' | 'led-matrix' | 'other';

/** `DisplayDevice` from the NAP. */
export interface MockDisplayDevice {
  /** Opaque stable id. */
  id: string;
  /** Logical width (px). */
  width: number;
  /** Logical height (px). */
  height: number;
  /** Device type. */
  type: MockDisplayType;
}

/** `Pixel` from the NAP. */
export interface MockDisplayPixel {
  /** Zero-based x. */
  x: number;
  /** Zero-based y. */
  y: number;
  /** Exactly `[r, g, b]`, each 0..255. */
  bytes: number[];
}

/** Error codes defined by the NAP. */
export type MockDisplayError = 'not-found' | 'unavailable' | 'denied' | 'invalid-pixel' | 'too-large';

/** In-memory state of the display mock. */
export interface MockDisplayState {
  /** Displays the shell permits. */
  displays: MockDisplayDevice[];
  /** RGB framebuffer per display id (`width * height * 3` bytes, row-major). */
  framebuffers: Map<string, Uint8Array>;
  /** Accepted batches per display id, in arrival order. */
  batches: Map<string, number>;
}

/**
 * Factory options for the display mock.
 *
 * @example
 * ```ts
 * const display = createMockDisplayService({ denied: ['desk'] });
 * ```
 */
export interface MockDisplayOptions extends MockServiceOptions {
  /** Displays to seed. Default: `MOCK_DISPLAYS`. */
  displays?: readonly MockDisplayDevice[];
  /** Max pixels per batch. Default: the target display's area. */
  maxBatchPixels?: number;
  /** Display ids that reject pushes with `denied`. */
  denied?: readonly string[];
  /** Display ids that reject pushes with `unavailable`. */
  unavailable?: readonly string[];
}

/** Display mock plus framebuffer readers. */
export type MockDisplayService = MockService<MockDisplayState> & {
  /** Read `[r, g, b]` at a coordinate, or `undefined` when out of range. */
  pixelAt(displayId: string, x: number, y: number): [number, number, number] | undefined;
};

/** Default seeded displays: one 32×8 LED badge. */
export const MOCK_DISPLAYS: readonly MockDisplayDevice[] = Object.freeze([
  { id: 'badge', width: 32, height: 8, type: 'led-matrix' },
]);

const isByte = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0 && (value as number) <= 255;

function validateBatch(display: MockDisplayDevice, pixels: unknown, maxBatch: number): MockDisplayError | MockDisplayPixel[] {
  if (!Array.isArray(pixels) || pixels.length === 0) return 'invalid-pixel';
  if (pixels.length > maxBatch) return 'too-large';
  const seen = new Set<number>();
  const batch: MockDisplayPixel[] = [];
  for (const item of pixels as unknown[]) {
    const pixel = item as Partial<MockDisplayPixel> | null;
    if (!pixel || typeof pixel !== 'object' || !Number.isInteger(pixel.x) || !Number.isInteger(pixel.y)) return 'invalid-pixel';
    const { x, y, bytes } = pixel as MockDisplayPixel;
    if (x < 0 || x >= display.width || y < 0 || y >= display.height) return 'invalid-pixel';
    if (!Array.isArray(bytes) || bytes.length !== 3 || !bytes.every(isByte)) return 'invalid-pixel';
    const key = y * display.width + x;
    if (seen.has(key)) return 'invalid-pixel';
    seen.add(key);
    batch.push({ x, y, bytes: [...bytes] });
  }
  return batch;
}

/**
 * Create the NAP-DISPLAY mock.
 *
 * @param options - Seeded displays, batch cap, denied/unavailable ids.
 * @returns A `display` extension with a `pixelAt` reader.
 * @example
 * ```ts
 * const display = createMockDisplayService();
 * display.handleMessage('w1', { type: 'display.push', id: 'd2', displayId: 'badge', pixels: [{ x: 0, y: 0, bytes: [255, 0, 0] }] }, send);
 * display.pixelAt('badge', 0, 0); // [255, 0, 0]
 * ```
 */
export function createMockDisplayService(options: MockDisplayOptions = {}): MockDisplayService {
  const mock = defineMockService<MockDisplayState>({
    domain: 'display',
    version: '0.1.0',
    description: 'Mock NAP-DISPLAY runtime-controlled pixel displays',
    kind: 'extension',
    initialState: () => {
      const displays = (options.displays ?? MOCK_DISPLAYS).map((item) => ({ ...item }));
      return { displays, framebuffers: new Map(displays.map((item) => [item.id, new Uint8Array(item.width * item.height * 3)])), batches: new Map() };
    },
    routes: {
      'display.list': ({ state, reply }) => reply({ displays: state.displays.map((item) => ({ ...item })) }),
      'display.push': ({ message, state, reply, fail }) => {
        const display = state.displays.find((item) => item.id === message.displayId);
        if (!display) return fail('not-found');
        if (options.unavailable?.includes(display.id)) return fail('unavailable');
        if (options.denied?.includes(display.id)) return fail('denied');
        const batch = validateBatch(display, message.pixels, options.maxBatchPixels ?? display.width * display.height);
        if (typeof batch === 'string') return fail(batch);
        const buffer = state.framebuffers.get(display.id)!;
        for (const { x, y, bytes } of batch) buffer.set(bytes, (y * display.width + x) * 3);
        state.batches.set(display.id, (state.batches.get(display.id) ?? 0) + 1);
        reply();
      },
    },
  }, options);

  return Object.assign(mock, {
    pixelAt(displayId: string, x: number, y: number): [number, number, number] | undefined {
      const state = mock.mock.state();
      const display = state.displays.find((item) => item.id === displayId);
      const buffer = state.framebuffers.get(displayId);
      if (!display || !buffer || x < 0 || y < 0 || x >= display.width || y >= display.height) return undefined;
      const offset = (y * display.width + x) * 3;
      return [buffer[offset]!, buffer[offset + 1]!, buffer[offset + 2]!];
    },
  });
}

/** Registry row for the display mock. */
export const DISPLAY_MOCK_ENTRY: MockDomainEntry = { domain: 'display', kind: 'extension', spec: DISPLAY_SPEC_REF, create: (o) => createMockDisplayService(o) };
