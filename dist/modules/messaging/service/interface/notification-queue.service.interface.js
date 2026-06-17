"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NOTIFICATION_PRIORITY = void 0;
/**
 * Semantic priority levels. Higher numbers are drained first by the queue
 * processor. Use HIGH for latency-sensitive transactional mail (OTP, password
 * reset) and NORMAL for everything else (reminders, workflow notifications).
 */
exports.NOTIFICATION_PRIORITY = {
    HIGH: 100,
    NORMAL: 0,
};
//# sourceMappingURL=notification-queue.service.interface.js.map