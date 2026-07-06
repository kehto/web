#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { appendFileSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const ALL_E2E = 'tests/e2e';

const ALL_TRIGGERS = [
  /^\.github\/workflows\/ci\.yml$/,
  /^\.github\/workflows\/release\.yml$/,
  /^playwright\.config\.ts$/,
  /^package\.json$/,
  /^pnpm-lock\.yaml$/,
  /^pnpm-workspace\.yaml$/,
  /^turbo\.json$/,
  /^tsconfig/,
  /^vite\.config\./,
  /^shared-vite-config\.ts$/,
  /^scripts\/select-e2e-tests\.mjs$/,
  /^tests\/e2e\/helpers\//,
  /^tests\/e2e\/harness\//,
  /^tests\/e2e\/vite\.config\.ts$/,
  /^tests\/e2e\/shell-host\.html$/,
  /^tests\/e2e\/test-napplet\.html$/,
];

const NO_E2E_TRIGGERS = [
  /^\.changeset\//,
  /^\.planning\//,
  /^docs\//,
  /^specs\//,
  /^README\.md$/,
  /^AGENTS\.md$/,
  /^CLAUDE\.md$/,
  /^\.gitignore$/,
  /^\.npmrc$/,
  /^\.aislop\//,
  /^scripts\/(?:audit-docs|copy-docs-api|sync-jsr-versions|check-changeset-deletions)\.mjs$/,
  /^tests\/unit\//,
];

const VERSION_METADATA_TRIGGERS = [
  /^packages\/[^/]+\/CHANGELOG\.md$/,
  /^packages\/[^/]+\/jsr\.json$/,
  /^packages\/[^/]+\/package\.json$/,
];

const GROUPS = {
  acl: [
    'tests/e2e/acl-revoke-relay-write.spec.ts',
    'tests/e2e/acl-revoke-storage-write.spec.ts',
    'tests/e2e/demo-audit-correctness.spec.ts',
    'tests/e2e/playground-usability-controls.spec.ts',
    'tests/e2e/shell-ui-state-surfaces.spec.ts',
  ],
  cvm: [
    'tests/e2e/cvm-relatr.spec.ts',
  ],
  gateway: [
    'tests/e2e/gateway-artifact-parity.spec.ts',
    'tests/e2e/naps-path-conformance.spec.ts',
    'tests/e2e/nip5d-contract-conformance.spec.ts',
  ],
  identity: [
    'tests/e2e/identity-flow.spec.ts',
    'tests/e2e/nap-identity.spec.ts',
    'tests/e2e/profile-open.spec.ts',
    'tests/e2e/relay-subscribe.spec.ts',
    'tests/e2e/signer-persistence.spec.ts',
  ],
  inc: [
    'tests/e2e/inc-roundtrip.spec.ts',
    'tests/e2e/nap-inc.spec.ts',
    'tests/e2e/profile-open.spec.ts',
  ],
  notify: [
    'tests/e2e/demo-notification-service.spec.ts',
    'tests/e2e/demo-service-toggle.spec.ts',
    'tests/e2e/nap-notify.spec.ts',
    'tests/e2e/notify-lifecycle.spec.ts',
    'tests/e2e/shell-ui-state-surfaces.spec.ts',
  ],
  paja: [
    'tests/e2e/paja-single-window.spec.ts',
  ],
  relay: [
    'tests/e2e/acl-revoke-relay-write.spec.ts',
    'tests/e2e/demo-audit-correctness.spec.ts',
    'tests/e2e/nap-relay.spec.ts',
    'tests/e2e/relay-activity.spec.ts',
    'tests/e2e/relay-publish.spec.ts',
    'tests/e2e/relay-publish-encrypted.spec.ts',
    'tests/e2e/relay-subscribe.spec.ts',
    'tests/e2e/shell-ui-state-surfaces.spec.ts',
  ],
  resource: [
    'tests/e2e/gateway-artifact-parity.spec.ts',
    'tests/e2e/nap-resource.spec.ts',
  ],
  shellUi: [
    'tests/e2e/demo-boot.spec.ts',
    'tests/e2e/demo-concurrent-boot.spec.ts',
    'tests/e2e/demo-debugger.spec.ts',
    'tests/e2e/demo-node-inspector.spec.ts',
    'tests/e2e/harness-smoke.spec.ts',
    'tests/e2e/playground-usability-controls.spec.ts',
    'tests/e2e/shell-ui-state-surfaces.spec.ts',
    'tests/e2e/topology-lines.spec.ts',
  ],
  storage: [
    'tests/e2e/acl-revoke-storage-write.spec.ts',
    'tests/e2e/demo-audit-correctness.spec.ts',
    'tests/e2e/nap-storage.spec.ts',
    'tests/e2e/playground-usability-controls.spec.ts',
    'tests/e2e/storage-persist.spec.ts',
  ],
  theme: [
    'tests/e2e/nap-theme.spec.ts',
    'tests/e2e/playground-usability-controls.spec.ts',
    'tests/e2e/theme-broadcast.spec.ts',
  ],
};

