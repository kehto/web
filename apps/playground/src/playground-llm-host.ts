/**
 * Playground NAP-LLM fixture host: one local echo "model" with no network.
 *
 * Follows napplet/naps PR #134 at 3e10939: selection returns a disclosed route,
 * every generation asks the user before the prompt is read, and the result is
 * a deterministic echo so demos and tests need no provider credentials.
 */
import { LlmServiceError, type LlmConnection, type LlmConnectionHost } from '@kehto/services';

const ECHO: LlmConnection = {
  id: 'playground-echo',
  name: 'Playground echo',
  model: 'echo-1',
  route: 'Playground shell (this browser only; nothing leaves the page)',
  images: true,
  json: true,
};

/**
 * Create the playground's echo host.
 *
 * @param confirm - Consent prompt; defaults to `window.confirm`, or auto-approve outside a browser.
 * @returns A host for `createLlmService({ host })`.
 * @example const llm = createLlmService({ host: createPlaygroundLlmHost() });
 */
export function createPlaygroundLlmHost(
  confirm: (text: string) => boolean | Promise<boolean> = (text) => typeof window === 'undefined' || typeof window.confirm !== 'function' ? true : window.confirm(text),
): LlmConnectionHost {
  return {
    select(_context, requirements) {
      if (requirements.model !== undefined && requirements.model !== ECHO.model) {
        throw new LlmServiceError('unsupported', `The playground only offers ${ECHO.model}.`);
      }
      return ECHO;
    },
    describe: (_context, id) => id === ECHO.id ? ECHO : null,
    authorize: (context, connection, request) => confirm(
      `Napplet window ${context.windowId} asks to send ${request.messages.length} message(s) to ${connection.name} (${connection.route}). Allow?`,
    ),
    async generate(_context, _connection, request, hooks) {
      const lastUser = [...request.messages].reverse().find((message) => message.role === 'user');
      const text = lastUser?.content.map((part) => part.type === 'text' ? part.text : `[image ${part.mimeType}]`).join('') ?? '';
      const output = request.format === 'json' ? JSON.stringify({ echo: text }) : `echo: ${text}`;
      hooks.onDelta(output);
      return { text: output, finish: 'stop', usage: { inputTokens: text.length, outputTokens: output.length } };
    },
  };
}
