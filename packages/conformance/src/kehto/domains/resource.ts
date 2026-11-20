import { createResourceService, ResourceServiceError, type ResourceFetchInit } from '@kehto/services';
import type { DomainBackendModule } from './types.js';

/** Origin of every fixture resource. Resolved in memory: nothing connects to it. */
const ORIGIN = 'https://resource.conformance.invalid';

/** Fixture resources by path. `/hold` is answered only by the `resource.release` control. */
const RESOURCES: Readonly<Record<string, Uint8Array>> = Object.freeze({
  '/bytes': Uint8Array.from([0x00, 0x01, 0x02, 0xff]),
  '/empty': new Uint8Array(0),
  '/hello.txt': new TextEncoder().encode('hello'),
  '/pixel.png': Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]),
});

/** Classify bytes by sniffing, never by an upstream header (NAP-RESOURCE MIME policy). */
function sniff(bytes: Uint8Array): string {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png';
  if (bytes.length > 0 && bytes.every((byte) => byte === 0x09 || byte === 0x0a || byte === 0x0d || (byte >= 0x20 && byte < 0x7f))) return 'text/plain';
  return 'application/octet-stream';
}

const respond = (bytes: Uint8Array): Response => new Response(bytes.slice().buffer, { headers: { 'content-type': sniff(bytes) } });

/** NAP-RESOURCE backend: the reference resource service over an in-memory https resolver. */
export const RESOURCE_BACKEND: DomainBackendModule = {
  domain: 'resource',
  create() {
    const held = new Set<() => void>();
    const fetched: string[] = [];
    const hold = (init: ResourceFetchInit): Promise<Response> => new Promise((resolve, reject) => {
      const release = () => { held.delete(release); resolve(respond(RESOURCES['/hello.txt']!)); };
      held.add(release);
      init.signal.addEventListener('abort', () => { held.delete(release); reject(new ResourceServiceError('timeout', 'cancelled')); }, { once: true });
    });
    const resource = createResourceService({
      async fetch(url, init) {
        fetched.push(url);
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:') throw new ResourceServiceError('unsupported-scheme', `${parsed.protocol} is not supported`);
        if (parsed.origin !== ORIGIN) throw new ResourceServiceError('not-found', 'no such resource');
        if (parsed.pathname === '/hold') return hold(init);
        const bytes = RESOURCES[parsed.pathname];
        if (!bytes) throw new ResourceServiceError('not-found', 'no such resource');
        return respond(bytes);
      },
      resourceInfo: { schemes: [{ scheme: 'https', enabled: true }], maxBytes: 1048576, maxUrls: 8 },
    });
    return {
      services: { resource },
      controls: {
        /** Answer every held `/hold` request with the `/hello.txt` bytes. */
        'resource.release': () => { for (const release of [...held]) release(); },
        /** Evidence: every URL the resolver was asked for, oldest first. */
        'resource.fetched': () => [...fetched],
      },
    };
  },
};
