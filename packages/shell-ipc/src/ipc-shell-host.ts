import { spawn, type ChildProcess } from 'node:child_process';
import { constants } from 'node:os';
import type { RuntimeAdapter } from '@kehto/runtime';
import { createIpcShellProjection } from './ipc-shell.js';
import type {
  IpcShellHost,
  IpcShellHostExit,
  IpcShellHostExitReason,
  IpcShellHostOptions,
  IpcShellProjection,
} from './types.js';

const HOST_SIGNALS: readonly NodeJS.Signals[] = ['SIGHUP', 'SIGINT', 'SIGTERM'];
const DEFAULT_SHUTDOWN_GRACE_MS = 1_000;

/**
 * Launch and own one raw process over an experimental host-bound IPC projection.
 *
 * NAP-SHELL and NAP-INC lifecycle rules were checked at
 * `napplet/naps` `origin/master@c0f7dd14460622fc3a9870ea57a538474cf776fa`.
 * IPC is deliberately carrier-neutral experimental evidence, not a new NAP wire contract.
 *
 * @param options - Trusted registration, runtime policy, private transport controls, and literal child argv.
 * @returns A host-only lifecycle handle after the child has successfully spawned.
 */
export async function launchIpcShellHost(options: IpcShellHostOptions): Promise<IpcShellHost> {
  validateOptions(options);
  const graceMs = options.shutdownGraceMs ?? DEFAULT_SHUTDOWN_GRACE_MS;
  let requestedReason: IpcShellHostExitReason | undefined;
  let terminationTimer: NodeJS.Timeout | undefined;
  let terminalPromise: Promise<IpcShellHostExit> | undefined;
  let childExited = false;
  let child: ChildProcess | undefined;
  let projection: IpcShellProjection | undefined;
  const signalHandlers = new Map<NodeJS.Signals, () => void>();

  const removeSignalHandlers = (): void => {
    for (const [signal, handler] of signalHandlers) process.removeListener(signal, handler);
    signalHandlers.clear();
  };
  const clearTerminationTimer = (): void => {
    if (terminationTimer) clearTimeout(terminationTimer);
    terminationTimer = undefined;
  };
  const cleanup = async (): Promise<void> => {
    clearTerminationTimer();
    removeSignalHandlers();
    await projection?.close();
  };
  const complete = (code: number | null, signal: NodeJS.Signals | null): Promise<IpcShellHostExit> => {
    terminalPromise ??= (async () => {
      childExited = true;
      clearTerminationTimer();
      const reason = requestedReason ?? (signal ? 'independent-child-signal' : 'numeric-exit');
      const status = code ?? signalStatus(signal);
      await cleanup();
      return { status, code, signal, reason };
    })();
    return terminalPromise;
  };
  const requestTermination = (reason: IpcShellHostExitReason, signal: NodeJS.Signals): Promise<IpcShellHostExit> | undefined => {
    if (terminalPromise) return terminalPromise;
    requestedReason ??= reason;
    const liveChild = child;
    if (!liveChild || childExited) return terminalPromise;
    liveChild.kill(signal);
    terminationTimer ??= setTimeout(() => {
      if (!childExited) {
        if (requestedReason !== 'peer-disconnected') requestedReason = 'shutdown-timeout';
        liveChild.kill('SIGKILL');
      }
    }, graceMs);
    return undefined;
  };

  try {
    projection = await createIpcShellProjection({
      registration: options.registration,
      runtimeAdapter: {
        ...options.runtimeAdapter,
        sendToNapplet() {},
      } as RuntimeAdapter,
      baseDirectory: options.baseDirectory,
      limits: options.limits,
      onDiagnostic: options.onDiagnostic,
      onPeerDisconnected() {
        requestTermination('peer-disconnected', 'SIGTERM');
      },
    });
    const commandEnv: NodeJS.ProcessEnv = { ...(options.command.env ?? process.env) };
    for (const name of Object.keys(commandEnv)) if (name.startsWith('KEHTO_IPC_')) delete commandEnv[name];
    commandEnv.KEHTO_IPC_SOCKET_PATH = projection.path;
    child = spawn(options.command.file, [...(options.command.args ?? [])], {
      cwd: options.command.cwd,
      env: commandEnv,
      shell: false,
      stdio: 'inherit',
    });
  } catch (error) {
    await cleanup();
    throw error;
  }

  const ownedChild = child;
  const spawned = new Promise<void>((resolve, reject) => {
    ownedChild.once('spawn', resolve);
    ownedChild.once('error', reject);
  });
  ownedChild.once('exit', (code, signal) => { void complete(code, signal); });
  ownedChild.once('error', () => {
    if (!childExited) void complete(1, null);
  });
  try {
    await spawned;
  } catch (error) {
    await cleanup();
    throw error;
  }
  for (const signal of HOST_SIGNALS) {
    const handler = () => { requestTermination('forwarded-host-signal', signal); };
    signalHandlers.set(signal, handler);
    process.on(signal, handler);
  }
  const host: IpcShellHost = {
    registration: projection.registration,
    childPid: ownedChild.pid!,
    runtime: projection.runtime,
    endpointPath: projection.path,
    waitForExit: () => terminalPromise ?? new Promise((resolve) => {
      ownedChild.once('exit', (code, signal) => { void complete(code, signal).then(resolve); });
    }),
    close: () => requestTermination('explicit-close', 'SIGTERM') ?? (terminalPromise ?? Promise.resolve({
      status: 0, code: 0, signal: null, reason: 'explicit-close' as const,
    })),
  };
  return host;
}

function validateOptions(options: IpcShellHostOptions): void {
  if (typeof options.command.file !== 'string' || options.command.file.trim().length === 0) {
    throw new TypeError('IPC shell host command.file must be a non-empty executable filename.');
  }
  if (options.command.args && !options.command.args.every((argument) => typeof argument === 'string')) {
    throw new TypeError('IPC shell host command.args must contain only strings.');
  }
  if (options.shutdownGraceMs !== undefined
    && (!Number.isSafeInteger(options.shutdownGraceMs) || options.shutdownGraceMs < 0)) {
    throw new RangeError('IPC shell host shutdownGraceMs must be a non-negative safe integer.');
  }
}

function signalStatus(signal: NodeJS.Signals | null): number {
  return signal ? 128 + constants.signals[signal] : 1;
}