const PLAYGROUND_CORE = [
  ...GROUPS.gateway,
  ...GROUPS.identity,
  ...GROUPS.inc,
  ...GROUPS.notify,
  ...GROUPS.relay,
  ...GROUPS.resource,
  ...GROUPS.shellUi,
  ...GROUPS.storage,
  ...GROUPS.theme,
  'tests/e2e/napplet-auth.spec.ts',
];

const SERVICE_GROUPS = [
  'cvm',
  'identity',
  'inc',
  'notify',
  'relay',
  'resource',
  'storage',
  'theme',
];

function uniq(values) {
  return [...new Set(values)].sort();
}

function hasToken(file, tokens) {
  return tokens.some((token) => file.toLowerCase().includes(token));
}

function existingSpecs(specs) {
  return specs.filter((spec) => existsSync(spec));
}

function classifyDomain(file) {
  if (hasToken(file, ['relay', 'outbox'])) return GROUPS.relay;
  if (hasToken(file, ['storage', 'state'])) return GROUPS.storage;
  if (hasToken(file, ['identity', 'signer', 'profile'])) return GROUPS.identity;
  if (hasToken(file, ['notify', 'notification'])) return GROUPS.notify;
  if (hasToken(file, ['theme'])) return GROUPS.theme;
  if (hasToken(file, ['resource', 'bytes'])) return GROUPS.resource;
  if (hasToken(file, ['inc', 'intent'])) return GROUPS.inc;
  if (hasToken(file, ['cvm'])) return GROUPS.cvm;
  if (hasToken(file, ['nip', 'manifest', 'gateway', 'artifact', 'naps'])) return GROUPS.gateway;
  if (hasToken(file, ['acl', 'capability', 'capabilities'])) return GROUPS.acl;
  if (hasToken(file, ['ui', 'topology', 'debugger', 'node-inspector'])) return GROUPS.shellUi;
  return null;
}

