import { ImocModelSummary, ImocTicket } from '../domain/entity/imoc.entity';
/** Maps a vendor response into the allow-listed ticket projection. */
export declare const normalizeImocTicket: (value: unknown) => ImocTicket;
/** Model detail can be useful context, but field definitions may be sensitive. */
export declare const normalizeImocModel: (value: unknown) => ImocModelSummary;
/**
 * Snapshot capture is intentionally much smaller than the raw ticket detail.
 * This lets audit retain a defensible point-in-time record without persisting
 * arbitrary IMOC form, secret, privacy, or dynamic-reference fields.
 */
export declare const buildSafeImocSnapshot: (ticket: ImocTicket) => Record<string, unknown>;
export declare const hashSnapshot: (snapshot: Record<string, unknown>) => string;
//# sourceMappingURL=imoc.utility.d.ts.map