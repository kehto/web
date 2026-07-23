---
'@kehto/services': minor
---

Retire legacy `audio:*` and `notifications:*` INC compatibility surfaces under draft NAP-INC PR #89 (`4593ce9e301ce098fd3dad64206fcd6f144fa7af`) and web projection PR #90 (`896c32c92deee68dc4d10fc1132b62df20cccb6f`). Services now ignore opaque `inc.emit` traffic; canonical direct `notify.*` and `media.*` behavior remains available.
