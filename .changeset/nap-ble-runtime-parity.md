---
"@kehto/paja": patch
"@kehto/runtime": patch
"@kehto/services": patch
"@kehto/shell": patch
---

Add NAP-BLE runtime parity.

The runtime now dispatches the `ble` domain, `@kehto/services` exports a reference service for shell-mediated BLE/GATT sessions, shell capabilities can advertise NAP-BLE, and Paja/playground hosts register deterministic BLE support.
