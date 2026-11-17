// Turns a resolved approval chain into one plain sentence telling the submitter
// who their item went to, e.g.
//   "Now with Adamu Yusuf (level 1 of 3). Then: Kolawole Moshood → Director General."
//
// Pure and dependency-free (types only) so it is safe to call from anywhere and
// trivial to test. It only DESCRIBES an approval that already exists — it never
// decides who approves anything; that is the backend's job.
import type { ResolvedApprovalChain, ResolvedApprovalLevel } from '@/lib/types/domain';

/** Above this many candidates a name list stops being readable. */
const MAX_NAMED_APPROVERS = 3;

export const describeApprovalLevel = (lvl: ResolvedApprovalLevel): string => {
  if (lvl.resolvedApprover) return lvl.resolvedApprover.displayName;
  const names = lvl.candidates.map((c) => c.displayName);
  if (names.length === 0) return 'no eligible approver yet (ask the system administrator)';
  if (names.length === 1) return names[0];
  if (names.length <= MAX_NAMED_APPROVERS) return names.join(' or ');
  return `any one of ${names.length} approvers`;
};

/** Null when there is nothing useful to say (no chain, or it is already finished). */
export const describeApprovalRoute = (
  chain: ResolvedApprovalChain | null | undefined,
): string | null => {
  if (!chain || !Array.isArray(chain.levels) || chain.levels.length === 0) return null;

  const levels = [...chain.levels].sort((a, b) => a.level - b.level);
  const current = levels.find((l) => l.status === 'pending') ?? levels.find((l) => l.status === 'upcoming');
  if (!current) return null;

  const upcoming = levels.filter((l) => l.level > current.level && l.status !== 'approved' && l.status !== 'rejected');
  const where = levels.length > 1 ? ` (level ${current.level} of ${levels.length})` : '';
  const first = `Now with ${describeApprovalLevel(current)}${where}.`;
  if (upcoming.length === 0) return first;
  return `${first} Then: ${upcoming.map(describeApprovalLevel).join(' → ')}.`;
};
