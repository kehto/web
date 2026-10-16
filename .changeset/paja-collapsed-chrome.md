---
"@kehto/paja": patch
---

Hide the whole chrome with the collapsed Paja drawer: the bottom status bar
disappears with the console column, and on hover-capable wide layouts the top bar
parks off-screen and returns from a 6px strip at the viewport edge (or on
keyboard focus). Touch and stacked layouts keep the top bar visible, since they
have no hover to restore it and the drawer toggle lives inside it.
