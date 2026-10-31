---
"@kehto/runtime": minor
---

Route experimental `x-` domains with their own `x-<domain>:<action>` capabilities (`ServiceHandler.messageCapabilities`); borrowed or invented capabilities stay unrouted. The new `ServiceHandler.pushCapabilities` declares host-initiated types. They are delivered only through the owning handler's scoped `sendToEligibleNapplet`, after the same live-session, domain-grant, block, ACL and firewall checks as requests. Each attached service now receives its own frozen context object. `AclStateContainer`, the enforce gates and `onCapabilityRevoked` accept `AclCapability` (built-in or extension), and ACL entries report `extensions` decisions.
