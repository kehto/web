import { describe, expect, it } from 'vitest';
import { MediaPlaybackError, mediaCreateError, mediaResourceError } from './media-error.js';
import { ResourceServiceError } from './resource-service.js';

describe('media creation errors name their cause (NAP-MEDIA PR #10 @ 7806f438, Error Handling)', () => {
  it('maps NAP-RESOURCE codes to blocked or unavailable, keeping the code and safe diagnostic', () => {
    expect(mediaResourceError('blocked-by-policy', 'denied:redirect-unverifiable').message).toBe('source blocked (blocked-by-policy: denied:redirect-unverifiable)');
    expect(mediaResourceError('unsupported-scheme').message).toBe('source blocked (unsupported-scheme)');
    expect(mediaResourceError('quota-exceeded', 'quota-exceeded').message).toBe('source blocked (quota-exceeded)');
    expect(mediaResourceError('too-large', '').message).toBe('source unavailable (too-large)');
    expect(mediaResourceError('network-error', 'upstream 503').message).toBe('source unavailable (network-error: upstream 503)');
  });

  it('reports the spec string for autoplay and unsupported playback, and only typed causes otherwise', () => {
    expect(mediaCreateError(new DOMException('blocked', 'NotAllowedError'))).toBe('autoplay denied');
    expect(mediaCreateError(new DOMException('no codec', 'NotSupportedError'))).toBe('unsupported source');
    expect(mediaCreateError(new MediaPlaybackError('source unavailable', 'timeout'))).toBe('source unavailable (timeout)');
    expect(mediaCreateError(new ResourceServiceError('not-found', 'gone'))).toBe('source unavailable (not-found: gone)');
    expect(mediaCreateError(new Error('backend secret must not escape'))).toBe('source unavailable');
    expect(mediaCreateError(null)).toBe('source unavailable');
    expect(mediaCreateError('text')).toBe('source unavailable');
  });

  it('bounds the detail it carries', () => {
    expect(new MediaPlaybackError('source unavailable', 'x'.repeat(500)).message).toBe(`source unavailable (${'x'.repeat(200)})`);
    expect(new MediaPlaybackError('unsupported source').message).toBe('unsupported source');
  });
});