function selectionForFile(file) {
  if (/^tests\/e2e\/[A-Za-z0-9._-]+\.spec\.ts$/.test(file)) {
    return { specs: [file], reason: `${file}: direct spec change` };
  }

  if (ALL_TRIGGERS.some((pattern) => pattern.test(file))) {
    return { all: true, reason: `${file}: shared e2e workflow/config surface` };
  }

  if (NO_E2E_TRIGGERS.some((pattern) => pattern.test(file))) {
    return { specs: [], reason: `${file}: no browser runtime effect` };
  }

  if (VERSION_METADATA_TRIGGERS.some((pattern) => pattern.test(file))) {
    return { specs: [], reason: `${file}: release metadata has no browser runtime effect` };
  }

  if (/^packages\/(?:paja|cli)\//.test(file)) {
    return { specs: GROUPS.paja, reason: `${file}: paja runtime surface` };
  }

  const domainSpecs = classifyDomain(file);
  if (domainSpecs) {
    return { specs: domainSpecs, reason: `${file}: matched domain-specific e2e specs` };
  }

  if (/^packages\/(?:runtime|shell)\//.test(file)) {
    return { all: true, reason: `${file}: shared runtime/shell surface` };
  }

  if (file.startsWith('packages/services/')) {
    return {
      specs: uniq(SERVICE_GROUPS.flatMap((group) => GROUPS[group])),
      reason: `${file}: shared services surface`,
    };
  }

  if (/^packages\/(?:acl|firewall)\//.test(file)) {
    return { specs: GROUPS.acl, reason: `${file}: ACL/firewall behavior surface` };
  }

  if (file.startsWith('packages/nip/')) {
    return { specs: GROUPS.gateway, reason: `${file}: NIP/gateway behavior surface` };
  }

  if (file.startsWith('packages/wm/')) {
    return { specs: GROUPS.shellUi, reason: `${file}: shell UI/window behavior surface` };
  }

  if (file.startsWith('apps/playground/napplets/')) {
    const nappletSpecs = classifyDomain(file);
    return {
      specs: nappletSpecs ?? PLAYGROUND_CORE,
      reason: `${file}: playground napplet surface`,
    };
  }

  if (file.startsWith('apps/playground/')) {
    return { specs: PLAYGROUND_CORE, reason: `${file}: playground host surface` };
  }

  if (/^(apps|packages|tests\/e2e)\//.test(file)) {
    return { all: true, reason: `${file}: unclassified runtime source surface` };
  }

  return { specs: [], reason: `${file}: ignored by e2e selector` };
}

export function selectE2eTests(changedFiles) {
  const files = uniq(changedFiles.filter(Boolean).map((file) => file.trim()).filter(Boolean));
  const reasons = [];
  const specs = [];

  for (const file of files) {
    const selection = selectionForFile(file);
    reasons.push(selection.reason);
    if (selection.all) {
      return {
        runE2e: true,
        specArgs: ALL_E2E,
        specs: [ALL_E2E],
        all: true,
        changedFiles: files,
        reason: selection.reason,
      };
    }
    specs.push(...selection.specs);
  }

  const selectedSpecs = existingSpecs(uniq(specs));
  return {
    runE2e: selectedSpecs.length > 0,
    specArgs: selectedSpecs.join(' '),
    specs: selectedSpecs,
    all: false,
    changedFiles: files,
    reason: reasons.join('; ') || 'no changed files',
  };
}

function parseArgs(argv) {
  const args = {
    files: [],
    format: 'text',
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--base') args.base = argv[++index];
    else if (arg === '--head') args.head = argv[++index];
    else if (arg === '--github-output') args.githubOutput = argv[++index];
    else if (arg === '--json') args.format = 'json';
    else if (arg === '--files') {
      while (argv[index + 1] && !argv[index + 1].startsWith('--')) {
        args.files.push(argv[++index]);
      }
    } else {
      args.files.push(arg);
    }
  }

  return args;
}

function gitChangedFiles(base, head) {
  if (!base || !head || /^0+$/.test(base)) return [];

  try {
    const output = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', `${base}...${head}`], {
      encoding: 'utf8',
    });
    return output.split('\n').filter(Boolean);
  } catch {
    const output = execFileSync('git', ['diff', '--name-only', '--diff-filter=ACMR', `${base}..${head}`], {
      encoding: 'utf8',
    });
    return output.split('\n').filter(Boolean);
  }
}

function writeGithubOutput(file, result) {
  const entries = {
    run_e2e: String(result.runE2e),
    spec_args: result.specArgs,
    reason: result.reason,
    changed_count: String(result.changedFiles.length),
  };

  const body = Object.entries(entries)
    .map(([key, value]) => `${key}=${String(value).replace(/\n/g, ' ')}`)
    .join('\n');
  appendFileSync(file, `${body}\n`);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const files = args.files.length > 0 ? args.files : gitChangedFiles(args.base, args.head);
  const result = selectE2eTests(files);

  if (args.githubOutput) writeGithubOutput(args.githubOutput, result);

  if (args.format === 'json') {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  process.stdout.write(`run_e2e=${result.runE2e}\n`);
  process.stdout.write(`spec_args=${result.specArgs}\n`);
  process.stdout.write(`reason=${result.reason}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
