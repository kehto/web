/**
 * intent-types.ts — NAP-INTENT (archetype intent dispatch) value types.
 *
 * Kehto-internal model for the NAP-INTENT wire contract (upstream draft:
 * napplet/naps NAP-INTENT, namespace `window.napplet.intent`). The installed
 * `@napplet/core` peer predates these types, so — as with {@link ./cvm-types} —
 * kehto defines them here, wire-compatible with the upstream shapes, rather
 * than redefining the generic NIP-5D envelope.
 *
 * NAP-INTENT standardizes the *envelope*, not the payload. `archetype` is the
 * routing axis (which role, whose default), `protocol` is the parsing axis
 * (which NAP-N wire format shapes `payload`); the two are orthogonal.
 *
 * @packageDocumentation
 */

/**
 * How the shell should pick the handling napplet for an intent.
 *
 * - `"default"` — route to the user's default handler for the archetype.
 * - `"choose"`  — prompt the user with an "open with…" chooser.
 * - any other string — a specific napplet dTag (cross-napplet targeting; the
 *   shell SHOULD require the user to have authorized this for the caller).
 */
export type IntentHandlerPreference = 'default' | 'choose' | (string & {});

/** Window-behavior hints carried with an intent invoke. */
export interface IntentBehavior {
  /** Bring the handler window to the foreground. */
  focus?: boolean;
  /** Force a new window rather than reusing an existing handler instance. */
  newWindow?: boolean;
  /** Prefer reusing an already-open handler instance when one exists. */
  reuse?: boolean;
}

/** A request to dispatch an action to a napplet of a given archetype. */
export interface IntentRequest {
  /** Role slug, e.g. `"note"` (see the archetype registry). */
  archetype: string;
  /** Verb, default `"open"` (e.g. `"open"` | `"edit"` | `"pick"` | `"share"`). */
  action?: string;
  /** NAP-N id shaping `payload`; omit to use the archetype's recommended default. */
  protocol?: string;
  /** Opaque payload, typed by `protocol`. */
  payload?: unknown;
  /** Handler-selection preference. */
  handler?: IntentHandlerPreference;
  /** Window-behavior hints. */
  behavior?: IntentBehavior;
}

/** A napplet that can fulfill an archetype, sourced from the manifest catalog. */
export interface IntentCandidate {
  /** dTag of the napplet that can fulfill the archetype. */
  dTag: string;
  /** Human-readable title from the manifest. */
  title?: string;
  /** Verbs this candidate supports for the archetype. */
  actions: string[];
  /** NAP-N ids this candidate accepts for the archetype. */
  protocols: string[];
  /** Whether this candidate is the user/runtime default for the archetype. */
  isDefault?: boolean;
}

/** Availability of an archetype, sourced from the installed-napplet catalog. */
export interface IntentAvailability {
  /** The archetype this availability describes. */
  archetype: string;
  /** True when at least one installed napplet fulfills the archetype. */
  available: boolean;
  /** Candidate napplets that fulfill the archetype (from manifests, not instances). */
  candidates: IntentCandidate[];
  /** True when a user/runtime default handler is set for the archetype. */
  hasDefault: boolean;
}

/** The result of an intent invocation. */
export interface IntentResult {
  /** Whether the intent was dispatched successfully. */
  ok: boolean;
  /** The requested archetype, echoed back. */
  archetype: string;
  /** The resolved action (defaults to `"open"` when the request omits it). */
  action: string;
  /** True when a handler accepted the dispatch. */
  handled: boolean;
  /** dTag of the napplet that handled the intent, when one did. */
  handler?: string;
  /** Window id the handler was created or focused in. */
  windowId?: string;
  /** The wire format actually used to deliver `payload`. */
  protocol?: string;
  /** Error reason when the intent could not be fulfilled. */
  error?: string;
}
