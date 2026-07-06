/**
 * Options for rendering the host-owned NIP-5D `window.napplet` namespace prelude.
 *
 * @example
 * ```ts
 * const options: NappletNamespacePreludeOptions = {
 *   domains: ['shell', 'relay', 'identity'],
 * };
 * ```
 */
export interface NappletNamespacePreludeOptions {
  /**
   * Bare NAP domain names the shell exposes to this napplet.
   */
  domains: readonly string[];
}

function uniqueBareDomains(domains: readonly string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const domain of domains) {
    const value = domain.trim();
    if (!value || value.includes(':') || value.startsWith('perm:') || seen.has(value)) {
      continue;
    }
    seen.add(value);
    normalized.push(value);
  }
  return normalized;
}

function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c');
}

/**
 * Render the host-owned NIP-5D bootstrap that exposes available NAP domains
 * under `window.napplet` before napplet artifact code runs.
 *
 * @param options - Domain availability to inject.
 * @returns An inline script tag suitable for `srcdoc` prelude insertion.
 * @example
 * ```ts
 * const prelude = renderNappletNamespacePrelude({
 *   domains: ['shell', 'relay', 'identity'],
 * });
 * ```
 */
export function renderNappletNamespacePrelude(options: NappletNamespacePreludeOptions): string {
  const domains = uniqueBareDomains(options.domains);
  return `<script data-kehto-nip5d-injection>(${nappletNamespacePrelude.toString()})(${scriptJson(domains)});</script>`;
}

/**
 * Insert the NIP-5D namespace prelude into HTML before authored scripts.
 *
 * @param html - Verified napplet artifact HTML.
 * @param options - Domain availability to inject.
 * @returns HTML with the prelude inside `<head>` when possible.
 * @example
 * ```ts
 * const srcdoc = injectNappletNamespacePrelude(verifiedHtml, {
 *   domains: ['shell', 'relay', 'identity'],
 * });
 * iframe.srcdoc = srcdoc;
 * ```
 */
export function injectNappletNamespacePrelude(
  html: string,
  options: NappletNamespacePreludeOptions,
): string {
  const prelude = renderNappletNamespacePrelude(options);
  const cspMeta = /(<meta\s+http-equiv=["']Content-Security-Policy["'][^>]*>)/i;
  if (cspMeta.test(html)) {
    return html.replace(cspMeta, `$1${prelude}`);
  }
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head[^>]*>/i, (open) => `${open}${prelude}`);
  }
  if (/<html[^>]*>/i.test(html)) {
    return html.replace(/<html[^>]*>/i, (open) => `${open}<head>${prelude}</head>`);
  }
  return `${prelude}${html}`;
}

