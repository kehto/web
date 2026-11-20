import type { DomainFixture, OperationCase } from './types.js';

type Envelope = Readonly<Record<string, unknown>> | null;

const NAPPLET_SESSION = 'conformance-napplet';
const SHELL_SESSION = 'conformance-shell';
const RETIRE_SESSION = 'conformance-retire';
const COMMAND_SESSION = 'conformance-command';

/** Shell-owned source the fixture asks a target to play. The host is reserved and never resolves. */
const SHELL_SOURCE = { url: 'https://media.conformance.invalid/track.mp3', mimeType: 'audio/mpeg' };

function created(owner: 'napplet' | 'shell') {
  return (reply: Envelope): string | null => {
    if (reply?.error !== undefined) return `creation failed: ${JSON.stringify(reply.error)}`;
    if (typeof reply?.sessionId !== 'string' || reply.sessionId.length === 0) return `sessionId was ${JSON.stringify(reply?.sessionId)}`;
    return reply.owner === owner ? null : `owner was ${JSON.stringify(reply.owner)}, expected ${owner}`;
  };
}

function rejected(reply: Envelope): string | null {
  if (typeof reply?.error !== 'string' || reply.error.length === 0) return `expected a rejection error, got ${JSON.stringify(reply)}`;
  return reply.sessionId === undefined ? null : `a rejected creation still returned sessionId ${JSON.stringify(reply.sessionId)}`;
}

const createNapplet = (id: string, sessionId: string, capabilities: string[]): OperationCase => ({
  id, type: 'media.session.create',
  payload: { owner: 'napplet', sessionId, metadata: { title: `Conformance ${sessionId}`, mediaType: 'audio' }, capabilities },
  semantics: { rule: 'The shell MUST return the canonical sessionId (and owner) in media.session.create.result', verify: created('napplet') },
});

const fireAndForget = (id: string, type: string, payload: Record<string, unknown>): OperationCase => ({ id, type, reply: null, noId: true, payload });

/**
 * NAP-MEDIA at the pinned draft head. Napplet-owned sessions report state,
 * capabilities and metadata; a shell-owned session takes a napplet command. The
 * fixture uses preferred session ids and assumes the shell keeps them (the NAP
 * allows the canonical id to equal the hint); a shell that rewrites them sees
 * those fire-and-forget messages as unknown-session messages, which it MUST ignore.
 */
export const MEDIA_FIXTURE: DomainFixture = {
  domain: 'media',
  cases: [
    createNapplet('media/session.create', NAPPLET_SESSION, ['play', 'pause']),
    {
      id: 'media/session.create-missing-owner', type: 'media.session.create', payload: { metadata: { title: 'No owner' } }, allowError: true,
      semantics: { rule: 'The shell MUST reject media.session.create messages without owner; when error is present the session was not created', verify: rejected },
    },
    {
      id: 'media/session.create-shell-missing-source', type: 'media.session.create', payload: { owner: 'shell', metadata: { title: 'No source' } }, allowError: true,
      semantics: { rule: 'The shell MUST reject owner: "shell" creation when source is missing', verify: rejected },
    },
    {
      id: 'media/session.create-shell', type: 'media.session.create',
      payload: { owner: 'shell', sessionId: SHELL_SESSION, source: SHELL_SOURCE, metadata: { title: 'Conformance shell playback' } },
      semantics: { rule: 'The shell MUST return the canonical sessionId (and owner) in media.session.create.result for a shell-owned session', verify: created('shell') },
    },
    fireAndForget('media/session.update', 'media.session.update', { sessionId: NAPPLET_SESSION, metadata: { title: 'Conformance updated' } }),
    fireAndForget('media/state', 'media.state', { sessionId: NAPPLET_SESSION, status: 'playing', position: 1, duration: 10, volume: 0.5 }),
    fireAndForget('media/capabilities', 'media.capabilities', { sessionId: NAPPLET_SESSION, actions: ['play', 'pause', 'seek'] }),
    fireAndForget('media/command', 'media.command', { sessionId: SHELL_SESSION, action: 'pause' }),
  ],
  pushes: [
    {
      id: 'media/session-ended-policy', type: 'media.session.ended',
      subscribe: createNapplet('media/session.create-retire', RETIRE_SESSION, ['play', 'pause']),
      trigger: { control: 'media.retire', payload: { sessionId: RETIRE_SESSION, reason: 'policy' } },
      match: { reason: 'policy' },
      then: [{ id: 'media/session.create-after-retire', type: 'media.session.create', payload: { owner: 'napplet', sessionId: RETIRE_SESSION } }],
      semantics: {
        rule: 'media.session.ended carries the retired sessionId and reason; retired identifiers MUST NOT be reused during the napplet endpoint\'s lifetime, even when a later creation requests the same preferred identifier',
        verify(push, replies) {
          if (typeof push?.sessionId !== 'string' || push.sessionId.length === 0) return `media.session.ended sessionId was ${JSON.stringify(push?.sessionId)}`;
          const again = replies['media/session.create-after-retire'];
          if (again?.error !== undefined) return `re-creation failed: ${JSON.stringify(again.error)}`;
          return again?.sessionId !== push.sessionId ? null : `the retired id ${push.sessionId} was reused`;
        },
      },
    },
    {
      id: 'media/command-to-napplet', type: 'media.command',
      subscribe: createNapplet('media/session.create-command', COMMAND_SESSION, ['play', 'pause']),
      trigger: { control: 'media.command', payload: { sessionId: COMMAND_SESSION, action: 'pause' } },
      match: { action: 'pause' },
      // Retirement: "The shell MUST NOT send further state, capabilities, controls, or commands for the retired session."
      unsubscribe: fireAndForget('media/session.destroy', 'media.session.destroy', { sessionId: COMMAND_SESSION }),
    },
  ],
};
