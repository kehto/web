/**
 * Every user-tunable Paja number, with its built-in default and hard bounds.
 *
 * Defaults are the values Paja shipped with before they became settings. Bounds
 * keep abuse/DoS guards from being switched off (no 0, negative, or unbounded
 * caps) and security floors from being lowered (vault password length, PBKDF2
 * iterations, WebRTC room length may only be raised).
 *
 * Wire-contract and format numbers (Nostr event kinds, crypto sizes, HTTP
 * statuses, address ranges, magic bytes, unit conversions) are deliberately not
 * settings; `settings-guard.test.ts` keeps that split honest.
 */

/** Unit a setting is measured in; drives the panel label and integer checks. */
export type PajaSettingUnit = 'ms' | 'seconds' | 'bytes' | 'count' | 'chars' | 'iterations' | 'ratio';

/** Process that consumes a setting. Server settings come from the config file only. */
export type PajaSettingScope = 'browser' | 'server';

/** One registered Paja setting. */
export interface PajaSettingDefinition<K extends string = string> {
  /** Stable storage/config key, e.g. `relay.liveQueryWaitMs`. */
  readonly key: K;
  /** Panel group title. */
  readonly group: string;
  /** Short human label. */
  readonly label: string;
  /** Built-in default. */
  readonly defaultValue: number;
  /** Inclusive lower bound. */
  readonly min: number;
  /** Inclusive upper bound. */
  readonly max: number;
  /** Unit of the value. */
  readonly unit: PajaSettingUnit;
  /** Consuming process. */
  readonly scope: PajaSettingScope;
}

const KIB = 1024;
const MIB = KIB * KIB;
const SECOND_MS = 1000;
const MINUTE_MS = 60 * SECOND_MS;

function define<const K extends string>(
  group: string,
  scope: PajaSettingScope,
  rows: readonly (readonly [key: K, label: string, defaultValue: number, min: number, max: number, unit: PajaSettingUnit])[],
): PajaSettingDefinition<K>[] {
  return rows.map(([key, label, defaultValue, min, max, unit]) => ({ key, group, label, defaultValue, min, max, unit, scope }));
}

