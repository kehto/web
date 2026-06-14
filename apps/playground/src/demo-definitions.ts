import type { Capability, NappletClass } from '@kehto/shell';

export interface DemoNappletDefinition {
  name: string;
  label: string;
  statusId: string;
  aclId: string;
  frameContainerId: string;
  surface?: 'napplet' | 'runtime-demo';
  hasAclControls?: boolean;
}

export type DemoProtocolPath =
  | 'identity-bind'
  | 'relay-publish'
  | 'relay-subscribe'
  | 'ifc-send'
  | 'ifc-receive'
  | 'state-read'
  | 'state-write'
  | 'identity-request'
  | 'relay-publish-signed';

export interface DemoPathAuditEntry {
  path: DemoProtocolPath;
  capability: Capability | null;
  direction: 'host->runtime' | 'runtime->napplet' | 'napplet->runtime';
  explanation: string;
}

export type DemoSignerMode = 'service' | 'fallback';

export const DEMO_SIGNER_MODE: DemoSignerMode = 'service';
export const STUB_ONLY_SERVICES: readonly string[] = [] as const;

export const DEMO_TOPOLOGY_SERVICE_NAMES: readonly string[] = [
  'identity',
  'keys',
  'media',
  'notifications',
  'relay',
  'signer',
  'storage',
  'theme',
] as const;

export const DEMO_NAPPLETS: DemoNappletDefinition[] = [
  { name: 'chat', label: 'chat', statusId: 'chat-status', aclId: 'chat-acl', frameContainerId: 'chat-frame-container' },
  { name: 'bot', label: 'bot', statusId: 'bot-status', aclId: 'bot-acl', frameContainerId: 'bot-frame-container' },
  { name: 'composer', label: 'composer', statusId: 'composer-status', aclId: 'composer-acl', frameContainerId: 'composer-frame-container' },
  { name: 'preferences', label: 'preferences', statusId: 'preferences-status', aclId: 'preferences-acl', frameContainerId: 'preferences-frame-container' },
  { name: 'toaster', label: 'toaster', statusId: 'toaster-status', aclId: 'toaster-acl', frameContainerId: 'toaster-frame-container' },
  { name: 'feed', label: 'feed', statusId: 'feed-status', aclId: 'feed-acl', frameContainerId: 'feed-frame-container' },
  { name: 'profile-viewer', label: 'profile-viewer', statusId: 'profile-status', aclId: 'profile-viewer-acl', frameContainerId: 'profile-viewer-frame-container' },
  { name: 'theme-switcher', label: 'theme-switcher', statusId: 'theme-status', aclId: 'theme-switcher-acl', frameContainerId: 'theme-switcher-frame-container' },
  {
    name: 'hotkey-chord',
    label: 'hotkey-chord',
    statusId: 'hotkey-chord-status',
    aclId: 'hotkey-chord-acl',
    frameContainerId: 'hotkey-chord-frame-container',
    surface: 'runtime-demo',
    hasAclControls: false,
  },
  {
    name: 'media-controller',
    label: 'media-controller',
    statusId: 'media-controller-status',
    aclId: 'media-controller-acl',
    frameContainerId: 'media-controller-frame-container',
    surface: 'runtime-demo',
    hasAclControls: false,
  },
  {
    name: 'config-demo',
    label: 'config-demo',
    statusId: 'config-demo-status',
    aclId: 'config-demo-acl',
    frameContainerId: 'config-demo-frame-container',
    surface: 'runtime-demo',
    hasAclControls: false,
  },
  {
    name: 'resource-demo',
    label: 'resource-demo',
    statusId: 'resource-demo-status',
    aclId: 'resource-demo-acl',
    frameContainerId: 'resource-demo-frame-container',
  },
  {
    name: 'cvm-relatr',
    label: 'cvm-relatr',
    statusId: 'cvm-relatr-status',
    aclId: 'cvm-relatr-acl',
    frameContainerId: 'cvm-relatr-frame-container',
  },
];

export const CLASS_BY_DTAG: ReadonlyMap<string, NappletClass> = new Map<string, NappletClass>([
  ['chat', null],
  ['bot', null],
  ['composer', null],
  ['preferences', null],
  ['toaster', null],
  ['feed', null],
  ['profile-viewer', null],
  ['theme-switcher', null],
  ['hotkey-chord', null],
  ['media-controller', null],
  ['config-demo', null],
  ['resource-demo', null],
  ['cvm-relatr', null],
]);

const missingClassEntries = DEMO_NAPPLETS
  .map((definition) => definition.name)
  .filter((name) => !CLASS_BY_DTAG.has(name));
if (missingClassEntries.length > 0) {
  throw new Error(
    `[CLASS-04 / H-05] CLASS_BY_DTAG is missing entries for DEMO_NAPPLETS: ${missingClassEntries.join(', ')}. ` +
    'Add each missing entry with an explicit class assignment.',
  );
}

export const DEMO_PROTOCOL_PATHS: DemoPathAuditEntry[] = [
  {
    path: 'identity-bind',
    capability: null,
    direction: 'napplet->runtime',
    explanation: 'NIP-5D iframe registration establishes napplet identity before capability checks begin.',
  },
  {
    path: 'relay-publish',
    capability: 'relay:write',
    direction: 'napplet->runtime',
    explanation: 'Regular EVENT publishes go through relay write enforcement before they fan out.',
  },
  {
    path: 'relay-subscribe',
    capability: 'relay:read',
    direction: 'napplet->runtime',
    explanation: 'REQ and relay delivery both rely on relay read permission.',
  },
  {
    path: 'ifc-send',
    capability: 'relay:write',
    direction: 'napplet->runtime',
    explanation: 'Non-state ifc events reuse the relay write sender gate before delivery.',
  },
  {
    path: 'ifc-receive',
    capability: 'relay:read',
    direction: 'runtime->napplet',
    explanation: 'Recipients need relay read permission to receive non-state ifc events.',
  },
  {
    path: 'state-read',
    capability: 'state:read',
    direction: 'napplet->runtime',
    explanation: 'shell:state-get and shell:state-keys topics are routed as state reads.',
  },
  {
    path: 'state-write',
    capability: 'state:write',
    direction: 'napplet->runtime',
    explanation: 'shell:state-set, remove, and clear topics require state write permission.',
  },
  {
    path: 'identity-request',
    capability: 'identity:read',
    direction: 'napplet->runtime',
    explanation: 'identity.getPublicKey reads flow through ShellAdapter.auth.getSigner; the shell signs relay.publish envelopes internally.',
  },
  {
    path: 'relay-publish-signed',
    capability: 'relay:write',
    direction: 'runtime->napplet',
    explanation: 'relay.publish envelopes are signed by the shell-internal signer before being handed to the relay pool.',
  },
];

export const DEMO_PROTOCOL_PATH_INDEX: Record<DemoProtocolPath, DemoPathAuditEntry> =
  Object.fromEntries(DEMO_PROTOCOL_PATHS.map((entry) => [entry.path, entry])) as Record<DemoProtocolPath, DemoPathAuditEntry>;

export function getDemoHostAuditSummary(): string {
  const auditedPaths = DEMO_PROTOCOL_PATHS
    .map((entry) => `${entry.path}:${entry.capability ?? 'none'}`)
    .join(', ');
  return `host ready -- signer mode: ${DEMO_SIGNER_MODE}; audited paths: ${auditedPaths}`;
}
