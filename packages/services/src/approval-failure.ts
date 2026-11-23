/**
 * approval-failure.ts — wire reason for an approval outcome that did not execute.
 *
 * Only `denied` is a policy decision. `capacity` (grant table full), `busy`
 * (rate limit or pending queue full) and `unavailable` (no prompt UI or storage
 * failure) are host conditions and never surface as a denial (kehto/web#513).
 * `cancelled` keeps the domain's denial projection unless its NAP names a
 * cancellation code, because the coordinator also reports revocation that way.
 * Where a NAP has no fitting code, the bounded strings below are used and the
 * caller records the spec gap.
 */

import type { ApprovalFailure } from '@kehto/runtime';

/** The Firewall grant table is full (`maxGrants`). */
export const APPROVAL_CAPACITY = 'approval capacity reached';
/** The approval queue or a rate limit refused the request. */
export const APPROVAL_BUSY = 'approval busy';
/** No prompt UI, or the approval could not be recorded. */
export const APPROVAL_UNAVAILABLE = 'approval unavailable';

/** Per-domain wire strings; `denied` is required, the rest default as above. */
export interface ApprovalFailureCodes {
  readonly denied: string;
  readonly cancelled?: string;
  readonly capacity?: string;
  readonly busy?: string;
  readonly unavailable?: string;
}

/** Default non-denial strings, keyed by status. */
const HOST_REASONS = { capacity: APPROVAL_CAPACITY, busy: APPROVAL_BUSY, unavailable: APPROVAL_UNAVAILABLE } as const;

/**
 * Pick the wire reason for a non-executed approval outcome.
 *
 * @param status - The approval outcome status.
 * @param codes - The domain's denial string and any NAP-specific overrides.
 * @returns The domain's string for `status`.
 * @example
 * approvalFailure('capacity', { denied: 'policy denied' }); // 'approval capacity reached'
 */
export function approvalFailure(status: ApprovalFailure | string, codes: ApprovalFailureCodes): string {
  if (status === 'capacity' || status === 'busy' || status === 'unavailable') return codes[status] ?? HOST_REASONS[status];
  if (status === 'cancelled') return codes.cancelled ?? codes.denied;
  return codes.denied;
}

/**
 * Whether a non-executed status is a real policy outcome.
 *
 * @param status - The approval outcome status.
 * @returns `true` for `denied` and `cancelled`, which domains project as denials.
 * @example
 * isApprovalDenial('busy'); // false
 */
export function isApprovalDenial(status: ApprovalFailure | string): boolean {
  return status !== 'capacity' && status !== 'busy' && status !== 'unavailable';
}
