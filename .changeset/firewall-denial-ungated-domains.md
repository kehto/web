---
"@kehto/runtime": minor
"@kehto/conformance": minor
---

Answer legacy Firewall drops in the domains ACL does not gate on their own NAP
wires instead of an invented `<type>.error` (kehto/web#494).

- `common.*` → `.result` with `ok: false` and `error`; `getProfile` adds
  `pubkey` (the target when it is lowercase hex, otherwise `''`) and `follows`
  adds `pubkeys: []` (NAP-COMMON napplet/naps#67 at `8cd0eae8`).
- `lists.add`/`lists.remove` → `.result` with `ok: false`,
  `error: "policy-denied"` and the runtime's `reason`; `lists.supported` →
  `.result` with `error: "policy-denied"` (NAP-LISTS #68 at `7cf00cdb`).
- `serial.*`, `ble.*`, `webrtc.*` → `.result` with `error` (NAP-SERIAL #61 at
  `0c6e88ab`, NAP-BLE #62 at `b46b8691`, NAP-WEBRTC #59 at `fb4dd6f0`).
- `link.open` → `link.open.result` with `status: "denied"` and `error`
  (NAP-LINK #53 at `100e5c93`).
- `gamepad.subscribe` → the `gamepad.state` `"blocked"` snapshot;
  `gamepad.unsubscribe` stays silent (NAP-GAMEPAD #130 at `0b28f77e`).

`@kehto/conformance` adds `catalog/firewall-denial`, the Firewall sibling of
`catalog/acl-denial`, and the optional `TargetSession.openLegacyFirewall()` it
needs. The first-party Kehto target implements it with a scoped legacy-Firewall
session and the `firewall.block` / `firewall.rejections` controls.
