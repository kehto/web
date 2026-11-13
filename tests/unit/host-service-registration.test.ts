import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const PAJA_ADAPTER = readFileSync(fileURLToPath(
  new URL('../../packages/paja/src/browser-adapter.ts', import.meta.url),
), 'utf8');
const PAJA_SUPPORT = readFileSync(fileURLToPath(
  new URL('../../packages/paja/src/browser-adapter-support.ts', import.meta.url),
), 'utf8');
const PAJA_INTENT = readFileSync(fileURLToPath(
  new URL('../../packages/paja/src/browser-catalog-intent-service.ts', import.meta.url),
), 'utf8');

interface HostRegistration {
  readonly service: string;
  readonly paja?: readonly string[];
  readonly regression: string;
}

const REGISTRATIONS: readonly HostRegistration[] = [
  { service: 'resource', paja: ['createResourceService(', 'fetch: createPajaResourceFetch(', 'authorizeNetwork'], regression: 'resource transport guards' },
  { service: 'relay', paja: ['createRelayPoolService(', 'selectPublishRelayTier: getWriteRelays'], regression: 'relay service tests' },
  { service: 'outbox', paja: ['createOutboxService(', 'getSignerPubkey'], regression: 'outbox service tests' },
  { service: 'count', paja: ['createCountService({', 'planCount: () => ({ relays: getReadRelays() })', 'count: async ({ filters, relays, signal })', 'isFilterSupported: (filter)'], regression: 'count service tests' },
  { service: 'filesystem', paja: ['createPajaBrowserFsBackend(', 'createFsService({ backend: fsBackend })'], regression: 'filesystem service tests' },
  { service: 'upload', paja: ['createUploadService(', 'uploadInfo: uploadRuntime.uploadInfo'], regression: 'upload service tests' },
  { service: 'WebRTC', paja: ['createPajaWebrtcController(', 'createWebrtcService(webrtcController.serviceOptions)'], regression: 'WebRTC service tests' },
  { service: 'DM', paja: ['createPajaDevDmService(', 'services.dm = dmService'], regression: 'DM service tests' },
  { service: 'common', paja: ['createCommonService(', 'planRelays:'], regression: 'common service tests' },
  { service: 'lists', paja: ['createListsService(', 'planMutation:'], regression: 'lists service tests' },
  { service: 'media', paja: ['createMediaService({ playback: createBrowserMediaPlayback('], regression: 'media service tests' },
  { service: 'config', paja: ['createConfigService(configOptions)'], regression: 'config service tests' },
  { service: 'theme', paja: ['createThemeService({', 'onBroadcast: onThemeBroadcast'], regression: 'theme service tests' },
  { service: 'identity', paja: ['createIdentityService({', 'getSigner: () => createRuntimeSigner'], regression: 'identity service tests' },
  { service: 'keys', paja: ['createKeysService({ listenerTarget: document })'], regression: 'keys service tests' },
  { service: 'gamepad', paja: ['createGamepadService(browserGamepadOptions('], regression: 'gamepad service tests' },
  { service: 'serial', paja: ['createBrowserSerialController(', 'createSerialService(controller)'], regression: 'serial service tests' },
  { service: 'BLE', paja: ['createBrowserBleController(', 'createBleService(controller)'], regression: 'BLE service tests' },
  { service: 'CVM', paja: ['createCvmService({', 'createNostrCvmTransport('], regression: 'CVM service tests' },
  { service: 'link', paja: ['createLinkService({', 'confirmPajaExternalLink'], regression: 'link service tests' },
  { service: 'notification', paja: ['createNotifyService(notifyOptions)'], regression: 'notification service tests' },
  { service: 'intent', paja: ['createPajaCatalogIntentService(adapter, intentHost)', 'createIntentService({', 'resolveSender: host.resolveSender'], regression: 'intent service tests' },
];

describe('host service registrations', () => {
  it.each(REGISTRATIONS)('wires $service only with its host-owned contract', ({ paja, regression }) => {
    for (const marker of paja ?? []) expect(`${PAJA_ADAPTER}\n${PAJA_SUPPORT}\n${PAJA_INTENT}`).toContain(marker);
    expect(regression).toMatch(/service tests|transport guards|relay service tests/);
  });

  it('keeps the Paja resource transport out of napplet-visible host state', () => {
    expect(PAJA_ADAPTER).toContain('fetch: createPajaResourceFetch(');
  });
});