function nappletNamespacePrelude(domains: string[]): void {
  const target = window as Window & { napplet?: Record<string, unknown> };
  const allowed = new Set(domains);
  const requestTimeoutMs = 30_000;

  type RuntimeMessage = { type: string; id?: string; [key: string]: unknown };
  type Listener = (event: MessageEvent) => void;

  function id(): string {
    if (target.crypto?.randomUUID) return target.crypto.randomUUID();
    return `napplet-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function post(message: RuntimeMessage): void {
    target.parent.postMessage(message, '*');
  }

  function listen(listener: Listener): () => void {
    target.addEventListener('message', listener);
    return () => target.removeEventListener('message', listener);
  }

  function isParentMessage(event: MessageEvent): boolean {
    return event.source === target.parent;
  }

  function request<T>(
    message: RuntimeMessage,
    resultType: string,
    map: (message: RuntimeMessage) => T,
    options: { rejectOnError?: boolean } = {},
  ): Promise<T> {
    const requestId = message.id ?? id();
    const outbound = { ...message, id: requestId };
    return new Promise<T>((resolve, reject) => {
      const off = listen((event) => {
        if (!isParentMessage(event)) return;
        const incoming = event.data;
        if (typeof incoming !== 'object' || incoming === null) return;
        const msg = incoming as RuntimeMessage;
        if (msg.type !== resultType && msg.type !== `${message.type}.error`) return;
        if (msg.id !== requestId) return;
        off();
        clearTimeout(timer);
        const error = typeof msg.error === 'string' ? msg.error : '';
        if (error && options.rejectOnError !== false) {
          reject(new Error(error));
          return;
        }
        try {
          resolve(map(msg));
        } catch (err) {
          reject(err);
        }
      });
      const timer = setTimeout(() => {
        off();
        reject(new Error(`${message.type} timed out`));
      }, requestTimeoutMs);
      post(outbound);
    });
  }

  function fire(message: RuntimeMessage): void {
    post(message);
  }

  function resultOrError(msg: RuntimeMessage): Record<string, unknown> {
    return msg;
  }

  function withoutEnvelope(msg: Record<string, unknown>): Record<string, unknown> {
    const { type: _type, id: _id, ...result } = msg;
    return result;
  }

  function fieldOrThrow<T>(msg: RuntimeMessage, field: string, fallback: string): T {
    if (Object.prototype.hasOwnProperty.call(msg, field)) return msg[field] as T;
    throw new Error(typeof msg.error === 'string' ? msg.error : fallback);
  }

  function voidResult(msg: RuntimeMessage, fallback: string): void {
    if (typeof msg.error === 'string' && msg.error) throw new Error(msg.error);
    if (msg.ok === false) throw new Error(fallback);
  }

  function subscriptionHandle(close: () => void): { close(): void } {
    let closed = false;
    return {
      close() {
        if (closed) return;
        closed = true;
        close();
      },
    };
  }

  function domainEventHandle(
    eventType: string,
    callback: (event: unknown) => void,
    select: (message: RuntimeMessage) => unknown = (message) => message.event,
  ): { close(): void } {
    const off = listen((event) => {
      if (!isParentMessage(event)) return;
      const msg = event.data as RuntimeMessage;
      if (typeof msg === 'object' && msg !== null && msg.type === eventType) callback(select(msg));
    });
    return subscriptionHandle(off);
  }

  function makeRelay(): Record<string, unknown> {
    return {
      subscribe(filters: unknown, onEvent: (result: unknown) => void, onEose: () => void, options?: { relay?: string }) {
        const subId = id();
        const off = listen((event) => {
          if (!isParentMessage(event)) return;
          const msg = event.data as RuntimeMessage;
          if (typeof msg !== 'object' || msg === null || msg.subId !== subId) return;
          if (msg.type === 'relay.event') onEvent(msg.result);
          else if (msg.type === 'relay.eose') onEose();
          else if (msg.type === 'relay.closed') off();
        });
        fire({
          type: 'relay.subscribe',
          id: id(),
          subId,
          filters: Array.isArray(filters) ? filters : [filters],
          ...(options?.relay ? { relay: options.relay } : {}),
        });
        return subscriptionHandle(() => {
          fire({ type: 'relay.close', id: id(), subId });
          off();
        });
      },
      publish(template: unknown) {
        return request(
          { type: 'relay.publish', event: template },
          'relay.publish.result',
          (msg) => {
            if (!msg.event) throw new Error('relay.publish.result missing event');
            return msg.event;
          },
        );
      },
      publishEncrypted(template: unknown, recipient: string, encryption = 'nip44') {
        return request(
          { type: 'relay.publishEncrypted', event: template, recipient, encryption },
          'relay.publishEncrypted.result',
          (msg) => {
            if (!msg.event) throw new Error('relay.publishEncrypted.result missing event');
            return msg.event;
          },
        );
      },
      query(filters: unknown) {
        return request(
          { type: 'relay.query', filters: Array.isArray(filters) ? filters : [filters] },
          'relay.query.result',
          (msg) => Array.isArray(msg.events) ? msg.events : [],
        );
      },
    };
  }

  function makeInc(): Record<string, unknown> {
    return {
      emit(topic: string, _extraTags?: string[][], content?: string) {
        let payload: unknown = content;
        if (typeof content === 'string' && content.length > 0) {
          try {
            payload = JSON.parse(content);
          } catch {
            payload = content;
          }
        }
        fire({ type: 'inc.emit', topic, ...(payload === undefined || payload === '' ? {} : { payload }) });
      },
      on(topic: string, callback: (payload: unknown, event: unknown) => void) {
        const off = listen((event) => {
          if (!isParentMessage(event)) return;
          const msg = event.data as RuntimeMessage;
          if (typeof msg !== 'object' || msg === null || msg.type !== 'inc.event' || msg.topic !== topic) return;
          callback(msg.payload ?? {}, {
            id: '',
            pubkey: typeof msg.sender === 'string' ? msg.sender : '',
            created_at: Math.floor(Date.now() / 1000),
            kind: 0,
            tags: [['t', topic]],
            content: typeof msg.payload === 'string' ? msg.payload : JSON.stringify(msg.payload ?? {}),
            sig: '',
          });
        });
        fire({ type: 'inc.subscribe', id: id(), topic });
        return subscriptionHandle(() => {
          fire({ type: 'inc.unsubscribe', topic });
          off();
        });
      },
    };
  }

  function makeStorage(): Record<string, unknown> {
    const makeScope = (scope?: string) => ({
      getItem(key: string) {
        return request(
          { type: 'storage.get', key, ...(scope ? { scope } : {}) },
          'storage.get.result',
          (msg) => msg.value ?? null,
        );
      },
      setItem(key: string, value: string) {
        return request(
          { type: 'storage.set', key, value, ...(scope ? { scope } : {}) },
          'storage.set.result',
          () => undefined,
        );
      },
      removeItem(key: string) {
        return request(
          { type: 'storage.remove', key, ...(scope ? { scope } : {}) },
          'storage.remove.result',
          () => undefined,
        );
      },
      keys() {
        return request(
          { type: 'storage.keys', ...(scope ? { scope } : {}) },
          'storage.keys.result',
          (msg) => Array.isArray(msg.keys) ? msg.keys : [],
        );
      },
    });
    return { ...makeScope(), instance: makeScope('instance') };
  }

  function makeIdentity(): Record<string, unknown> {
    const read = <T>(type: string, field: string, fallback: T) => request(
      { type },
      `${type}.result`,
      (msg) => (Object.prototype.hasOwnProperty.call(msg, field) ? msg[field] : fallback) as T,
      { rejectOnError: type !== 'identity.getPublicKey' },
    );
    return {
      getPublicKey: () => read('identity.getPublicKey', 'pubkey', ''),
      onChanged(handler: (pubkey: string) => void) {
        const off = listen((event) => {
          if (!isParentMessage(event)) return;
          const msg = event.data as RuntimeMessage;
          if (typeof msg !== 'object' || msg === null || msg.type !== 'identity.changed') return;
          if (typeof msg.pubkey === 'string') handler(msg.pubkey);
        });
        return subscriptionHandle(off);
      },
      getRelays: () => read('identity.getRelays', 'relays', {}),
      getProfile: () => read('identity.getProfile', 'profile', null),
      getFollows: () => read('identity.getFollows', 'pubkeys', []),
      getList: (listType: string) => request(
        { type: 'identity.getList', listType },
        'identity.getList.result',
        (msg) => Array.isArray(msg.entries) ? msg.entries : [],
      ),
      getZaps: () => read('identity.getZaps', 'zaps', []),
      getMutes: () => read('identity.getMutes', 'pubkeys', []),
      getBlocked: () => read('identity.getBlocked', 'pubkeys', []),
      getBadges: () => read('identity.getBadges', 'badges', []),
    };
  }

  function makeTheme(): Record<string, unknown> {
    return {
      get: () => request({ type: 'theme.get' }, 'theme.get.result', (msg) => msg.theme),
      onChanged(handler: (theme: unknown) => void) {
        const off = listen((event) => {
          if (!isParentMessage(event)) return;
          const msg = event.data as RuntimeMessage;
          if (typeof msg === 'object' && msg !== null && msg.type === 'theme.changed') handler(msg.theme);
        });
        return subscriptionHandle(off);
      },
    };
  }

  function makeKeys(): Record<string, unknown> {
    return {
      forward: (event: {
        key?: unknown;
        code?: unknown;
        ctrl?: unknown;
        alt?: unknown;
        shift?: unknown;
        meta?: unknown;
        ctrlKey?: unknown;
        altKey?: unknown;
        shiftKey?: unknown;
        metaKey?: unknown;
      } = {}) => fire({
        type: 'keys.forward',
        key: typeof event.key === 'string' ? event.key : '',
        code: typeof event.code === 'string' ? event.code : '',
        ctrl: Boolean(event.ctrl ?? event.ctrlKey),
        alt: Boolean(event.alt ?? event.altKey),
        shift: Boolean(event.shift ?? event.shiftKey),
        meta: Boolean(event.meta ?? event.metaKey),
      }),
      registerAction: (action: unknown) => request(
        { type: 'keys.registerAction', action },
        'keys.registerAction.result',
        resultOrError,
      ),
      unregisterAction: (actionId: string) => fire({ type: 'keys.unregisterAction', actionId }),
      onAction(actionId: string, callback: () => void) {
        const off = listen((event) => {
          if (!isParentMessage(event)) return;
          const msg = event.data as RuntimeMessage;
          if (typeof msg === 'object' && msg !== null && msg.type === 'keys.action' && msg.actionId === actionId) callback();
        });
        return subscriptionHandle(off);
      },
    };
  }

  function makeMedia(): Record<string, unknown> {
    const on = (type: string, sessionId: string, callback: (msg: RuntimeMessage) => void) => {
      const off = listen((event) => {
        if (!isParentMessage(event)) return;
        const msg = event.data as RuntimeMessage;
        if (typeof msg === 'object' && msg !== null && msg.type === type && msg.sessionId === sessionId) callback(msg);
      });
      return subscriptionHandle(off);
    };
    return {
      createSession: (options: unknown) => request(
        { type: 'media.session.create', ...((options && typeof options === 'object') ? options as Record<string, unknown> : {}) },
        'media.session.create.result',
        withoutEnvelope,
        { rejectOnError: false },
      ),
      updateSession: (sessionId: string, metadata: unknown) => fire({ type: 'media.session.update', sessionId, metadata }),
      destroySession: (sessionId: string) => fire({ type: 'media.session.destroy', sessionId }),
      reportState: (sessionId: string, state: unknown) => fire({ type: 'media.state', sessionId, ...((state && typeof state === 'object') ? state as Record<string, unknown> : {}) }),
      reportCapabilities: (sessionId: string, actions: unknown) => fire({ type: 'media.capabilities', sessionId, actions }),
      sendCommand: (sessionId: string, action: string, value?: unknown) => fire({ type: 'media.command', sessionId, action, ...(value === undefined ? {} : { value }) }),
      onCommand: (sessionId: string, callback: (action: unknown, value?: unknown) => void) => on('media.command', sessionId, (msg) => callback(msg.action, msg.value)),
      onState: (sessionId: string, callback: (state: Record<string, unknown>) => void) => on('media.state', sessionId, (msg) => callback({
        status: msg.status,
        position: msg.position,
        duration: msg.duration,
        volume: msg.volume,
      })),
      onCapabilities: (sessionId: string, callback: (actions: unknown) => void) => on('media.capabilities', sessionId, (msg) => callback(msg.actions)),
      onControls: (sessionId: string, callback: (controls: unknown) => void) => on('media.controls', sessionId, (msg) => callback(msg.controls)),
    };
  }

  function makeNotify(): Record<string, unknown> {
    const on = (type: string, callback: (msg: RuntimeMessage) => void) => {
      const off = listen((event) => {
        if (!isParentMessage(event)) return;
        const msg = event.data as RuntimeMessage;
        if (typeof msg === 'object' && msg !== null && msg.type === type) callback(msg);
      });
      return subscriptionHandle(off);
    };
    return {
      send: (notification: Record<string, unknown>) => request(
        { type: 'notify.send', ...notification },
        'notify.send.result',
        (msg) => ({ notificationId: fieldOrThrow(msg, 'notificationId', 'notify.send.result missing notificationId') }),
      ),
      dismiss: (notificationId: string) => fire({ type: 'notify.dismiss', notificationId }),
      badge: (count: number) => fire({ type: 'notify.badge', count }),
      registerChannel: (channel: Record<string, unknown>) => fire({ type: 'notify.channel.register', ...channel }),
      requestPermission: (channel?: string) => request(
        { type: 'notify.permission.request', ...(channel ? { channel } : {}) },
        'notify.permission.result',
        (msg) => ({ granted: msg.granted }),
      ),
      onAction: (callback: (notificationId: unknown, actionId: unknown) => void) => on('notify.action', (msg) => callback(msg.notificationId, msg.actionId)),
      onClicked: (callback: (notificationId: unknown) => void) => on('notify.clicked', (msg) => callback(msg.notificationId)),
      onDismissed: (callback: (notificationId: unknown, reason: unknown) => void) => on('notify.dismissed', (msg) => callback(msg.notificationId, msg.reason)),
      onControls: (callback: (controls: unknown) => void) => on('notify.controls', (msg) => callback(msg.controls)),
    };
  }

  function makeConfig(): Record<string, unknown> {
    let schema: unknown = null;
    return {
      registerSchema: (nextSchema: unknown, version?: number) => request(
        { type: 'config.registerSchema', schema: nextSchema, ...(version === undefined ? {} : { version }) },
        'config.registerSchema.result',
        (msg) => {
          if (!msg.error) schema = nextSchema;
          return undefined;
        },
      ),
      get: () => request({ type: 'config.get' }, 'config.values', (msg) => msg.values ?? {}),
      subscribe(callback: (values: unknown) => void) {
        const off = listen((event) => {
          if (!isParentMessage(event)) return;
          const msg = event.data as RuntimeMessage;
          if (typeof msg === 'object' && msg !== null && msg.type === 'config.values') callback(msg.values ?? {});
        });
        fire({ type: 'config.subscribe' });
        return subscriptionHandle(() => {
          fire({ type: 'config.unsubscribe' });
          off();
        });
      },
      openSettings: (options?: unknown) => fire({ type: 'config.openSettings', ...((options && typeof options === 'object') ? options as Record<string, unknown> : {}) }),
      onSchemaError(callback: (error: unknown) => void) {
        const off = listen((event) => {
          if (!isParentMessage(event)) return;
          const msg = event.data as RuntimeMessage;
          if (typeof msg === 'object' && msg !== null && msg.type === 'config.schemaError') callback(msg);
        });
        return off;
      },
      get schema() {
        return schema;
      },
    };
  }

  function makeResource(): Record<string, unknown> {
    const objectUrls = new Set<string>();
    const bytes = (url: string) => request({ type: 'resource.bytes', url }, 'resource.bytes.result', (msg) => msg.blob);
    return {
      info: () => request({ type: 'resource.info' }, 'resource.info.result', (msg) => msg.info),
      bytes,
      bytesMany: (urls: string[]) => request({ type: 'resource.bytesMany', urls }, 'resource.bytesMany.result', (msg) => Array.isArray(msg.items) ? msg.items : []),
      bytesAsObjectURL(url: string) {
        let objectUrl = '';
        const handle = {
          get url() {
            return objectUrl;
          },
          revoke() {
            if (objectUrl) {
              URL.revokeObjectURL(objectUrl);
              objectUrls.delete(objectUrl);
              objectUrl = '';
            }
          },
        };
        void bytes(url).then((blob) => {
          objectUrl = URL.createObjectURL(blob as Blob);
          objectUrls.add(objectUrl);
        });
        return handle;
      },
      hydrateResourceCache: () => undefined,
      revokeAllObjectURLs() {
        for (const url of objectUrls) URL.revokeObjectURL(url);
        objectUrls.clear();
      },
    };
  }

  function makeCvm(): Record<string, unknown> {
    const req = <T>(type: string, payload: Record<string, unknown>, map: (msg: RuntimeMessage) => T) => request(
      { type, ...payload },
      `${type}.result`,
      map,
    );
    const cvmRequest = (server: unknown, message: unknown, options?: Record<string, unknown>) => req(
      'cvm.request',
      { server, message, ...(options === undefined ? {} : { options }) },
      (msg) => fieldOrThrow(msg, 'message', 'cvm.request.result missing message'),
    );
    const mcpCall = async (
      server: unknown,
      method: string,
      params?: Record<string, unknown>,
      options?: Record<string, unknown>,
    ) => {
      const reply = await cvmRequest(server, {
        jsonrpc: '2.0',
        id: id(),
        method,
        ...(params === undefined ? {} : { params }),
      }, options) as { result?: unknown; error?: { message?: string } | string };
      if (reply.error !== undefined) {
        const error = reply.error;
        throw new Error(typeof error === 'object' && error !== null && typeof error.message === 'string'
          ? `${method}: ${error.message}`
          : `${method} failed`);
      }
      return reply.result;
    };
    return {
      discover: (query?: unknown) => req('cvm.discover', query === undefined ? {} : { query }, (msg) => Array.isArray(msg.servers) ? msg.servers : []),
      request: cvmRequest,
      listTools: async (server: unknown, options?: Record<string, unknown>) => {
        const result = await mcpCall(server, 'tools/list', undefined, options) as { tools?: unknown[] } | undefined;
        return result?.tools ?? [];
      },
      callTool: (server: unknown, name: string, args?: unknown, options?: Record<string, unknown>) => mcpCall(
        server,
        'tools/call',
        { name, ...(args === undefined ? {} : { arguments: args }) },
        options,
      ),
      listResources: async (server: unknown, options?: Record<string, unknown>) => {
        const result = await mcpCall(server, 'resources/list', undefined, options) as { resources?: unknown[] } | undefined;
        return result?.resources ?? [];
      },
      readResource: async (server: unknown, uri: string, options?: Record<string, unknown>) => {
        const result = await mcpCall(server, 'resources/read', { uri }, options) as { contents?: unknown[] } | undefined;
        const first = result?.contents?.[0];
        if (!first) throw new Error(`resources/read returned no contents for ${uri}`);
        return first;
      },
      close: (server: unknown) => req('cvm.close', { server }, (msg) => voidResult(msg, 'cvm close failed')),
      onEvent(callback: (server: unknown, message: unknown) => void) {
        const off = listen((event) => {
          if (!isParentMessage(event)) return;
          const msg = event.data as RuntimeMessage;
          if (
            typeof msg === 'object'
            && msg !== null
            && msg.type === 'cvm.event'
            && msg.server !== undefined
            && msg.message !== undefined
          ) {
            callback(msg.server, msg.message);
          }
        });
        return subscriptionHandle(off);
      },
    };
  }

  function makeOutbox(): Record<string, unknown> {
    const req = (type: string, payload: Record<string, unknown>, resultType = `${type}.result`) => request(
      { type, ...payload },
      resultType,
      resultOrError,
      { rejectOnError: false },
    );
    return {
      getEvent: (eventId: string, options?: Record<string, unknown>) => req('outbox.getEvent', { eventId, ...(options ? { options } : {}) }),
      query: (filters: unknown, options?: Record<string, unknown>) => req('outbox.query', { filters: Array.isArray(filters) ? filters : [filters], ...(options ? { options } : {}) }),
      subscribe(filters: unknown, options?: Record<string, unknown>) {
        const subId = id();
        const handlers = { event: new Set<(result: unknown) => void>(), closed: new Set<(reason?: unknown) => void>() };
        const off = listen((event) => {
          if (!isParentMessage(event)) return;
          const msg = event.data as RuntimeMessage;
          if (typeof msg !== 'object' || msg === null || msg.subId !== subId) return;
          if (msg.type === 'outbox.event') for (const handler of handlers.event) handler(msg.result);
          if (msg.type === 'outbox.closed') {
            for (const handler of handlers.closed) handler(msg.reason);
            off();
          }
        });
        fire({ type: 'outbox.subscribe', id: id(), subId, filters: Array.isArray(filters) ? filters : [filters], ...(options ? { options } : {}) });
        return {
          on(event: 'event' | 'closed', handler: (value?: unknown) => void) {
            handlers[event].add(handler);
            return { close: () => handlers[event].delete(handler) };
          },
          close() {
            fire({ type: 'outbox.close', id: id(), subId });
            off();
            handlers.event.clear();
            handlers.closed.clear();
          },
        };
      },
      publish: (event: unknown, options?: Record<string, unknown>) => req('outbox.publish', { event, ...(options ? { options } : {}) }),
      resolveRelays: (targetValue: unknown) => req('outbox.resolveRelays', { target: targetValue }).then((msg) => msg.plan ?? msg),
    };
  }

  function makeUpload(): Record<string, unknown> {
    return {
      info: () => request({ type: 'upload.info' }, 'upload.info.result', (msg) => fieldOrThrow(msg, 'info', 'upload info unavailable')),
      upload: (requestPayload: unknown) => request({ type: 'upload.upload', request: requestPayload }, 'upload.upload.result', (msg) => fieldOrThrow(msg, 'result', 'upload failed')),
      status: (uploadId: string) => request({ type: 'upload.status', uploadId }, 'upload.status.result', (msg) => fieldOrThrow(msg, 'status', 'upload status unavailable')),
      onStatus(callback: (status: unknown) => void) {
        const off = listen((event) => {
          if (!isParentMessage(event)) return;
          const msg = event.data as RuntimeMessage;
          if (typeof msg === 'object' && msg !== null && msg.type === 'upload.status.changed' && msg.status !== undefined) callback(msg.status);
        });
        return subscriptionHandle(off);
      },
    };
  }

  function makeIntent(): Record<string, unknown> {
    const invoke = (requestPayload: unknown) => request(
      { type: 'intent.invoke', request: requestPayload },
      'intent.invoke.result',
      (msg) => fieldOrThrow(msg, 'result', 'intent.invoke.result missing result'),
    );
    return {
      invoke,
      open: (archetype: string, payload?: unknown, opts?: Record<string, unknown>) => invoke({
        archetype,
        action: 'open',
        payload,
        ...((opts && typeof opts === 'object') ? opts : {}),
      }),
      available: (archetype: string) => request(
        { type: 'intent.available', archetype },
        'intent.available.result',
        (msg) => fieldOrThrow(msg, 'availability', 'intent.available.result missing availability'),
      ),
      handlers: () => request(
        { type: 'intent.handlers' },
        'intent.handlers.result',
        (msg) => fieldOrThrow(msg, 'handlers', 'intent.handlers.result missing handlers'),
      ),
      onChanged: (callback: (availability: unknown) => void) => domainEventHandle(
        'intent.changed',
        callback,
        (msg) => msg.availability,
      ),
    };
  }

  function makeWebrtc(): Record<string, unknown> {
    return {
      open: (requestPayload?: unknown) => request(
        { type: 'webrtc.open', request: requestPayload },
        'webrtc.open.result',
        (msg) => ({ session: fieldOrThrow(msg, 'session', 'webrtc.open.result missing session') }),
      ),
      send: (sessionId: string, payload: unknown) => request(
        { type: 'webrtc.send', sessionId, payload },
        'webrtc.send.result',
        (msg) => voidResult(msg, 'webrtc send failed'),
      ),
      close: (sessionId: string, reason?: string) => request(
        { type: 'webrtc.close', sessionId, ...(reason ? { reason } : {}) },
        'webrtc.close.result',
        (msg) => voidResult(msg, 'webrtc close failed'),
      ),
      onEvent: (callback: (event: unknown) => void) => domainEventHandle('webrtc.event', callback),
    };
  }

  function makeBle(): Record<string, unknown> {
    const req = (action: string, payload: Record<string, unknown>, map: (msg: RuntimeMessage) => unknown) => request(
      { type: `ble.${action}`, ...payload },
      `ble.${action}.result`,
      map,
    );
    return {
      open: (requestPayload?: unknown) => req('open', { request: requestPayload }, (msg) => ({ session: fieldOrThrow(msg, 'session', 'ble.open.result missing session') })),
      services: (sessionId: string) => req('services', { sessionId }, (msg) => fieldOrThrow(msg, 'services', 'ble.services.result missing services')),
      read: (sessionId: string, targetValue: unknown) => req('read', { sessionId, target: targetValue }, (msg) => fieldOrThrow(msg, 'data', 'ble.read.result missing data')),
      write: (sessionId: string, targetValue: unknown, data: unknown, options?: Record<string, unknown>) => req(
        'write',
        { sessionId, target: targetValue, data, ...(options ? { options } : {}) },
        (msg) => voidResult(msg, 'ble write failed'),
      ),
      subscribe: (sessionId: string, targetValue: unknown) => req('subscribe', { sessionId, target: targetValue }, (msg) => voidResult(msg, 'ble subscribe failed')),
      unsubscribe: (sessionId: string, targetValue: unknown) => req('unsubscribe', { sessionId, target: targetValue }, (msg) => voidResult(msg, 'ble unsubscribe failed')),
      close: (sessionId: string, reason?: string) => req('close', { sessionId, ...(reason ? { reason } : {}) }, (msg) => voidResult(msg, 'ble close failed')),
      onEvent: (callback: (event: unknown) => void) => domainEventHandle('ble.event', callback),
    };
  }

  function makeSerial(): Record<string, unknown> {
    return {
      open: (requestPayload?: unknown) => request(
        { type: 'serial.open', request: requestPayload },
        'serial.open.result',
        (msg) => ({ session: fieldOrThrow(msg, 'session', 'serial.open.result missing session') }),
      ),
      write: (sessionId: string, data: Uint8Array | number[]) => request(
        { type: 'serial.write', sessionId, data: Array.from(data) },
        'serial.write.result',
        (msg) => voidResult(msg, 'serial write failed'),
      ),
      close: (sessionId: string, reason?: string) => request(
        { type: 'serial.close', sessionId, ...(reason === undefined ? {} : { reason }) },
        'serial.close.result',
        (msg) => voidResult(msg, 'serial close failed'),
      ),
      onEvent: (callback: (event: unknown) => void) => domainEventHandle('serial.event', callback),
    };
  }

  function makeLink(): Record<string, unknown> {
    return {
      open: (url: string, options?: Record<string, unknown>) => request(
        { type: 'link.open', url, ...(options ? { options } : {}) },
        'link.open.result',
        resultOrError,
        { rejectOnError: false },
      ),
    };
  }

  function makeCount(): Record<string, unknown> {
    return {
      query: (filters: unknown, options?: Record<string, unknown>) => request(
        { type: 'count.query', filters: Array.isArray(filters) ? filters : [filters], ...(options ? { options } : {}) },
        'count.query.result',
        resultOrError,
        { rejectOnError: false },
      ),
    };
  }

  function makeLists(): Record<string, unknown> {
    const req = (type: string, payload: Record<string, unknown>) => request({ type, ...payload }, `${type}.result`, resultOrError, { rejectOnError: false });
    return {
      supported: () => req('lists.supported', {}),
      add: (list: unknown, items: unknown, options?: unknown) => req('lists.add', { list, items, ...(options ? { options } : {}) }),
      remove: (list: unknown, items: unknown, options?: unknown) => req('lists.remove', { list, items, ...(options ? { options } : {}) }),
    };
  }

  function makeCommon(): Record<string, unknown> {
    const req = (type: string, payload: Record<string, unknown>) => request({ type, ...payload }, `${type}.result`, withoutEnvelope, { rejectOnError: false });
    return {
      encodeNip19: (input: unknown) => req('common.encodeNip19', { input }),
      decodeNip19: (value: string) => req('common.decodeNip19', { value }),
      getProfile: (targetValue: unknown) => req('common.getProfile', { target: targetValue }),
      follows: () => req('common.follows', {}),
      follow: (...pubkeys: string[]) => req('common.follow', { pubkeys }),
      unfollow: (...pubkeys: string[]) => req('common.unfollow', { pubkeys }),
      react: (targetEventId: string, reaction?: string, customEmojiHref?: string) => req('common.react', {
        targetEventId,
        reaction,
        ...(customEmojiHref === undefined ? {} : { customEmojiHref }),
      }),
      report: (targetValue: unknown, reason?: string, text?: string) => req('common.report', {
        target: targetValue,
        reason,
        text,
      }),
    };
  }

  function makeDm(): Record<string, unknown> {
    const req = (type: string, payload: Record<string, unknown>) => request({ type, ...payload }, `${type}.result`, withoutEnvelope, { rejectOnError: false });
    return {
      status: () => req('dm.status', {}),
      conversations: (query?: Record<string, unknown>) => req('dm.conversations', query ?? {}),
      messages: (query: Record<string, unknown>) => req('dm.messages', query ?? {}),
      send: (requestPayload: Record<string, unknown>) => req('dm.send', requestPayload ?? {}),
      subscribe: (requestPayload?: Record<string, unknown>) => req('dm.subscribe', requestPayload ?? {}),
      unsubscribe: (subscriptionId: string) => req('dm.unsubscribe', { subscriptionId }),
      onMessage(callback: (message: unknown, subscriptionId: string) => void) {
        const off = listen((event) => {
          if (!isParentMessage(event)) return;
          const msg = event.data as RuntimeMessage;
          if (
            typeof msg === 'object'
            && msg !== null
            && msg.type === 'dm.message'
            && typeof msg.subscriptionId === 'string'
          ) {
            callback(msg.message, msg.subscriptionId);
          }
        });
        return subscriptionHandle(off);
      },
    };
  }

  function makeDomain(domain: string, existing: unknown): unknown {
    if (existing && typeof existing === 'object' && Object.keys(existing).length > 0) return existing;
    switch (domain) {
      case 'relay': return makeRelay();
      case 'inc': return makeInc();
      case 'storage': return makeStorage();
      case 'keys': return makeKeys();
      case 'media': return makeMedia();
      case 'notify': return makeNotify();
      case 'identity': return makeIdentity();
      case 'theme': return makeTheme();
      case 'config': return makeConfig();
      case 'resource': return makeResource();
      case 'cvm': return makeCvm();
      case 'outbox': return makeOutbox();
      case 'upload': return makeUpload();
      case 'intent': return makeIntent();
      case 'webrtc': return makeWebrtc();
      case 'ble': return makeBle();
      case 'link': return makeLink();
      case 'count': return makeCount();
      case 'lists': return makeLists();
      case 'common': return makeCommon();
      case 'serial': return makeSerial();
      case 'dm': return makeDm();
      default: return {};
    }
  }

  function guardNappletNamespace(namespace: Record<string, unknown>): Record<string, unknown> {
    return new Proxy(namespace, {
      set(obj, prop, value) {
        if (typeof prop !== 'string' || !allowed.has(prop)) return true;
        obj[prop] = makeDomain(prop, value);
        return true;
      },
      defineProperty(obj, prop, descriptor) {
        if (typeof prop !== 'string' || !allowed.has(prop)) return true;
        return Reflect.defineProperty(obj, prop, {
          ...descriptor,
          value: makeDomain(prop, descriptor.value),
        });
      },
    });
  }

  function buildNappletNamespace(value: unknown): Record<string, unknown> {
    const candidate = typeof value === 'object' && value !== null
      ? value as Record<string, unknown>
      : {};
    const next: Record<string, unknown> = {};
    for (const domain of domains) {
      if (!allowed.has(domain)) continue;
      Object.defineProperty(next, domain, {
        value: makeDomain(
          domain,
          Object.prototype.hasOwnProperty.call(candidate, domain) ? candidate[domain] : undefined,
        ),
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
    return guardNappletNamespace(next);
  }

  let root = buildNappletNamespace(target.napplet);
  Object.defineProperty(target, 'napplet', {
    get() {
      return root;
    },
    set(value) {
      root = buildNappletNamespace(value);
    },
    enumerable: false,
    configurable: true,
  });
}
