---
"@kehto/paja": patch
---

The message log now gives NAP-INTENT's `invoke rejected` its own badge: `rejected (policy or handler)`. NAP-INTENT (napplet/naps master @ 377bf939) uses that one code for a firewall denial and for other rejections, such as an unauthorized explicit handler or a target that refuses delivery. Paja used to badge it `failed, not a denial`, which was wrong whenever the firewall had in fact denied the invoke. The text alone can't tell the two cases apart, so the badge names both instead of claiming either (kehto/web#523).
