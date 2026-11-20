// Minimal Node declarations for the headless runner, in the style of
// packages/paja/src/node-compat.d.ts: the package has no @types/node.
declare module 'node:http' {
  export function createServer(
    listener: (
      request: { url?: string; method?: string; on?(event: 'close', callback: () => void): void },
      response: { writeHead(statusCode: number, headers: Record<string, string>): void; write?(chunk: string): void; end(body?: string | Uint8Array): void },
    ) => void,
  ): {
    listen(port: number, host: string, callback: () => void): void;
    once(event: 'error', callback: (error: Error) => void): void;
    close(callback: (error?: Error) => void): void;
    address(): string | { port: number } | null;
  };
}

declare module 'node:fs' {
  export function readFileSync(path: URL): Uint8Array;
  export function readFileSync(path: URL | string, encoding: 'utf8'): string;
  export function writeFileSync(path: string, data: string, encoding: 'utf8'): void;
  export function existsSync(path: URL | string): boolean;
  export function watch(path: URL | string, listener: () => void): { close(): void };
  export function appendFileSync(path: URL | string, data: string): void;
  export function mkdtempSync(prefix: string): string;
  export function readdirSync(path: string, options: { withFileTypes: true }): { name: string; isDirectory(): boolean }[];
  export function rmSync(path: string, options: { recursive: true; force: true }): void;
}

declare module 'node:os' { export function tmpdir(): string; }
declare module 'node:path' { export function join(...parts: string[]): string; }

declare module 'node:child_process' {
  export interface ChildProcess { kill(): void; unref(): void; on(event: 'exit', listener: (code: number | null) => void): void }
  export function spawn(command: string, options: { shell: true; stdio: 'inherit' }): ChildProcess;
  export function spawn(command: string, args: readonly string[], options: { stdio: 'ignore'; detached: true }): ChildProcess;
}

declare const process: {
  platform: string;
  on(event: 'SIGINT' | 'SIGTERM', listener: () => void): void;
  argv: string[];
  cwd(): string;
  env: Record<string, string | undefined>;
  exitCode?: number;
  stdout: { write(chunk: string): void };
  stderr: { write(chunk: string): void };
};
