import { defineConfig } from 'vitepress';

export default defineConfig({
  title: 'Kehto Runtime',
  description: 'Runtime packages for hosting sandboxed Nostr napplet applications.',
  base: process.env.VITEPRESS_BASE ?? '/',
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: [
    /api\/modules\//,
    /^\.\/\.\.\/api(?:\/|$)/,
    /^\.\/\.\.\/\.\.\/README(?:\.md)?$/,
    /^\.\/\.\.\/\.\.\/packages(?:\/|$)/,
    /^\.\/\.\.\/specs\/NIP-5D(?:\.md)?$/,
    /^\.\/\.\.\/\.planning\/research\/PITFALLS(?:\.md)?$/,
  ],
  themeConfig: {
    search: {
      provider: 'local',
    },
    nav: [
      { text: 'Start', link: '/' },
      { text: 'Tutorials', link: '/tutorials/' },
      { text: 'How-tos', link: '/how-tos/' },
      { text: 'Packages', link: '/packages/' },
      { text: 'API', link: '/reference/api' },
    ],
    sidebar: [
      {
        text: 'Start',
        items: [
          { text: 'Overview', link: '/' },
          { text: 'Content Strategy', link: '/strategy/content-strategy' },
          { text: 'Information Architecture', link: '/strategy/information-architecture' },
          { text: 'Maintenance', link: '/strategy/maintenance' },
        ],
      },
      {
        text: 'Concepts',
        items: [
          { text: 'Architecture', link: '/concepts/architecture' },
          { text: 'Runtime and Shell Boundaries', link: '/concepts/runtime-shell-boundaries' },
          { text: 'Capability Negotiation', link: '/concepts/capability-negotiation' },
          { text: 'Gateway Artifacts', link: '/concepts/gateway-artifacts' },
        ],
      },
      {
        text: 'Tutorials',
        items: [
          { text: 'Tutorials', link: '/tutorials/' },
          { text: 'Minimal Host Shell', link: '/tutorials/minimal-host-shell' },
          { text: 'Runtime Implementation', link: '/tutorials/runtime-implementation' },
          { text: 'Napplet Integration', link: '/tutorials/napplet-integration' },
        ],
      },
      {
        text: 'How-tos',
        items: [
          { text: 'How-tos', link: '/how-tos/' },
          { text: 'Grant a Capability', link: '/how-tos/grant-capability' },
          { text: 'Register a Service', link: '/how-tos/register-service' },
          { text: 'Unsupported Requires', link: '/how-tos/unsupported-requires' },
          { text: 'Add a Reference Service', link: '/how-tos/add-reference-service' },
          { text: 'Debug postMessage', link: '/how-tos/debug-postmessage' },
          { text: 'Verify Gateway Artifact', link: '/how-tos/verify-gateway-artifact' },
        ],
      },
      {
        text: 'Package Reference',
        items: [
          { text: 'Packages', link: '/packages/' },
          { text: '@kehto/acl', link: '/packages/acl' },
          { text: '@kehto/runtime', link: '/packages/runtime' },
          { text: '@kehto/shell', link: '/packages/shell' },
          { text: '@kehto/services', link: '/packages/services' },
          { text: '@kehto/nip66', link: '/packages/nip66' },
          { text: '@kehto/wm', link: '/packages/wm' },
          { text: '@kehto/playground', link: '/packages/playground' },
        ],
      },
      {
        text: 'Reference',
        items: [
          { text: 'API Reference', link: '/reference/api' },
          { text: 'Troubleshooting', link: '/guides/troubleshooting' },
        ],
      },
      {
        text: 'Policies',
        items: [
          { text: 'Policy Index', link: '/policies/' },
          { text: 'NIP-5D Conformance', link: '/policies/NIP-5D-CONFORMANCE' },
          { text: 'Shell Class Policy', link: '/policies/SHELL-CLASS-POLICY' },
          { text: 'Shell Connect Policy', link: '/policies/SHELL-CONNECT-POLICY' },
          { text: 'Shell Resource Policy', link: '/policies/SHELL-RESOURCE-POLICY' },
        ],
      },
      {
        text: 'Migration Archive',
        items: [
          { text: 'Archive Index', link: '/migrations/' },
          { text: 'Migration README', link: '/migrations/README' },
        ],
      },
    ],
  },
});
