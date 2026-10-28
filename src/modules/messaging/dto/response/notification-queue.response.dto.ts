export interface NotificationQueueStatsResponseDto {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  skipped: number;
  total: number;
}
