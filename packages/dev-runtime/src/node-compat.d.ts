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
