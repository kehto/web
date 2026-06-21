declare module 'node:http' {
  export function createServer(
    listener: (
      request: { url?: string },
      response: {
        writeHead(statusCode: number, headers: Record<string, string>): void;
        end(body: string): void;
      },
    ) => void,
  ): {
    listen(port: number, host: string, callback: () => void): void;
    once(event: 'error', callback: (error: Error) => void): void;
    off(event: 'error', callback: (error: Error) => void): void;
    close(callback: (error?: Error) => void): void;
    address(): string | { port: number } | null;
  };
}

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
  export function spawn(
    command: string,
    options: { shell: true; stdio: 'inherit' },
  ): { kill(): void };

  export function spawn(
    command: string,
    args: readonly string[],
    options: { stdio: 'inherit' },
  ): { kill(): void };
}
