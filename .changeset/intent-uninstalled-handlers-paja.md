---
"@kehto/paja": minor
---

Paja can now find NAP-INTENT handlers that you haven't opened yet. When no installed app handles an invoke (for example Feed's `napplet:note/open`), Paja shows **No installed app opens this** instead of rejecting straight away. **Search for apps** asks your configured relays for manifests whose `i` tag is the exact convention, and it also looks up the request's `handlerHint` coordinate. The results are listed under **Not installed yet**. Picking one runs the ordinary verified pointer load, installs it, and delivers the intent. Nothing is searched until you click, and nothing is installed until you pick. Search results are never shown to napplets. A new **App handlers** sidebar section lists the installed handlers for each archetype, with **Make default**, **Forget default**, and **Uninstall**. The new `intent.discoveryLimit` setting (20 by default, 1–200) caps how many results are offered per search (kehto/web#523).
