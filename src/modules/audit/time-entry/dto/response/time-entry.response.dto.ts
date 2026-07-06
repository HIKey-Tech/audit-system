import { Prisma } from '@prisma/client';

export const timeEntryInclude = {
  user: { select: { id: true, display_name: true, first_name: true, last_name: true } },
} satisfies Prisma.Audit_Time_EntryInclude;

type TimeEntryWithUser = Prisma.Audit_Time_EntryGetPayload<{ include: typeof timeEntryInclude }>;

export interface TimeEntryResponseDto {
  id: string;
  engagementId: string;
  userId: string;
  userName: string;
  entryDate: string;
  hours: number;
  description: string | null;
  createdAt: string;
}

export interface EngagementTimeSummaryDto {
  plannedHours: number | null;
  totalHours: number;
  byUser: Array<{ userId: string; userName: string; hours: number }>;
  entries: TimeEntryResponseDto[];
}

const userName = (user: TimeEntryWithUser['user']): string =>
  user.display_name || `${user.first_name} ${user.last_name}`.trim();

export const mapTimeEntryToResponse = (entry: TimeEntryWithUser): TimeEntryResponseDto => ({
  id: entry.id,
  engagementId: entry.engagement_id,
  userId: entry.user_id,
  userName: userName(entry.user),
  entryDate: entry.entry_date.toISOString(),
  hours: Number(entry.hours),
  description: entry.description,
  createdAt: entry.created_at.toISOString(),
});
