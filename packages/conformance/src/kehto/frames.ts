/**
 * kehto/frames.ts — DOM plumbing for probe frames and the report collector.
 */
import { COLLECTOR_FRAME_NAME, REPORT_FIELD, SIGNAL_FIELD } from '../probe/artifact.js';
import type { ProbeReport } from '../probe/plan.js';
import type { WireDirection } from '../model.js';

/** A frame-side wire observation. */
export interface FrameWire {
  readonly direction: WireDirection;
  readonly envelope: unknown;
  readonly withheld?: boolean;
  /** Port `message` listeners the bootstrap had installed when an outbound message left. */
  readonly receivers?: number;
}

/** Everything one probe frame has reported so far. */
export interface ProbeChannel {
  readonly marks: string[];
  booted: boolean;
  report: ProbeReport | null;
  onWire: (wire: FrameWire) => void;
  readonly waiters: Array<() => void>;
}

/** The hidden stage that holds probe frames and the collector. */
export interface ProbeStage {
  readonly container: HTMLElement;
  /** Create a sandboxed frame and its report channel. The frame has no document yet. */
  createFrame(onWire: (wire: FrameWire) => void): { frame: HTMLIFrameElement; channel: ProbeChannel };
  /** Wait until `ready` holds for a channel. */
  waitFor(channel: ProbeChannel, ready: () => boolean, timeoutMs: number): Promise<boolean>;
  /** Send a harness signal to a probe document. */
  signal(frame: HTMLIFrameElement, name: string): void;
  /** Post a window-level message into a probe document from the collector frame, a non-parent sibling. */
  postFromSibling(frame: HTMLIFrameElement, message: unknown): void;
  dispose(): void;
}

/**
 * Create the stage inside `host`.
 *
 * @param host - Element the frames are appended to.
 * @returns The stage.
 */
export function createProbeStage(host: HTMLElement): ProbeStage {
  const doc = host.ownerDocument;
  const container = doc.createElement('div');
  container.setAttribute('data-kehto-conformance-stage', '');
  container.style.cssText = 'position:absolute;width:1px;height:1px;overflow:hidden;opacity:0;pointer-events:none';
  host.append(container);
  const collector = doc.createElement('iframe');
  collector.name = COLLECTOR_FRAME_NAME;
  collector.setAttribute('aria-hidden', 'true');
  container.append(collector);
  const channels = new Map<Window, ProbeChannel>();

  const onReport = (event: MessageEvent): void => {
    const channel = event.source ? channels.get(event.source as Window) : undefined;
    const data = event.data as { [REPORT_FIELD]?: unknown; body?: unknown } | null;
    if (!channel || !data || typeof data[REPORT_FIELD] !== 'string') return;
    if (data[REPORT_FIELD] === 'boot') channel.booted = true;
    if (data[REPORT_FIELD] === 'mark') channel.marks.push(String((data.body as { name?: unknown }).name));
    if (data[REPORT_FIELD] === 'wire') channel.onWire(data.body as FrameWire);
    if (data[REPORT_FIELD] === 'done') channel.report = data.body as ProbeReport;
    for (const wake of channel.waiters.splice(0)) wake();
  };
  collector.contentWindow?.addEventListener('message', onReport);

  return {
    container,
    createFrame(onWire) {
      const frame = doc.createElement('iframe');
      frame.setAttribute('sandbox', 'allow-scripts');
      container.append(frame);
      const channel: ProbeChannel = { marks: [], booted: false, report: null, onWire, waiters: [] };
      if (frame.contentWindow) channels.set(frame.contentWindow, channel);
      return { frame, channel };
    },
    async waitFor(channel, ready, timeoutMs) {
      const deadline = performance.now() + timeoutMs;
      while (!ready()) {
        const remaining = deadline - performance.now();
        if (remaining <= 0) return false;
        await Promise.race([
          new Promise<void>((resolve) => { channel.waiters.push(resolve); }),
          new Promise<void>((resolve) => { setTimeout(resolve, remaining); }),
        ]);
      }
      return true;
    },
    signal(frame, name) {
      frame.contentWindow?.postMessage({ [SIGNAL_FIELD]: name }, '*');
    },
    postFromSibling(frame, message) {
      const sibling = collector.contentWindow as (Window & { Function: FunctionConstructor }) | null;
      const target = frame.contentWindow;
      if (!sibling || !target) return;
      // A function created in the collector's realm makes the collector the
      // incumbent global, so the probe sees it, not the parent, as the source.
      const post = new sibling.Function('target', 'message', 'target.postMessage(message, "*");') as (target: Window, message: unknown) => void;
      post(target, message);
    },
    dispose() {
      collector.contentWindow?.removeEventListener('message', onReport);
      channels.clear();
      container.remove();
    },
  };
}
