"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mapTimeEntryToResponse = exports.timeEntryInclude = void 0;
exports.timeEntryInclude = {
    user: { select: { id: true, display_name: true, first_name: true, last_name: true } },
};
const userName = (user) => user.display_name || `${user.first_name} ${user.last_name}`.trim();
const mapTimeEntryToResponse = (entry) => ({
    id: entry.id,
    engagementId: entry.engagement_id,
    userId: entry.user_id,
    userName: userName(entry.user),
    entryDate: entry.entry_date.toISOString(),
    hours: Number(entry.hours),
    description: entry.description,
    createdAt: entry.created_at.toISOString(),
});
exports.mapTimeEntryToResponse = mapTimeEntryToResponse;
//# sourceMappingURL=time-entry.response.dto.js.map