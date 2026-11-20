---
"@kehto/firewall": minor
"@kehto/runtime": minor
"@kehto/shell": patch
"@kehto/paja": patch
---

Keep the Firewall grant table bounded and fair (kehto/web#513). A default-rule `allow` no longer writes a session grant: the rule is consulted on every check, `RuntimePermissions.rulesChanged()` closes live work admitted under old rules, and `DEFAULT_RULE_GRANT_PREFIX` / `isRuleGrant` are deprecated. Each napplet holds at most `maxGrantsPerPrincipal` grants (default 512, new Paja setting `firewall.maxGrantsPerNapplet`), and `admitPermissionGrants` makes room by evicting the oldest session grants before refusing; persistent and once grants are never evicted.
