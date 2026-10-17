export interface ProfileMediaSink {
  src: string;
  removeAttribute(name: string): void;
}

export interface ProfileMediaControllerOptions {
  /** Canonical host-injected resource reader. */
  loadBytes: (url: string) => Promise<Blob>;
  createObjectURL?: (blob: Blob) => string;
  revokeObjectURL?: (url: string) => void;
}

export interface ProfileMediaController {
  load(url: string | null, sink: ProfileMediaSink): Promise<void>;
  clear(sink: ProfileMediaSink): void;
  clearAll(): void;
  handleError(sink: ProfileMediaSink): void;
  destroy(): void;
}

/**
 * Renders profile media only from host-authorized resource bytes.
 *
 * Each image element owns one Blob URL and a monotonic request token, preventing
 * a late response from retaining or displaying stale profile data.
 */
export function createProfileMediaController(
  options: ProfileMediaControllerOptions,
): ProfileMediaController {
  const { loadBytes } = options;
  const createObjectURL = options.createObjectURL ?? ((blob: Blob) => URL.createObjectURL(blob));
  const revokeObjectURL = options.revokeObjectURL ?? ((url: string) => URL.revokeObjectURL(url));
  const tokens = new WeakMap<ProfileMediaSink, number>();
  const urls = new WeakMap<ProfileMediaSink, string>();
  const sinks = new Set<ProfileMediaSink>();

  const nextToken = (sink: ProfileMediaSink): number => {
    const token = (tokens.get(sink) ?? 0) + 1;
    tokens.set(sink, token);
    return token;
  };

  const clear = (sink: ProfileMediaSink): void => {
    nextToken(sink);
    const url = urls.get(sink);
    if (url) revokeObjectURL(url);
    urls.delete(sink);
    sink.removeAttribute('src');
    sinks.delete(sink);
  };

  return {
    async load(url, sink): Promise<void> {
      clear(sink);
      if (!url) return;
      const token = tokens.get(sink)!;
      try {
        const blob = await loadBytes(url);
        if (tokens.get(sink) !== token) return;
        const objectUrl = createObjectURL(blob);
        if (tokens.get(sink) !== token) {
          revokeObjectURL(objectUrl);
          return;
        }
        urls.set(sink, objectUrl);
        sinks.add(sink);
        sink.src = objectUrl;
      } catch {
        if (tokens.get(sink) === token) clear(sink);
      }
    },
    clear,
    clearAll(): void {
      while (sinks.size > 0) {
        const sink = sinks.values().next().value;
        if (!sink) return;
        clear(sink);
      }
    },
    handleError(sink): void {
      clear(sink);
    },
    destroy(): void {
      this.clearAll();
    },
  };
}
