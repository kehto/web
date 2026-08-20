import { access, mkdtemp, readdir, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createIpcShellProjection } from '@kehto/shell-ipc';

const REQUEST_ID = 'ipc-proof-available';
const WINDOW_ID = 'ipc-proof-window';
const MAX_CONTROL_LINE_LENGTH = 512;
const childPath = resolve(dirname(fileURLToPath(import.meta.url)), '../tests/fixtures/raw-ipc-napplet.mjs');

function readArguments(argv) {
  let baseDirectory;
  let mode;
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (typeof value !== 'string' || (flag !== '--base-dir' && flag !== '--mode')) {
      throw new Error('Invalid reference host arguments.');
    }
    if (flag === '--base-dir') {
      if (baseDirectory !== undefined) throw new Error('Duplicate --base-dir argument.');
      baseDirectory = value;
    } else {
      if (mode !== undefined || (value !== 'graceful' && value !== 'forced')) {
        throw new Error('Invalid --mode argument.');
      }
      mode = value;
    }
  }
  if (!mode) throw new Error('Missing --mode argument.');
  return { baseDirectory, mode };
}

function emit(milestone, extra = {}) {
  process.stdout.write(`${JSON.stringify({ source: 'host', milestone, ...extra })}\n`);
}

function exists(path) {
  return access(path).then(() => true, () => false);
}

function delay(milliseconds) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, milliseconds));
}

async function waitFor(predicate, label, timeout = 10_000) {
  const deadline = Date.now() + timeout;
  while (!predicate()) {
    if (Date.now() >= deadline) throw new Error(`Timed out waiting for ${label}.`);
    await delay(10);
  }
}

function createAdapter(intentService) {
  return {
    sendToNapplet() {},
    auth: { getUserPubkey: () => null, getSigner: () => null },
    config: { getNappUpdateBehavior: () => 'auto-grant' },
    hotkeys: { executeHotkeyFromForward() {} },
    crypto: {
      verifyEvent: async () => true,
      randomUUID: () => 'ipc-proof-runtime-id',
      randomBytes: (length) => new Uint8Array(length),
    },
    aclPersistence: { persist() {}, load: () => null },
    manifestPersistence: { persist() {}, load: () => null },
    statePersistence: {
      get: () => null,
      set: () => true,
      remove() {},
      clear() {},
      keys: () => [],
      calculateBytes: () => 0,
    },
    windowManager: { createWindow: () => null },
    relayConfig: {
      addRelay() {},
      removeRelay() {},
      getRelayConfig: () => ({ discovery: [], super: [], outbox: [] }),
      getNip66Suggestions: () => [],
    },
    services: { intent: intentService },
  };
}

function parseChildRecord(line) {
  if (line.length > MAX_CONTROL_LINE_LENGTH) throw new Error('Child transcript record exceeded the proof limit.');
  const value = JSON.parse(line);
  if (!value || typeof value !== 'object' || Array.isArray(value) || typeof value.milestone !== 'string') {
    throw new Error('Invalid child transcript record.');
  }
  if (value.milestone === 'result' && value.id === REQUEST_ID) return { milestone: 'result', id: REQUEST_ID };
  if (['shell.ready', 'shell.init', 'intent.changed', 'hold'].includes(value.milestone)) return { milestone: value.milestone };
  throw new Error('Unexpected child transcript milestone.');
}

function testChildPath() {
  if (process.env.NODE_ENV !== 'test' || !process.env.KEHTO_IPC_PROJECTION_TEST_CHILD) return childPath;
  return resolve(process.env.KEHTO_IPC_PROJECTION_TEST_CHILD);
}

