---
"@kehto/services": minor
"@kehto/shell": minor
"@kehto/runtime": patch
"@kehto/paja": patch
---

Implement NAP-MEDIA shell-owned audio/video and live MP3/AAC radio through host resource policy,
with a shared player in Paja and the playground. Bind sessions to their endpoint,
validate controls, retire output on destruction or revoked access, and retain
terminal notifications in the protected injected API. Add canonical command-object
callbacks and command/onEnded operations; retain warned legacy sendCommand and
two-argument callbacks. Unary legacy callbacks must migrate to command objects.
