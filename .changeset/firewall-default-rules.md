---
"@kehto/firewall": minor
"@kehto/runtime": minor
"@kehto/shell": minor
"@kehto/paja": minor
---

Stop the Paja Firewall from asking about every exact scope, and make its decisions readable.

- **Paja** allows every interface and operation by default and asks before each `link.open`. The Firewall panel edits those default rules: change the default, or add an exception per interface or operation, for every napplet or one. Rules persist in the browser. An approved link opens from the approving click instead of raising a second confirmation, and a revoked single-target napplet starts again through admission instead of leaving an empty stage.
- **Shell** rebuilds `createBrowserApprovalUi`. The prompt asks a plain-language question, lists each exact scope, preselects the narrowest lifetime so one click answers, counts queued requests, and can turn an answer into a standing rule. Grants are a compact tree of single-line rows (napplet, interface, grant) with status dots and icon buttons, expanding for identity and the full scope; scopes allowed by a rule collapse to one counted row. The prompt no longer has a Cancel button or a lifetime select; Escape still cancels. New `rules` and `onAnswer` options, `BrowserApprovalRules` type and `BROWSER_APPROVAL_UI_STYLES` stylesheet.
- **Runtime** adds `PermissionAdapter.defaultDecision`, consulted before the prompt budget and the prompt. `allow` commits session grants whose ids start with `DEFAULT_RULE_GRANT_PREFIX`. Hosts that set no hook still ask for every scope.
- **Firewall** adds the pure rule model: `createPermissionRules`, `resolvePermissionRule`, `setPermissionRule`, `permissionRuleSubject`, `serializePermissionRules`, `deserializePermissionRules`.
