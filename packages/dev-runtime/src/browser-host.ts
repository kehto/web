import type { DevRuntimeHostConfig } from './options.js';

interface ShellCapabilities {
  readonly domains: string[];
  readonly protocols: Record<string, string[]>;
  readonly naps: string[];
  readonly sandbox: string[];
}

interface DevRuntimeBrowserState {
  readonly config: DevRuntimeHostConfig;
  readonly capabilities: ShellCapabilities;
  readonly services: string[];
  generation: number;
  status: 'booting' | 'ready' | 'reloading' | 'error';
  reload(): void;
  getState(): {
    generation: number;
    status: DevRuntimeBrowserState['status'];
    iframeCount: number;
    initSent: boolean;
  };
}

declare global {
  interface Window {
    __KEHTO_DEV_RUNTIME__?: DevRuntimeBrowserState;
  }
}

const NAP_DOMAINS = [
  'identity',
  'storage',
  'inc',
  'theme',
  'keys',
  'media',
  'notify',
  'config',
  'resource',
  'cvm',
] as const;

const NAP_INC_PROTOCOLS = [
  'inc:NAP-01',
  'inc:NAP-02',
  'inc:NAP-03',
  'inc:NAP-04',
  'inc:NAP-05',
  'inc:NAP-06',
] as const;

function readConfig(): DevRuntimeHostConfig {
  const script = document.getElementById('kehto-dev-runtime-config');
  if (!script?.textContent) {
    throw new Error('Missing Kehto dev runtime config.');
  }
  return JSON.parse(script.textContent) as DevRuntimeHostConfig;
}

function buildCapabilities(): ShellCapabilities {
  const domains = [...NAP_DOMAINS];
  const protocols: Record<string, string[]> = {};
  for (const entry of NAP_INC_PROTOCOLS) {
    const [domain, protocol] = entry.split(':') as [string, string];
    (protocols[domain] ??= []).push(protocol);
  }
  return {
    domains,
    protocols,
    naps: [...NAP_DOMAINS, ...NAP_INC_PROTOCOLS],
    sandbox: [],
  };
}

function setStatus(state: DevRuntimeBrowserState, status: DevRuntimeBrowserState['status']): void {
  state.status = status;
  const statusEl = document.getElementById('lifecycle-status');
  if (statusEl) statusEl.textContent = status;
}

function getFrame(): HTMLIFrameElement {
  const frame = document.getElementById('napplet-frame');
  if (!(frame instanceof HTMLIFrameElement)) {
    throw new Error('Missing Kehto dev runtime iframe.');
  }
  frame.sandbox.add('allow-scripts');
  frame.sandbox.remove('allow-same-origin');
  return frame;
}

function navigateFrame(frame: HTMLIFrameElement, targetUrl: string): void {
  frame.src = 'about:blank';
  window.setTimeout(() => {
    frame.src = targetUrl;
  }, 0);
}

function installDevRuntimeHost(): void {
  const config = readConfig();
  const frame = getFrame();
  const capabilities = buildCapabilities();
  const services: string[] = [];
  let initSentGeneration = -1;

  const state: DevRuntimeBrowserState = {
    config,
    capabilities,
    services,
    generation: 0,
    status: 'booting',
    reload() {
      this.generation += 1;
      initSentGeneration = -1;
      setStatus(this, 'reloading');
      navigateFrame(frame, config.target.url);
    },
    getState() {
      return {
        generation: this.generation,
        status: this.status,
        iframeCount: document.querySelectorAll('iframe').length,
        initSent: initSentGeneration === this.generation,
      };
    },
  };

  window.__KEHTO_DEV_RUNTIME__ = state;

  window.addEventListener('message', (event) => {
    if (event.source !== frame.contentWindow) return;
    const data = event.data as { type?: unknown } | null;
    if (!data || typeof data !== 'object' || data.type !== 'shell.ready') return;
    if (initSentGeneration === state.generation) return;
    frame.contentWindow?.postMessage({
      type: 'shell.init',
      capabilities,
      services,
    }, '*');
    initSentGeneration = state.generation;
    setStatus(state, 'ready');
  });

  frame.addEventListener('load', () => {
    if (state.status === 'booting' || state.status === 'reloading') {
      setStatus(state, 'ready');
    }
  });

  frame.addEventListener('error', () => {
    setStatus(state, 'error');
  });

  document.getElementById('reload-target')?.addEventListener('click', () => {
    state.reload();
  });

  setStatus(state, 'booting');
  navigateFrame(frame, config.target.url);
}

try {
  installDevRuntimeHost();
} catch (error) {
  const statusEl = document.getElementById('lifecycle-status');
  if (statusEl) statusEl.textContent = 'error';
  console.error(error);
}
