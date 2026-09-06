#!/usr/bin/env node
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchIpcShellHost } from './ipc-shell-host.js';
import type { IpcShellHostConfig } from './types.js';

const USAGE = 'Usage: kehto-ipc-shell --host ./host-config.mjs -- <executable> [...argv]\n';

interface HostModule {
  createIpcShellHostConfig?: () => IpcShellHostConfig | Promise<IpcShellHostConfig>;
}

async function main(argv: readonly string[]): Promise<number> {
  if (argv.length === 1 && argv[0] === '--help') {
    process.stdout.write(USAGE);
    return 0;
  }
  const delimiter = argv.indexOf('--');
  if (delimiter < 0 || delimiter === argv.length - 1) return usageFailure();
  const hostArgs = argv.slice(0, delimiter);
  const command = argv.slice(delimiter + 1);
  if (hostArgs.length !== 2 || hostArgs[0] !== '--host' || hostArgs[1].length === 0) return usageFailure();
  let config: IpcShellHostConfig;
  try {
    const moduleUrl = pathToFileURL(resolve(process.cwd(), hostArgs[1])).href;
    const module = await import(moduleUrl) as HostModule;
    if (typeof module.createIpcShellHostConfig !== 'function') throw new TypeError('missing factory');
    config = await module.createIpcShellHostConfig();
  } catch {
    process.stderr.write('kehto-ipc-shell: host configuration failed\n');
    return 1;
  }
  try {
    const host = await launchIpcShellHost({ ...config, command: { file: command[0], args: command.slice(1) } });
    return (await host.waitForExit()).status;
  } catch {
    process.stderr.write('kehto-ipc-shell: launch failed\n');
    return 1;
  }
}

function usageFailure(): number {
  process.stderr.write(USAGE);
  return 1;
}

void main(process.argv.slice(2)).then((status) => { process.exitCode = status; });
