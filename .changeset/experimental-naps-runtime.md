---
"@kehto/runtime": minor
---

Route experimental `x-` domains with their own `x-<domain>:<action>` capabilities (`ServiceHandler.messageCapabilities`); borrowed or invented capabilities stay unrouted. The new `ServiceHandler.pushCapabilities` declares host-initiated types. They are delivered only through the owning handler's scoped `sendToEligibleNapplet`, after the live-session, domain-grant, block and ACL checks used for requests. Firewall admission for pushes is the napplet's hard policy (`deny`/`ask` drop silently), without consuming its request rate budget. `x-` replies are exactly one `<type>.result`. Each attached service now receives its own frozen context object. `AclStateContainer`, the enforce gates and `onCapabilityRevoked` accept `AclCapability` (built-in or extension), and ACL entries report `extensions` decisions. `AclStateContainer.check` denies strings that are neither built-in nor valid extension capabilities, and `grant` and `revoke` ignore them.
