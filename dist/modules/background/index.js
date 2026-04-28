"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JOB_KEYS = exports.registerAllJobs = exports.schedulerService = exports.backgroundJobService = exports.BackgroundJobService = exports.createBackgroundModule = void 0;
// src/modules/background/index.ts
const express_1 = require("express");
const job_service_1 = require("./service/implementation/job.service");
const job_controller_1 = require("./controller/job.controller");
const createBackgroundModule = () => {
    const router = (0, express_1.Router)();
    // Controllers
    const jobController = new job_controller_1.BackgroundJobController(job_service_1.backgroundJobService);
    // Mount
    router.use('/jobs', jobController.router);
    return router;
};
exports.createBackgroundModule = createBackgroundModule;
// Re-export for use in other modules
var job_service_2 = require("./service/implementation/job.service");
Object.defineProperty(exports, "BackgroundJobService", { enumerable: true, get: function () { return job_service_2.BackgroundJobService; } });
Object.defineProperty(exports, "backgroundJobService", { enumerable: true, get: function () { return job_service_2.backgroundJobService; } });
var scheduler_service_1 = require("./service/implementation/scheduler.service");
Object.defineProperty(exports, "schedulerService", { enumerable: true, get: function () { return scheduler_service_1.schedulerService; } });
Object.defineProperty(exports, "registerAllJobs", { enumerable: true, get: function () { return scheduler_service_1.registerAllJobs; } });
Object.defineProperty(exports, "JOB_KEYS", { enumerable: true, get: function () { return scheduler_service_1.JOB_KEYS; } });
//# sourceMappingURL=index.js.map