/** Registered settings in panel order. */
export const PAJA_SETTING_DEFINITIONS = Object.freeze([
  ...define('Relays and queries', 'browser', [
    ['relay.liveQueryWaitMs', 'Live relay query and connect wait', 4 * SECOND_MS, 250, 2 * MINUTE_MS, 'ms'],
    ['relay.hostQueryTimeoutMs', 'Host-owned relay query timeout', 5 * SECOND_MS, 250, 2 * MINUTE_MS, 'ms'],
    ['relay.contactListCandidateLimit', 'Contact-list candidates per lookup', 64, 1, 1024, 'count'],
    ['relay.profileQueryLimit', 'Events per profile or list query', 16, 1, 500, 'count'],
    ['relay.eventLookupLimit', 'Events per id lookup', 8, 1, 500, 'count'],
    ['relay.replaceableLookupLimit', 'Events per relay-list lookup', 2, 1, 100, 'count'],
    ['relay.missingProfileQueryMinimum', 'Minimum batch size for missing profiles', 10, 1, 500, 'count'],
    ['social.followParseYieldEvery', 'Follow tags parsed before yielding', 64, 1, 10_000, 'count'],
    ['social.profileWarmYieldEvery', 'Profiles warmed before yielding', 64, 1, 10_000, 'count'],
  ]),
  ...define('Resources and Blossom', 'browser', [
    ['resource.maxBytes', 'Maximum resource size', 10 * MIB, KIB, 512 * MIB, 'bytes'],
    ['resource.maxUrls', 'URLs per bulk request', 100, 1, 1000, 'count'],
    ['resource.maxServers', 'Blossom servers tried per blob', 8, 1, 64, 'count'],
    ['resource.maxRedirects', 'Redirects followed per fetch', 5, 0, 20, 'count'],
    ['blossom.serverListTtlMs', 'Server-list cache lifetime', 5 * MINUTE_MS, 0, 24 * 60 * MINUTE_MS, 'ms'],
    ['blossom.maxResourcesPerWindow', 'Tracked resources per napplet', 256, 1, 10_000, 'count'],
    ['blossom.maxContextsPerResource', 'Contexts kept per resource', 8, 1, 256, 'count'],
    ['blossom.maxServerListChars', 'Maximum server-list event size', 256 * KIB, KIB, 16 * MIB, 'chars'],
    ['blossom.maxUriHints', 'Server hints per blossom: URI', 8, 0, 64, 'count'],
    ['blossom.maxUriChars', 'Maximum blossom: URI length', 8 * KIB, 256, 64 * KIB, 'chars'],
  ]),
  ...define('Filesystem', 'browser', [
    ['fs.maxReadBytes', 'Maximum bytes per read', MIB, 1, 256 * MIB, 'bytes'],
    ['fs.maxWriteBytes', 'Maximum bytes per write', MIB, 1, 256 * MIB, 'bytes'],
    ['fs.maxRevisionBytes', 'Maximum file size for revision hashing', 16 * MIB, 1, 1024 * MIB, 'bytes'],
    ['fs.maxWatchCount', 'Active watches per napplet', 16, 1, 256, 'count'],
    ['fs.watchIntervalMs', 'Watch polling interval', SECOND_MS, 100, MINUTE_MS, 'ms'],
    ['fs.encodeChunkBytes', 'Base64 encode chunk size', 32 * KIB, KIB, 64 * KIB, 'bytes'],
  ]),
  ...define('WebRTC', 'browser', [
    ['webrtc.maxPayloadBytes', 'Maximum payload per send', 64 * KIB, KIB, MIB, 'bytes'],
    ['webrtc.maxSessionsPerWindow', 'Sessions per napplet', 4, 1, 64, 'count'],
    ['webrtc.maxPeers', 'Peers per session', 8, 1, 64, 'count'],
    ['webrtc.signalMaxAgeSeconds', 'Maximum signal age', 5 * 60, 10, 60 * 60, 'seconds'],
    ['webrtc.signalLookbackSeconds', 'Signal subscription lookback', 60, 0, 60 * 60, 'seconds'],
    ['webrtc.iceGatherTimeoutMs', 'ICE gathering timeout', 8 * SECOND_MS, 500, 2 * MINUTE_MS, 'ms'],
    ['webrtc.bufferedAmountLimitBytes', 'Data-channel buffer limit', MIB, 16 * KIB, 64 * MIB, 'bytes'],
    ['webrtc.seenSignalCache', 'Remembered signal ids', 256, 16, 65_536, 'count'],
    ['webrtc.roomMinChars', 'Minimum room length', 8, 8, 128, 'chars'],
    ['webrtc.roomMaxChars', 'Maximum room length', 128, 8, 1024, 'chars'],
    ['webrtc.channelMaxChars', 'Maximum channel label length', 64, 1, 1024, 'chars'],
    ['webrtc.protocolMaxChars', 'Maximum protocol length', 64, 1, 1024, 'chars'],
  ]),
  ...define('Multiplayer WebRTC profile', 'browser', [
    ['mp.maxMessageBytes', 'Maximum message size', 16 * KIB, KIB, MIB, 'bytes'],
    ['mp.roomMaxChars', 'Maximum room length', 256, 1, 4096, 'chars'],
    ['mp.maxPeers', 'Peers per room', 8, 1, 64, 'count'],
    ['mp.channelMaxChars', 'Maximum channel length', 64, 1, 1024, 'chars'],
    ['mp.protocolMaxChars', 'Maximum protocol length', 128, 1, 1024, 'chars'],
    ['mp.maxSessions', 'Rooms per napplet', 4, 1, 64, 'count'],
    ['mp.iceGatherTimeoutMs', 'ICE gathering timeout', 8 * SECOND_MS, 500, 2 * MINUTE_MS, 'ms'],
    ['mp.signalExpirationSeconds', 'Signal expiration', 60, 5, 60 * 60, 'seconds'],
    ['mp.signalMaxAgeSeconds', 'Maximum signal age', 60, 5, 60 * 60, 'seconds'],
    ['mp.signalLookbackSeconds', 'Signal subscription lookback', 10, 0, 60 * 60, 'seconds'],
    ['mp.rateWindowMs', 'Rate-limit window', SECOND_MS, 100, MINUTE_MS, 'ms'],
    ['mp.maxMessagesPerWindow', 'Messages per window', 240, 1, 100_000, 'count'],
    ['mp.maxBytesPerWindow', 'Bytes per window', 512 * KIB, KIB, 64 * MIB, 'bytes'],
    ['mp.maxSignalsPerWindow', 'Signals per window', 32, 1, 10_000, 'count'],
    ['mp.maxQueuedPerPeer', 'Queued messages per peer', 4, 1, 1024, 'count'],
    ['mp.maxSignalChars', 'Maximum signal size', 64_000, KIB, MIB, 'chars'],
    ['mp.sdpMaxChars', 'Maximum SDP size', 32_000, KIB, MIB, 'chars'],
    ['mp.nonceMaxChars', 'Maximum nonce length', 64, 8, 1024, 'chars'],
    ['mp.seenSignalCache', 'Remembered signal ids', 2048, 16, 65_536, 'count'],
    ['mp.maxRetiredPeers', 'Retired peer incarnations per room', 256, 1, 65_536, 'count'],
    ['mp.joinTimeoutMs', 'Peer join timeout', 45 * SECOND_MS, SECOND_MS, 10 * MINUTE_MS, 'ms'],
    ['mp.tickIntervalMs', 'Room maintenance interval', 2 * SECOND_MS, 100, MINUTE_MS, 'ms'],
    ['mp.bufferedAmountLimitBytes', 'Data-channel buffer limit', 256 * KIB, 16 * KIB, 64 * MIB, 'bytes'],
  ]),
  ...define('Intents and links', 'browser', [
    ['intent.maxDeliveryAttempts', 'Delivery attempts ceiling', 10, 1, 100, 'count'],
    ['intent.launcherReadyTimeoutMs', 'Launcher ready timeout', 10 * SECOND_MS, SECOND_MS, 10 * MINUTE_MS, 'ms'],
    ['intent.launcherOutcomeTimeoutMs', 'Launcher outcome timeout', 10 * SECOND_MS, SECOND_MS, 10 * MINUTE_MS, 'ms'],
    ['intent.linkMaxBytes', 'Maximum app-link size', 16 * KIB, KIB, MIB, 'bytes'],
    ['link.approvalClickWindowMs', 'Link approval click window', SECOND_MS, 100, 10 * SECOND_MS, 'ms'],
    ['link.labelMaxChars', 'Maximum link label length', 256, 1, 4096, 'chars'],
  ]),
  ...define('Signer', 'browser', [
    ['signer.nip46TimeoutMs', 'Remote signer request timeout', 30 * SECOND_MS, SECOND_MS, 10 * MINUTE_MS, 'ms'],
    ['signer.previewChars', 'Content shown in signing prompts', 240, 16, 10_000, 'chars'],
    ['signer.consentMaxSubjects', 'Remembered consent subjects', 128, 1, 10_000, 'count'],
    ['signer.consentMaxKindsPerSubject', 'Remembered kinds per subject', 128, 1, 10_000, 'count'],
    ['signer.consentMaxIdentityChars', 'Maximum consent identity length', 512, 64, 8192, 'chars'],
  ]),
  ...define('Language models', 'browser', [
    ['llm.modelsTimeoutMs', 'Model list timeout', 8 * SECOND_MS, 500, 2 * MINUTE_MS, 'ms'],
    ['llm.maxConnections', 'Saved connections', 32, 1, 256, 'count'],
    ['llm.connectionNameMaxChars', 'Maximum connection name length', 64, 1, 1024, 'chars'],
    ['llm.presetIdMaxChars', 'Maximum preset id length', 64, 1, 1024, 'chars'],
    ['llm.modelIdMaxChars', 'Maximum model id length', 200, 1, 4096, 'chars'],
    ['vault.minPasswordLength', 'Minimum vault password length', 12, 12, 256, 'chars'],
    ['vault.minDistinctChars', 'Minimum distinct password characters', 4, 4, 64, 'chars'],
    ['vault.pbkdf2Iterations', 'PBKDF2 iterations for new vaults', 600_000, 600_000, 10_000_000, 'iterations'],
  ]),
  ...define('Multiplayer providers', 'browser', [
    ['cvm.discoveryTimeoutMs', 'Provider discovery timeout', 15 * SECOND_MS, SECOND_MS, 5 * MINUTE_MS, 'ms'],
    ['cvm.serverRequestTimeoutMs', 'Server request answer window', 30 * SECOND_MS, SECOND_MS, 5 * MINUTE_MS, 'ms'],
    ['cvm.discoveryMaxBytes', 'Maximum discovery document size', 1_000_000, KIB, 64 * MIB, 'bytes'],
    ['cvm.discoveryEventLimit', 'Events per discovery query', 64, 1, 1000, 'count'],
    ['cvm.referenceMaxChars', 'Maximum discovery input length', 2048, 64, 64 * KIB, 'chars'],
    ['cvm.toolNameMaxChars', 'Maximum tool name length', 256, 1, 4096, 'chars'],
    ['cvm.maxSavedFamilies', 'Saved provider families', 16, 1, 256, 'count'],
    ['cvm.familySourceMaxChars', 'Maximum saved family source length', 4096, 64, 64 * KIB, 'chars'],
    ['multiplayer.textMaxChars', 'Maximum configuration text length', 256, 1, 4096, 'chars'],
    ['multiplayer.maxRelays', 'Relays per configuration', 16, 1, 256, 'count'],
    ['multiplayer.maxTools', 'Tools per family', 64, 1, 1024, 'count'],
    ['multiplayer.maxRegistryFamilies', 'Registry families', 16, 1, 256, 'count'],
    ['multiplayer.maxIceServers', 'ICE servers', 8, 1, 64, 'count'],
    ['multiplayer.maxIceUrls', 'URLs per ICE server', 8, 1, 64, 'count'],
  ]),
  ...define('Development target', 'browser', [
    ['target.maxDTagChars', 'Maximum development d tag length', 128, 1, 1024, 'chars'],
    ['target.maxNapDeclarations', 'Development NAP declarations', 64, 1, 1024, 'count'],
    ['target.maxReportedAssets', 'Relative assets listed in diagnostics', 8, 1, 1000, 'count'],
    ['target.maxReportedReferences', 'Network references listed in diagnostics', 8, 1, 1000, 'count'],
    ['target.runtimeWaitMs', 'Pointer resolution relay deadline', 5 * SECOND_MS, 250, 5 * MINUTE_MS, 'ms'],
    ['target.failureReasonChars', 'Characters per relay failure reason', 160, 16, 4096, 'chars'],
    ['target.failureReasonCount', 'Relay failure reasons shown', 3, 1, 50, 'count'],
    ['target.pointerReplacementLimit', 'Replacement manifests offered for a gone nevent', 50, 1, 500, 'count'],
  ]),
  ...define('Console and indicators', 'browser', [
    ['console.messageLogLimit', 'Messages kept in the log', 500, 10, 100_000, 'count'],
    ['console.messageLogVisibleRows', 'Messages rendered in the log', 120, 10, 10_000, 'count'],
    ['notify.badgeMaxCount', 'Largest badge count shown', 9999, 9, 1_000_000, 'count'],
    ['notify.maxActions', 'Actions per notification', 3, 0, 10, 'count'],
    ['gamepad.axisDeadzone', 'Stick deadzone', 0.12, 0, 1, 'ratio'],
    ['gamepad.buttonThreshold', 'Button press threshold', 0.05, 0, 1, 'ratio'],
    ['gamepad.activityHoldMs', 'Controller activity highlight', 420, 0, 10 * SECOND_MS, 'ms'],
  ]),
  ...define('Server (config file only)', 'server', [
    ['server.readinessPollIntervalMs', 'Target readiness poll interval', 250, 50, MINUTE_MS, 'ms'],
    ['server.shutdownGraceMs', 'Shutdown grace before force close', 500, 0, MINUTE_MS, 'ms'],
    ['server.requestBodyTimeoutMs', 'Request body timeout', 10 * SECOND_MS, SECOND_MS, 5 * MINUTE_MS, 'ms'],
    ['server.requestBodyMaxBytes', 'Maximum request body', 4 * KIB, 256, MIB, 'bytes'],
    ['server.resourceMaxBytes', 'Maximum proxied resource size', 10 * MIB, KIB, 512 * MIB, 'bytes'],
    ['server.resourceTimeoutMs', 'Proxied resource timeout', 30 * SECOND_MS, SECOND_MS, 10 * MINUTE_MS, 'ms'],
    ['server.targetNoticeTimeoutMs', 'Target network notice timeout', 2 * SECOND_MS, 100, MINUTE_MS, 'ms'],
    ['server.discoveryGraceMs', 'Managed command URL discovery grace', SECOND_MS, 0, MINUTE_MS, 'ms'],
  ]),
]);

/** Key of any registered Paja setting. */
export type PajaSettingKey = (typeof PAJA_SETTING_DEFINITIONS)[number]['key'];
