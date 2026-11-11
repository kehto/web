# @kehto/rate-limit

## 0.2.0

### Minor Changes

- e291825: Restore voluntary temporal protection with the independent `@kehto/rate-limit` package.
  Runtime no longer constructs operation or prompt limiters implicitly. Hosts opt in
  with `permissions.rateLimiter` and `permissions.promptRateLimiter`; Paja explicitly
  installs both. Limiter configuration is managed on the host-owned instance.

  Move the old behavioral Firewall APIs and runtime `createFirewallState` into the
  explicit `@kehto/rate-limit/legacy` migration subpath. Legacy hosts supply the
  constructed state through `legacyFirewall`; runtime `firewallState` and
  `firewallPersistence` are removed. Legacy allow policies no longer bypass installed
  temporal controls. Firewall now exports only scoped approval/access policy.