async function main() {
  const { baseDirectory: suppliedDirectory, mode } = readArguments(process.argv.slice(2));
  const ownsBaseDirectory = !suppliedDirectory;
  const baseDirectory = suppliedDirectory ?? await mkdtemp('/tmp/k-ipc-reference-');
  const hostMilestones = new Set();
  let serviceContext;
  let serviceFailure;
  const intentService = {
    descriptor: { name: 'intent', version: '1.0.0', description: 'IPC proof service' },
    onRegistered(context) { serviceContext = context; },
    handleMessage(_windowId, message, send) {
      if (message.type !== 'intent.available' || message.id !== REQUEST_ID) return;
      try {
        hostMilestones.add('service-dispatch');
        emit('service-dispatch', { id: REQUEST_ID });
        send({
          type: 'intent.available.result',
          id: REQUEST_ID,
          availability: { archetype: 'note', available: false, candidates: [], hasDefault: false },
        });
        hostMilestones.add('service-result');
        emit('service-result', { id: REQUEST_ID });
        const delivered = serviceContext?.sendToEligibleNapplet(WINDOW_ID, {
          type: 'intent.changed',
          availability: { archetype: 'note', available: false, candidates: [], hasDefault: false },
        }) === true;
        if (!delivered) throw new Error('The runtime rejected the recipient-mapped intent push.');
        hostMilestones.add('context-push');
        emit('context-push', { delivered: true });
      } catch (error) {
        serviceFailure = error instanceof Error ? error : new Error('IPC proof service failed.');
      }
    },
  };
  const composition = await createIpcShellProjection({ baseDirectory, runtimeAdapter: createAdapter(intentService) });
  const endpoint = await composition.registerEndpoint({
    windowId: WINDOW_ID,
    dTag: 'ipc-proof-napplet',
    aggregateHash: 'ipc-proof-hash',
    environment: { capabilities: { domains: ['intent'] }, services: ['intent'] },
  });
  let child;
  let childExited = false;
  let childExit;
  let cleanupEmitted = false;
  try {
    child = spawn(process.execPath, [testChildPath(), '--path', endpoint.path, '--mode', mode], { stdio: ['ignore', 'pipe', 'pipe'] });
    let stderr = '';
    let stdout = '';
    const childMilestones = new Set();
    let rejectTranscript;
    const transcriptFailure = new Promise((_, reject) => { rejectTranscript = reject; });
    transcriptFailure.catch(() => {});
    childExit = new Promise((resolveExit, rejectExit) => {
      child.once('error', rejectExit);
      child.once('exit', (code, signal) => {
        childExited = true;
        resolveExit({ code, signal });
      });
    });
    child.stderr.setEncoding('utf8');
    child.stdout.setEncoding('utf8');
    child.stderr.on('data', (chunk) => { stderr = `${stderr}${chunk}`.slice(-2048); });
    child.stdout.on('data', (chunk) => {
      try {
        stdout += chunk;
        let newline = stdout.indexOf('\n');
        if (newline < 0 && stdout.length > MAX_CONTROL_LINE_LENGTH) {
          throw new Error('Child transcript record exceeded the proof limit.');
        }
        while (newline >= 0) {
          const line = stdout.slice(0, newline);
          stdout = stdout.slice(newline + 1);
          if (line.length > 0) {
            const record = parseChildRecord(line);
            if (childMilestones.has(record.milestone)) throw new Error('Duplicate child transcript milestone.');
            childMilestones.add(record.milestone);
            process.stdout.write(`${JSON.stringify({ source: 'child', ...record })}\n`);
          }
          newline = stdout.indexOf('\n');
          if (newline < 0 && stdout.length > MAX_CONTROL_LINE_LENGTH) {
            throw new Error('Child transcript record exceeded the proof limit.');
          }
        }
      } catch (error) {
        rejectTranscript(error);
      }
    });

    const proofComplete = () => serviceFailure === undefined
      && hostMilestones.has('service-dispatch')
      && hostMilestones.has('service-result')
      && hostMilestones.has('context-push')
      && childMilestones.has('shell.init')
      && childMilestones.has('result')
      && childMilestones.has('intent.changed');
    const proofTimeout = process.env.NODE_ENV === 'test' ? 1_000 : 10_000;
    await Promise.race([
      waitFor(proofComplete, 'trusted host and raw child proof milestones', proofTimeout),
      transcriptFailure,
    ]);
    if (serviceFailure) throw serviceFailure;
    if (mode === 'forced') {
      await Promise.race([waitFor(() => childMilestones.has('hold'), 'raw child hold'), transcriptFailure]);
      child.kill('SIGKILL');
      const terminated = await childExit;
      if (terminated.signal !== 'SIGKILL') throw new Error('Forced proof did not observe SIGKILL.');
      emit('child-exit', { signal: 'SIGKILL' });
    } else {
      const exited = await childExit;
      if (exited.code !== 0 || exited.signal !== null) throw new Error(`Raw child exited unexpectedly: ${stderr ? 'diagnostic available' : 'no diagnostic'}`);
    }
    await waitFor(() => composition.runtime.sessionRegistry.getEntryByWindowId(WINDOW_ID) === undefined, 'runtime session cleanup');
    await endpoint.close();
    const replacement = await composition.registerEndpoint(endpoint.registration);
    const routeAbsent = replacement.registration.windowId === WINDOW_ID;
    await replacement.close();
    await composition.close();
    const cleanup = {
      routeAbsent,
      sessionAbsent: composition.runtime.sessionRegistry.getEntryByWindowId(WINDOW_ID) === undefined,
      endpointPathAbsent: !(await exists(endpoint.path)),
      endpointDirectoryAbsent: (await readdir(baseDirectory)).length === 0,
    };
    if (!Object.values(cleanup).every(Boolean)) throw new Error('Projection cleanup was incomplete.');
    emit('cleanup', cleanup);
    cleanupEmitted = true;
  } finally {
    if (child && !childExited) {
      child.kill('SIGKILL');
      await Promise.race([childExit.catch(() => undefined), delay(2_000)]);
    }
    await composition.close();
    if (ownsBaseDirectory) await rm(baseDirectory, { recursive: true, force: true });
    if (!cleanupEmitted && !ownsBaseDirectory) {
      // Caller-owned directories deliberately survive failed proof runs.
    }
  }
}

main().catch(() => {
  process.stderr.write('IPC projection reference host failed.\n');
  process.exitCode = 1;
});
