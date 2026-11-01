# Media playback

Kehto's media service manages shell-owned audio/video playback and napplet-owned
sessions. Paja and the playground mount a collapsible **Media player** panel when
sessions exist. It shows metadata, playback position, volume, supported transport
controls, video output, and a **Close session** button. Collapsing the panel does
not stop playback; closing a session does.

## Protocol authority

Checked against [NAP-MEDIA draft PR #10](https://github.com/napplet/naps/pull/10),
commit `7806f438530251fce5129f8e6239d6b642278759`,
[`naps/NAP-MEDIA.md`](https://github.com/napplet/naps/blob/7806f438530251fce5129f8e6239d6b642278759/naps/NAP-MEDIA.md).
The draft is the working authority. Merged master has no NAP-MEDIA document.
Kehto implements its ownership, command direction, creation ordering, retirement,
source-policy, and endpoint-cleanup rules. Published `@napplet/nap` 0.32 types
omit the draft's `reason`, `command`, and `onEnded` additions; Kehto exports
`MediaPlaybackState` and `MediaPlaybackCommand` and protects its injected media
binding from older shim assignments until upstream packages catch up.

## Host setup

```ts
import {
  createBrowserMediaPlayback,
  createBrowserMediaStreamFetch,
  createMediaService,
  createResourceService,
  mountMediaPlayer,
} from '@kehto/services';

// Keep the host's existing fetch resolver and origin-grant configuration.
const resource = createResourceService({
  ...hostResourceOptions,
  stream: createBrowserMediaStreamFetch(),
});
const media = createMediaService({
  playback: createBrowserMediaPlayback({ resource, stream: resource.openStream }),
});
const unmount = mountMediaPlayer(media);
runtime.registerService('media', media);

// During host teardown:
unmount();
media.destroy();
```

`createMediaService()` without a playback backend still supports napplet-owned
sessions and OS controls, and rejects shell-owned creation. `HostMediaBridge`
handles OS metadata/action integration; `MediaPlaybackBackend` handles source
resolution and actual output. `getSessions()`, `subscribe()`, `command()`,
`getElement()`, and `retire()` allow custom host players. Snapshots contain no
source bytes or resolved playback URLs. Runtime service removal destroys output.
The browser OS-controls bridge uses a one-second PCM silence clip for its audio
prime; an empty WAV has no playable duration. The prime stays until the final
registered session retires.

## Napplet setup

```js
const media = window.napplet.media;
const result = await media.createSession({
  owner: 'shell',
  source: { url: 'https://example.com/track.mp3' },
  metadata: { title: 'Track', artist: 'Artist' },
  context: { label: 'Playlist', index: 0, total: 1 },
  autoplay: false,
});
if (result.error) throw new Error(result.error);
const id = result.sessionId;
media.onState(id, state => renderPlaybackState(state));
media.onCapabilities(id, actions => renderAvailableActions(actions));
media.onEnded(id, event => releasePlayerResources(event.reason));
media.command(id, { action: 'play' });
```

Use the returned canonical identifier for every subsequent operation. A
napplet-owned player reports its actual state/capabilities and handles
`onCommand(id, command => ...)` objects. It must stop output on `onEnded`.
Unknown or retired sessions ignore commands; only creation can establish a new
session. Creation success precedes state, controls, and retirement notifications.
The binding retains terminal records, delivers them to late `onEnded` handlers
once, and suppresses subsequent state/control/command callbacks. It trusts only
the parent frame and does not require NAP-SHELL to be exposed.

## Source and output policy

- The browser backend resolves `source.url` or `source.blossomHash` through the
  host's existing `resource.bytes` handler, with the original window identity,
  cancellation, byte limits, and origin policy. It never assigns external URLs
  to media elements. Only approved Blob URLs reach the player; teardown revokes
  them. Napplet-owned source references are advisory and are never fetched.
- Paja uses its byte-classifying resource resolver, including configured and
  window-scoped Blossom servers. The playground retains its resource origin
  grants. A media capability does not bypass the configured resource policy.
- Finite audio/video files use browser-supported codecs. With `live: true`,
  Paja and the playground stream MP3 or ADTS AAC through `ResourceService.openStream`
  and MediaSource without waiting for the response to finish. The host-only
  `stream` resolver uses the same endpoint origin grants as atomic resources;
  it adds no NAP-RESOURCE wire message and exposes no bytes to the napplet.
  The browser resolver requires public HTTPS, disables redirects, credentials
  and referrers, and classifies initial bytes instead of trusting MIME hints.
  CORS and browser private-network protections apply. Browser-only hosts cannot
  enforce DNS-time IP checks; production proxies must enforce them before connecting.
  Live MP3/AAC requires browser MediaSource codec support. Nostr references,
  HLS/DASH manifests, Ogg live streams, and queues require a custom backend.
- Live playback reads one chunk at a time, appends at most 64 KiB per update,
  pauses consumption above 30 seconds buffered ahead, and removes audio more
  than 15 seconds behind playback. A single upstream chunk is capped at 1 MiB.
  Pause and Stop keep the live session available; neither seeks to an evicted
  position. Retirement, endpoint removal and revoked media access cancel the
  response reader, stop output and revoke its MediaSource URL. Finite-resource
  byte limits still apply to complete files; live audio uses bounded buffering
  rather than a cumulative limit that would stop radio after a few minutes.
- Browser autoplay restrictions apply. Denied autoplay fails creation and frees
  its output; use `autoplay: false` and the host Play button when activation is
  required. A later failed play leaves the session available with an error state.
- Seek is enabled only for finite duration, non-live media. Next/Previous appear
  only when a napplet or custom backend advertises them. Empty capabilities
  disable commands; napplet-owned sessions start with no actions unless declared.
  Seek and volume values are validated at the host boundary.
- This host allows concurrent sessions and does not automatically pause or
  resume on focus transitions. It does not promote sessions to persistent
  playback. Endpoint removal aborts pending loads and stops all bound output.
  ACL revocation/blocking retires live sessions with reason `policy`; regranting
  cannot revive them. Natural completion reports `stopped` with reason `ended`
  and leaves the session replayable.
- Context labels/details are displayed as text. Context links are ignored and
  confer no routing or fetch authority. Remote artwork is omitted from the
  default player and OS metadata, avoiding an unmediated artwork fetch.

The defaults allow 16 active or pending sessions per endpoint. Host runtime ACL
and firewall admission apply to incoming media messages. Session operations
also check their owning window inside the service.

## Migration

Use `media.command(id, { action, value, reason })` instead of `sendCommand`.
Use a command-object callback instead of `(action, value)`. The retained alias
and detectable two-argument callback emit warnings once per endpoint. Unary
legacy callbacks cannot be distinguished from the new callback and must be
migrated explicitly. See [the compatibility register](https://github.com/kehto/web/blob/main/docs/compatibility.md).

Regression evidence lives in `media-playback.test.ts`,
`browser-media-stream-fetch.test.ts`, `napplet-namespace.test.ts`, `media-acl-revocation.test.ts`, and the real-browser
`nap-media-player.spec.ts` tests for both hosts.
