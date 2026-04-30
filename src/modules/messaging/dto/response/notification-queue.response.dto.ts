export interface NotificationQueueStatsResponseDto {
  pending: number;
  processing: number;
  sent: number;
  failed: number;
  total: number;
}
