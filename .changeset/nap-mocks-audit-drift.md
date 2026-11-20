---
"@kehto/mocks": minor
---

Bring the NAP mocks back in line with `napplet/naps` so `audit:naps --strict`
passes again.

- **Ref bumps:** NAP-IDENTITY, NAP-SHELL, NAP-THEME and NAP-INTENT move to
  master `377bf939` (unchanged documents; NAP-INTENT equals the PR #106 head the
  mock already implemented). NAP-LINK moves to PR #53 `100e5c93`.
- **NAP-LLM (breaking):** follows PR #134 `5e93bdfc`, which absorbed PR #138.
  `LLM_TOOLS_SPEC_REF` is removed. Models carry `toolChoiceModes`; deltas use
  `start`/`delta`/`end` block events with a `toolCall` block kind; results are
  `{ content, finish, usage }` without the old `text` mirror; `samplingParams`,
  `maxTokens: 0`, duplicate or non-portable tool names, choices without tools,
  misplaced tool results and misplaced parts are `invalid-request`; unlisted
  tool-choice modes and tool history on a tools-less connection are
  `unsupported`; scripted turns that break the tool-choice mode or JSON format
  end in `provider-error`. `respondWith` no longer accepts `toolUse`.
  Validators now live in `llm-validate.ts` and are still exported, plus
  `mockToolChoiceMode`.
- **NAP-WEBRTC:** follows PR #59 `fb4dd6f0`. Adds `webrtc.sendBytes` and `bytes`
  events (canonical base64), reports `ordered`/`maxRetransmits`/`maxPayloadBytes`,
  pairs only sessions with matching delivery semantics, counts payload limits in
  bytes, and adds `peerBytes` and `mockCanonicalBase64Length`.
- **NAP-MESH (breaking):** removed. PR #122 was retracted in favour of
  NAP-NEIGHBOR (PR #146), which is a different contract.
- **Audit:** `scripts/deferred-naps.json` pins new drafts without Kehto support
  (NAP-WEBMCP #150, NAP-NEIGHBOR #146, NAP-EMAIL #139) to their head; they are
  reported as `deferred` and do not fail `--strict` until the head moves or the
  PR closes.

**Migration** (`KEHTO_MOCKS_NAP_DRIFT_RETIRED` in `docs/compatibility.md`):
replace `LLM_TOOLS_SPEC_REF` with `LLM_SPEC_REF`; read LLM output from
`result.content` instead of `result.text`; match delta `block: 'toolCall'` and
the `start`/`delta`/`end` events; script only `stop`/`length`/`refusal` with
`respondWith`; drop any use of the NAP-MESH mock (no replacement yet).
