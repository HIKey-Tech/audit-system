import { AccessReviewItemWithRelations } from '../../../../../shared/prisma/prisma.types';
import { UserRef, parseJson, toUserRef } from '../../../utility/system-audit.utility';

export interface AccessReviewItemResponseDto {
  id: string;
  runId: string;
  accountId: string;
  displayName: string | null;
  email: string | null;
  department: string | null;
  accountStatus: string | null;
  isPrivileged: boolean;
  lastLoginAt: string | null;
  entitlements: string[];
  flags: string[];
  decision: string;
  decisionNote: string | null;
  decidedBy: UserRef | null;
  decidedAt: string | null;
}

export const mapAccessItemToResponse = (item: AccessReviewItemWithRelations): AccessReviewItemResponseDto => ({
  id: item.id,
  runId: item.run_id,
  accountId: item.account_id,
  displayName: item.display_name,
  email: item.email,
  department: item.department,
  accountStatus: item.account_status,
  isPrivileged: item.is_privileged,
  lastLoginAt: item.last_login_at?.toISOString() ?? null,
  entitlements: parseJson<string[]>(item.entitlements, []),
  flags: parseJson<string[]>(item.flags, []),
  decision: item.decision,
  decisionNote: item.decision_note,
  decidedBy: toUserRef(item.decided_by),
  decidedAt: item.decided_at?.toISOString() ?? null,
});
