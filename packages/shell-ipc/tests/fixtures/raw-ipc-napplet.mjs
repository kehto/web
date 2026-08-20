import { connect } from 'node:net';

const RECORD_SEPARATOR = 0x1e;
const LINE_FEED = 0x0a;
const REQUEST_ID = 'ipc-proof-available';

function readArguments(argv) {
  let path;
  let mode;
  for (let index = 0; index < argv.length; index += 2) {
    const flag = argv[index];
    const value = argv[index + 1];
    if (flag === '--path' && typeof value === 'string') path = value;
    if (flag === '--mode' && (value === 'graceful' || value === 'forced')) mode = value;
  }
  if (!path || !mode || argv.length !== 4) throw new Error('Invalid raw napplet arguments.');
  return { path, mode };
}

function encode(message) {
  return Buffer.concat([Buffer.from([RECORD_SEPARATOR]), Buffer.from(JSON.stringify(message), 'utf8'), Buffer.from([LINE_FEED])]);
}

function createDecoder(onMessage) {
  let buffered = Buffer.alloc(0);
  const decoder = new TextDecoder('utf-8', { fatal: true });
  return (chunk) => {
    buffered = Buffer.concat([buffered, chunk]);
    while (true) {
      const end = buffered.indexOf(LINE_FEED);
      if (end < 0) return;
      const frame = buffered.subarray(0, end);
      buffered = buffered.subarray(end + 1);
      if (frame[0] !== RECORD_SEPARATOR) throw new Error('Invalid JSON sequence frame.');
      const message = JSON.parse(decoder.decode(frame.subarray(1)));
      if (!message || typeof message !== 'object' || Array.isArray(message)) throw new Error('Expected a JSON object envelope.');
      onMessage(message);
    }
  };
}

function emit(milestone, extra = {}) {
  process.stdout.write(`${JSON.stringify({ milestone, ...extra })}\n`);
}

function fail() {
  process.exitCode = 1;
  process.stderr.write('Raw IPC napplet failed.\n');
}

try {
  const { path, mode } = readArguments(process.argv.slice(2));
  let initCount = 0;
  let requested = false;
  let receivedResult = false;
  let receivedPush = false;
  let socket;
  const timeout = setTimeout(() => {
    fail();
    socket?.destroy();
  }, 10_000);

  socket = connect(path);
  socket.once('connect', () => {
    emit('shell.ready');
    socket.write(encode({ type: 'shell.ready' }));
  });
  socket.on('data', createDecoder((message) => {
    if (message.type === 'shell.init') {
      initCount += 1;
      if (initCount !== 1 || requested) throw new Error('Unexpected shell.init lifecycle.');
      emit('shell.init');
      requested = true;
      socket.write(encode({ type: 'intent.available', id: REQUEST_ID, archetype: 'note' }));
      return;
    }
    if (message.type === 'intent.available.result' && message.id === REQUEST_ID) {
      if (!requested || receivedResult) throw new Error('Unexpected intent result.');
      receivedResult = true;
      emit('result', { id: REQUEST_ID });
      return;
    }
    if (message.type === 'intent.changed') {
      if (!receivedResult || receivedPush) throw new Error('Unexpected intent push.');
      receivedPush = true;
      emit('intent.changed');
      if (mode === 'graceful') socket.end();
      else emit('hold');
      return;
    }
    throw new Error('Unexpected host envelope.');
  }));
  socket.once('close', () => {
    clearTimeout(timeout);
    if (mode === 'graceful' && receivedPush) process.exit(0);
  });
  socket.once('error', () => {
    clearTimeout(timeout);
    fail();
  });
} catch {
  fail();
}
