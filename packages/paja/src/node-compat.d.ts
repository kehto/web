declare module 'node:http' {
  interface ClientRequest {
    once(event: 'error', callback: (error: Error) => void): void;
    end(): void;
    destroy(error?: Error): void;
  }
  interface IncomingResponse {
    statusCode?: number;
    headers: Record<string, string | string[] | undefined>;
    on(event: 'data', callback: (chunk: Uint8Array) => void): void;
    on(event: 'end' | 'error', callback: (() => void) | ((error: Error) => void)): void;
  }
  export function createServer(
    listener: (
      request: {
        url?: string; method?: string; headers: Record<string, string | string[] | undefined>;
        on(event: 'data', callback: (chunk: Uint8Array) => void): void;
        on(event: 'end', callback: () => void): void;
        on(event: 'error', callback: (error: Error) => void): void;
        destroy(): void;
      },
      response: {
        writeHead(statusCode: number, headers: Record<string, string>): void;
        end(body?: string | Uint8Array): void;
      },
    ) => void,
  ): {
    listen(port: number, host: string, callback: () => void): void;
    once(event: 'error', callback: (error: Error) => void): void;
    off(event: 'error', callback: (error: Error) => void): void;
    close(callback: (error?: Error) => void): void;
    address(): string | { port: number } | null;
  };
  export function request(url: URL, options: Record<string, unknown>, callback: (response: IncomingResponse) => void): ClientRequest;
}

declare module 'node:https' {
  export function request(url: URL, options: Record<string, unknown>, callback: (response: import('node:http').IncomingResponse) => void): import('node:http').ClientRequest;
}

declare module 'node:dns/promises' {
  export function lookup(hostname: string, options: { all: true; verbatim: true }): Promise<readonly { address: string; family: number }[]>;
}

declare module 'node:net' { export function isIP(value: string): number; }
declare module 'node:crypto' { export function randomBytes(size: number): { toString(encoding: string): string }; }

declare module 'node:fs' {
  export interface Dirent {
    readonly name: string;
    isDirectory(): boolean;
  }

  export function existsSync(path: string | URL): boolean;
  export function readdirSync(path: string | URL, options: { withFileTypes: true }): Dirent[];
  export function readFileSync(path: string, encoding: 'utf8'): string;
  export function readFileSync(path: URL, encoding: 'utf8'): string;
  export function writeFileSync(path: string, data: string, encoding: 'utf8'): void;
  export function unlinkSync(path: string): void;
}

declare module 'node:path' {
  export function resolve(path: string): string;
}

declare module 'node:child_process' {
  export interface ChildProcess {
    kill(): void;
    readonly stdout?: {
      on(event: 'data', callback: (chunk: string | Uint8Array) => void): void;
    } | null;
    readonly stderr?: {
      on(event: 'data', callback: (chunk: string | Uint8Array) => void): void;
    } | null;
  }

  export function spawn(
    command: string,
    options: { shell: true; stdio: 'inherit' },
  ): ChildProcess;

  export function spawn(
    command: string,
    options: { shell: true; stdio: readonly ['inherit', 'pipe', 'pipe'] },
  ): ChildProcess;

  export function spawn(
    command: string,
    args: readonly string[],
    options: { stdio: 'inherit' },
  ): ChildProcess;

  export function spawn(
    command: string,
    args: readonly string[],
    options: { stdio: readonly ['inherit', 'pipe', 'pipe'] },
  ): ChildProcess;
}
