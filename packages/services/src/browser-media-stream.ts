function waitEvent(target: EventTarget, event: string, signal: AbortSignal, operation?: () => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      target.removeEventListener(event, done);
      target.removeEventListener('error', fail);
      signal.removeEventListener('abort', fail);
    };
    const done = () => { cleanup(); resolve(); };
    const fail = () => { cleanup(); reject(new Error('live audio failed or cancelled')); };
    target.addEventListener(event, done, { once: true });
    target.addEventListener('error', fail, { once: true });
    signal.addEventListener('abort', fail, { once: true });
    if (signal.aborted) return fail();
    try { operation?.(); } catch { fail(); }
  });
}

function delay(signal: AbortSignal): Promise<void> {
  return new Promise(resolve => {
    const done = () => { clearTimeout(timer); signal.removeEventListener('abort', done); resolve(); };
    const timer = setTimeout(done, 250);
    signal.addEventListener('abort', done, { once: true });
    if (signal.aborted) done();
  });
}

async function pumpAudio(source: MediaSource, element: HTMLMediaElement, reader: ReadableStreamDefaultReader<Uint8Array>, mime: string, signal: AbortSignal): Promise<void> {
  await waitEvent(source, 'sourceopen', signal);
  const buffer = source.addSourceBuffer(mime);
  while (!signal.aborted) {
    const item = await reader.read();
    if (item.done) { if (source.readyState === 'open') source.endOfStream(); return; }
    if (item.value.byteLength > 1024 * 1024) throw new Error('live audio chunk too large');
    for (let offset = 0; offset < item.value.byteLength; offset += 64 * 1024) {
      while (!signal.aborted && buffer.buffered.length && buffer.buffered.end(buffer.buffered.length - 1) - element.currentTime > 30) {
        await delay(signal);
      }
      const cutoff = element.currentTime - 15;
      if (buffer.buffered.length && cutoff > buffer.buffered.start(0) + 5) {
        await waitEvent(buffer, 'updateend', signal, () => buffer.remove(0, cutoff));
      }
      const bytes = item.value.slice(offset, offset + 64 * 1024);
      await waitEvent(buffer, 'updateend', signal, () => buffer.appendBuffer(bytes));
    }
  }
}

/** Attach a host-classified response to a bounded, cancellable MediaSource. */
export function createMediaStream(response: Response, element: HTMLMediaElement, controller: AbortController,
  urls: Pick<typeof URL, 'createObjectURL' | 'revokeObjectURL'>): { url: string; destroy(): void } {
  const mime = response.headers.get('content-type') ?? '';
  if (!response.body || typeof MediaSource === 'undefined' || !MediaSource.isTypeSupported(mime)) {
    void response.body?.cancel().catch(() => {});
    throw new Error('unsupported live media type');
  }
  const source = new MediaSource();
  const reader = response.body.getReader();
  const url = urls.createObjectURL(source);
  let destroyed = false;
  const cancel = () => { void reader.cancel().catch(() => {}); };
  controller.signal.addEventListener('abort', cancel, { once: true });
  void pumpAudio(source, element, reader, mime, controller.signal).catch(() => {
    if (!controller.signal.aborted) {
      controller.abort();
      element.pause();
      element.dispatchEvent(new Event('error'));
    }
  }).finally(() => { controller.signal.removeEventListener('abort', cancel); reader.releaseLock(); });
  return {
    url,
    destroy() {
      if (destroyed) return;
      destroyed = true;
      controller.abort();
      urls.revokeObjectURL(url);
    },
  };
}
