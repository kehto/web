import { connect } from 'node:net';

function readMode(argv) {
  const index = argv.indexOf('--mode');
  return index >= 0 ? argv[index + 1] : 'forged';
}

const mode = process.env.KEHTO_IPC_PROJECTION_TEST_CASE ?? readMode(process.argv.slice(2));

if (mode === 'forged') {
  const path = process.argv[process.argv.indexOf('--path') + 1];
  const socket = connect(path);
  socket.once('connect', () => {
    socket.write(Buffer.from([0x1e, ...Buffer.from('{"type":"shell.ready"}\n') ]));
    process.stdout.write('{"milestone":"shell.init"}\n');
    process.stdout.write('{"milestone":"result","id":"ipc-proof-available"}\n');
    process.stdout.write('{"milestone":"intent.changed"}\n');
    socket.end();
  });
} else if (mode === 'malformed') {
  process.stdout.write('{not json}\n');
} else if (mode === 'duplicate') {
  process.stdout.write('{"milestone":"shell.ready"}\n{"milestone":"shell.ready"}\n');
} else if (mode === 'unterminated') {
  process.stdout.write('x'.repeat(513));
} else if (mode === 'oversize') {
  process.stdout.write(`${JSON.stringify({ milestone: 'shell.ready', padding: 'x'.repeat(512) })}\n`);
} else {
  throw new Error('Unknown adversarial mode.');
}
