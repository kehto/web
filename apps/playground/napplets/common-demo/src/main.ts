/**
 * common-demo napplet -- sends NAP-COMMON envelopes and renders shell decisions.
 */
import '@napplet/shim';
import { getMissingNapDomains } from '../../domain-availability';
import type {
  CommonDecodeNip19ResultMessage,
  CommonEncodeNip19ResultMessage,
  CommonFollowResultMessage,
  CommonFollowsResultMessage,
  CommonGetProfileResultMessage,
  CommonReactResultMessage,
  CommonReportResultMessage,
  CommonUnfollowResultMessage,
} from '@napplet/nap/common/types';

const REQUIRED_NAPS = ['common'] as const;
const CAPABILITY_WAIT_MS = 5_000;
const CAPABILITY_WAIT_INTERVAL_MS = 25;
const REQUEST_TIMEOUT_MS = 10_000;
const HEX = '0'.repeat(64);

const statusEl = document.getElementById('common-demo-status')!;
const encodedEl = document.getElementById('common-demo-encoded')!;
const profileEl = document.getElementById('common-demo-profile')!;
const followsEl = document.getElementById('common-demo-follows')!;
const actionsEl = document.getElementById('common-demo-actions')!;

function setStatus(text: string, color: 'gray' | 'green' | 'red' = 'gray'): void {
  statusEl.textContent = text;
  statusEl.style.color =
    color === 'green'
      ? 'var(--nap-theme-success, #39ff14)'
      : color === 'red'
        ? 'var(--nap-theme-danger, #ff3b3b)'
        : 'var(--nap-theme-muted, #888)';
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function waitForRequiredNaps(): Promise<void> {
  const deadline = Date.now() + CAPABILITY_WAIT_MS;
  let missing = getMissingNapDomains(REQUIRED_NAPS);
  while (missing.length > 0 && Date.now() < deadline) {
    await sleep(CAPABILITY_WAIT_INTERVAL_MS);
    missing = getMissingNapDomains(REQUIRED_NAPS);
  }
  if (missing.length > 0) {
    throw new Error(`unsupported NAP capability: ${missing.join(', ')}`);
  }
}

function newRequestId(label: string): string {
  return `common-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function requestCommon<T extends { type: string; id: string }>(message: { type: string; id: string; [key: string]: unknown }, resultType: T['type']): Promise<T> {
  return new Promise((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      window.removeEventListener('message', onMessage);
      reject(new Error(`${message.type} timed out`));
    }, REQUEST_TIMEOUT_MS);

    // Phase 58 raw-message allowlist: demo waits for one shell-owned NAP result.
    function onMessage(event: MessageEvent): void {
      if (event.source !== window.parent) return;
      const msg = event.data as Partial<T> | null;
      if (!msg || msg.type !== resultType || msg.id !== message.id) return;
      window.clearTimeout(timeout);
      window.removeEventListener('message', onMessage);
      resolve(msg as T);
    }

    window.addEventListener('message', onMessage);
    window.parent.postMessage(message, '*');
  });
}

async function init(): Promise<void> {
  await waitForRequiredNaps();
  setStatus('running common', 'gray');

  const encoded = await requestCommon<CommonEncodeNip19ResultMessage>({
    type: 'common.encodeNip19',
    id: newRequestId('encode'),
    input: { type: 'npub', hex: HEX },
  }, 'common.encodeNip19.result');
  const decoded = await requestCommon<CommonDecodeNip19ResultMessage>({
    type: 'common.decodeNip19',
    id: newRequestId('decode'),
    value: encoded.value,
  }, 'common.decodeNip19.result');
  const profile = await requestCommon<CommonGetProfileResultMessage>({
    type: 'common.getProfile',
    id: newRequestId('profile'),
    target: HEX,
  }, 'common.getProfile.result');
  const follows = await requestCommon<CommonFollowsResultMessage>({
    type: 'common.follows',
    id: newRequestId('follows'),
  }, 'common.follows.result');
  const follow = await requestCommon<CommonFollowResultMessage>({
    type: 'common.follow',
    id: newRequestId('follow'),
    pubkeys: [HEX],
  }, 'common.follow.result');
  const unfollow = await requestCommon<CommonUnfollowResultMessage>({
    type: 'common.unfollow',
    id: newRequestId('unfollow'),
    pubkeys: [HEX],
  }, 'common.unfollow.result');
  const react = await requestCommon<CommonReactResultMessage>({
    type: 'common.react',
    id: newRequestId('react'),
    targetEventId: HEX,
    reaction: '+',
  }, 'common.react.result');
  const report = await requestCommon<CommonReportResultMessage>({
    type: 'common.report',
    id: newRequestId('report'),
    target: { type: 'event', id: HEX },
    reason: 'spam',
    text: 'demo report',
  }, 'common.report.result');

  const encodedType = encoded.nip19Type ?? 'missing';
  const profileName = typeof profile.profile?.name === 'string' ? profile.profile.name : 'missing';
  const actionOk = [follow, unfollow, react, report].every((result) => result.ok) ? 'ok' : 'failed';

  encodedEl.textContent = encodedType;
  profileEl.textContent = profileName;
  followsEl.textContent = String(follows.pubkeys.length);
  actionsEl.textContent = actionOk;

  setStatus(`encoded:${encodedType}; decoded:${decoded.ok ? 'ok' : 'failed'}; profile:${profileName}; follows:${follows.pubkeys.length}; actions:${actionOk}`, 'green');
}

init().catch((err) => {
  setStatus('init failed', 'red');
  actionsEl.textContent = err instanceof Error ? err.message : String(err);
});
