"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.backupLogAnalyzer = void 0;
const zod_1 = require("zod");
const system_audit_enum_1 = require("../../domain/enum/system-audit.enum");
const system_audit_utility_1 = require("../system-audit.utility");
const ParametersSchema = zod_1.z.object({
    /** Longest acceptable time between two successful backups of one system. */
    maxHoursBetweenBackups: zod_1.z.number().min(1).max(24 * 60).default(26),
    /** Each system needs a successful restore test at least this recently. */
    restoreTestMaxAgeDays: zod_1.z.number().int().min(1).max(3650).default(95),
    requireRestoreTests: zod_1.z.boolean().default(true),
    /** Default recovery-time objective when a restore row carries no target. Null disables RTO checks. */
    rtoMinutes: zod_1.z.number().min(1).max(100_000).nullable().default(null),
});
const outcomeOf = (status) => {
    if (/warn|partial|with error|completed with/i.test(status))
        return 'warning';
    if (/fail|error|abort|miss|cancel|time ?d? ?out|not run|not complete|incomplete|skipp|unsuccess/i.test(status))
        return 'failed';
    if (/success|succeed|complete|^ok$|pass|done/i.test(status))
        return 'success';
    return 'unknown';
};
const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
const date = (v) => (v instanceof Date ? v : null);
const MAX_LISTED = 20;
const analyse = (records, params) => {
    const jobs = [];
    let unreadable = 0;
    for (const r of records) {
        const start = date(r.values.start_time);
        const system = text(r.values.system);
        if (!start || !system) {
            unreadable += 1;
            continue;
        }
        const type = text(r.values.record_type) ?? '';
        jobs.push({
            row: r.rowNumber,
            system,
            job: text(r.values.job_name) ?? system,
            start,
            end: date(r.values.end_time),
            outcome: outcomeOf(text(r.values.status) ?? ''),
            isRestore: /restor|recover|dr test|failover|drill/i.test(type),
            targetMinutes: typeof r.values.target_minutes === 'number' ? r.values.target_minutes : params.rtoMinutes,
        });
    }
    const exceptions = [];
    // The log's own end is "now" — exports usually cover a closed period.
    const asOf = jobs.reduce((latest, j) => {
        const t = j.end ?? j.start;
        return !latest || t > latest ? t : latest;
    }, null);
    const bySystem = new Map();
    for (const j of jobs)
        bySystem.set(j.system, [...(bySystem.get(j.system) ?? []), j]);
    let backups = 0;
    let successes = 0;
    let failures = 0;
    let restoreTests = 0;
    let restoreFailures = 0;
    let systemsAtRisk = 0;
    for (const [system, list] of bySystem) {
        const backupJobs = list.filter((j) => !j.isRestore).sort((a, b) => a.start.getTime() - b.start.getTime());
        const restoreJobs = list.filter((j) => j.isRestore).sort((a, b) => a.start.getTime() - b.start.getTime());
        backups += backupJobs.length;
        restoreTests += restoreJobs.length;
        let atRisk = false;
        const failed = backupJobs.filter((j) => j.outcome === 'failed');
        const warned = backupJobs.filter((j) => j.outcome === 'warning');
        const ok = backupJobs.filter((j) => j.outcome === 'success' || j.outcome === 'warning');
        successes += backupJobs.filter((j) => j.outcome === 'success').length;
        failures += failed.length;
        if (failed.length > 0) {
            exceptions.push({
                ruleCode: 'BACKUP_FAILED',
                severity: system_audit_enum_1.ExceptionSeverity.High,
                title: `${failed.length} failed backup job(s) for ${system}`,
                recordRef: system,
                details: {
                    failures: failed.length,
                    jobs: Array.from(new Set(failed.map((j) => j.job))),
                    dates: failed.slice(-MAX_LISTED).map((j) => j.start.toISOString()),
                    rows: failed.slice(-MAX_LISTED).map((j) => j.row),
                },
            });
        }
        if (warned.length > 0) {
            exceptions.push({
                ruleCode: 'BACKUP_WARNING',
                severity: system_audit_enum_1.ExceptionSeverity.Low,
                title: `${warned.length} backup job(s) for ${system} completed with warnings`,
                recordRef: system,
                details: { dates: warned.slice(-MAX_LISTED).map((j) => j.start.toISOString()) },
            });
        }
        if (backupJobs.length > 0 && ok.length === 0) {
            atRisk = true;
            exceptions.push({
                ruleCode: 'NO_SUCCESSFUL_BACKUP',
                severity: system_audit_enum_1.ExceptionSeverity.Critical,
                title: `${system} has no successful backup in the period analysed`,
                recordRef: system,
                details: { attempts: backupJobs.length },
            });
        }
        if (ok.length > 0) {
            const gaps = [];
            for (let i = 1; i < ok.length; i += 1) {
                const hours = (0, system_audit_utility_1.hoursBetween)(ok[i - 1].start, ok[i].start);
                if (hours > params.maxHoursBetweenBackups) {
                    gaps.push({ from: ok[i - 1].start.toISOString(), to: ok[i].start.toISOString(), hours: (0, system_audit_utility_1.round)(hours) });
                }
            }
            if (gaps.length > 0) {
                atRisk = true;
                const worst = gaps.reduce((a, b) => (b.hours > a.hours ? b : a));
                exceptions.push({
                    ruleCode: 'BACKUP_GAP',
                    severity: system_audit_enum_1.ExceptionSeverity.High,
                    title: `${system} went up to ${worst.hours} hours without a successful backup (${gaps.length} gap(s))`,
                    recordRef: system,
                    details: { thresholdHours: params.maxHoursBetweenBackups, gaps: gaps.slice(0, MAX_LISTED) },
                });
            }
            const last = ok[ok.length - 1].start;
            if (asOf && (0, system_audit_utility_1.hoursBetween)(last, asOf) > params.maxHoursBetweenBackups) {
                atRisk = true;
                exceptions.push({
                    ruleCode: 'BACKUP_STALE',
                    severity: system_audit_enum_1.ExceptionSeverity.Critical,
                    title: `${system}'s last successful backup was ${(0, system_audit_utility_1.round)((0, system_audit_utility_1.hoursBetween)(last, asOf))} hours before the end of the log`,
                    recordRef: system,
                    details: { lastSuccessfulBackup: last.toISOString(), logEndsAt: asOf.toISOString() },
                });
            }
        }
        for (const test of restoreJobs.filter((j) => j.outcome === 'failed')) {
            restoreFailures += 1;
            exceptions.push({
                ruleCode: 'RESTORE_TEST_FAILED',
                severity: system_audit_enum_1.ExceptionSeverity.High,
                title: `Restore test of ${system} on ${test.start.toISOString().slice(0, 10)} failed`,
                recordRef: system,
                details: { job: test.job, row: test.row },
            });
        }
        for (const test of restoreJobs.filter((j) => j.outcome !== 'failed' && j.end && j.targetMinutes)) {
            const minutes = (0, system_audit_utility_1.hoursBetween)(test.start, test.end) * 60;
            if (minutes > test.targetMinutes) {
                exceptions.push({
                    ruleCode: 'RTO_EXCEEDED',
                    severity: system_audit_enum_1.ExceptionSeverity.Medium,
                    title: `Restore of ${system} took ${Math.round(minutes)} minutes against a ${test.targetMinutes}-minute recovery objective`,
                    recordRef: system,
                    details: { job: test.job, row: test.row, actualMinutes: Math.round(minutes), targetMinutes: test.targetMinutes },
                });
            }
        }
        if (params.requireRestoreTests && backupJobs.length > 0 && asOf) {
            const passed = restoreJobs.filter((j) => j.outcome === 'success' || j.outcome === 'warning');
            const lastPassed = passed.length ? passed[passed.length - 1].start : null;
            if (!lastPassed || (0, system_audit_utility_1.daysBetween)(lastPassed, asOf) > params.restoreTestMaxAgeDays) {
                exceptions.push({
                    ruleCode: 'RESTORE_TEST_OVERDUE',
                    severity: system_audit_enum_1.ExceptionSeverity.Medium,
                    title: lastPassed
                        ? `${system}'s last successful restore test was ${Math.floor((0, system_audit_utility_1.daysBetween)(lastPassed, asOf))} days ago`
                        : `No successful restore test recorded for ${system}`,
                    recordRef: system,
                    details: { lastSuccessfulRestoreTest: lastPassed?.toISOString() ?? null, maxAgeDays: params.restoreTestMaxAgeDays },
                });
            }
        }
        if (atRisk)
            systemsAtRisk += 1;
    }
    return {
        summary: {
            systems: bySystem.size,
            backupJobs: backups,
            successfulBackups: successes,
            failedBackups: failures,
            successRate: backups ? (0, system_audit_utility_1.round)((successes / backups) * 100) : 0,
            systemsAtRisk,
            restoreTests,
            restoreTestFailures: restoreFailures,
            logEndsAt: asOf?.toISOString() ?? null,
            unreadableRows: unreadable,
        },
        exceptions,
    };
};
exports.backupLogAnalyzer = {
    type: system_audit_enum_1.AnalysisType.BackupLog,
    label: 'Backup & recovery verification',
    description: 'Verifies backup status and recovery test results from a backup tool export — failed jobs, gaps, stale backups, and overdue or failed restore tests — without any access to change the backup configuration.',
    controls: ['ISO27001-A.8.13', 'SYS-DR-002', 'ISO27001-A.5.30', 'SOX-ITGC-CO', 'SYS-DR-001'],
    fields: [
        { key: 'system', label: 'System / server', kind: 'text', required: true, synonyms: ['server', 'client', 'host', 'hostname', 'source', 'database', 'asset', 'vm', 'machine', 'protected item', 'object', 'system name'] },
        { key: 'start_time', label: 'Start time', kind: 'date', required: true, synonyms: ['start', 'started', 'date', 'backup date', 'run date', 'start date', 'job start', 'start time'] },
        { key: 'status', label: 'Result', kind: 'text', required: true, synonyms: ['result', 'outcome', 'state', 'job status', 'job result'] },
        { key: 'job_name', label: 'Job name', kind: 'text', required: false, synonyms: ['job', 'backup job', 'policy', 'policy name', 'task', 'schedule'] },
        { key: 'end_time', label: 'End time', kind: 'date', required: false, synonyms: ['end', 'finished', 'completed', 'end date', 'job end', 'completion time', 'stop time'] },
        { key: 'record_type', label: 'Job type (backup / restore test)', kind: 'text', required: false, synonyms: ['type', 'job type', 'operation', 'activity'] },
        { key: 'size', label: 'Size', kind: 'number', required: false, synonyms: ['bytes', 'data size', 'backup size', 'size gb', 'transferred'] },
        { key: 'target_minutes', label: 'Recovery objective (minutes)', kind: 'number', required: false, synonyms: ['rto', 'rto minutes', 'target rto', 'target minutes', 'rto (minutes)'] },
    ],
    parametersSchema: ParametersSchema,
    rules: [
        { code: 'BACKUP_FAILED', label: 'Failed backup jobs', severity: system_audit_enum_1.ExceptionSeverity.High },
        { code: 'BACKUP_WARNING', label: 'Backups completed with warnings', severity: system_audit_enum_1.ExceptionSeverity.Low },
        { code: 'NO_SUCCESSFUL_BACKUP', label: 'No successful backup in period', severity: system_audit_enum_1.ExceptionSeverity.Critical },
        { code: 'BACKUP_GAP', label: 'Gap between successful backups', severity: system_audit_enum_1.ExceptionSeverity.High },
        { code: 'BACKUP_STALE', label: 'Latest successful backup too old', severity: system_audit_enum_1.ExceptionSeverity.Critical },
        { code: 'RESTORE_TEST_FAILED', label: 'Restore test failed', severity: system_audit_enum_1.ExceptionSeverity.High },
        { code: 'RTO_EXCEEDED', label: 'Recovery objective exceeded', severity: system_audit_enum_1.ExceptionSeverity.Medium },
        { code: 'RESTORE_TEST_OVERDUE', label: 'Restore test overdue or missing', severity: system_audit_enum_1.ExceptionSeverity.Medium },
    ],
    analyse: (records, params, _context) => analyse(records, params),
};
//# sourceMappingURL=backup-log.analyzer.js.map