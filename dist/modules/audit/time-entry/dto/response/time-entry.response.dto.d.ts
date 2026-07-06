import { Prisma } from '@prisma/client';
export declare const timeEntryInclude: {
    user: {
        select: {
            id: true;
            display_name: true;
            first_name: true;
            last_name: true;
        };
    };
};
type TimeEntryWithUser = Prisma.Audit_Time_EntryGetPayload<{
    include: typeof timeEntryInclude;
}>;
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
    byUser: Array<{
        userId: string;
        userName: string;
        hours: number;
    }>;
    entries: TimeEntryResponseDto[];
}
export declare const mapTimeEntryToResponse: (entry: TimeEntryWithUser) => TimeEntryResponseDto;
export {};
//# sourceMappingURL=time-entry.response.dto.d.ts.map