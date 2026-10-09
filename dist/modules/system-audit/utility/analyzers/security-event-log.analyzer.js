"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.securityEventLogAnalyzer = void 0;
const zod_1 = require("zod");
const system_audit_enum_1 = require("../../domain/enum/system-audit.enum");
const system_audit_utility_1 = require("../system-audit.utility");
const ParametersSchema = zod_1.z.object({
    bruteForceThreshold: zod_1.z.number().int().min(2).max(1000).default(5),
    bruteForceWindowMinutes: zod_1.z.number().int().min(1).max(1440).default(10),
    /** One source address failing against this many different accounts = password spraying. */
    sprayDistinctAccounts: zod_1.z.number().int().min(2).max(1000).default(5),
    businessHours: zod_1.z
        .object({
        startHour: zod_1.z.number().int().min(0).max(23).default(7),
        endHour: zod_1.z.number().int().min(1).max(24).default(19),
        weekdaysOnly: zod_1.z.boolean().default(true),
    })
        .default({}),
    privilegedEventPatterns: zod_1.z
        .array(zod_1.z.string().trim().min(1))
        .max(100)
        .default([
        '*admin*', '*privilege*', '*role*', '*group member*', '*permission*', '*policy change*', '*sudo*',
        '*user created*', '*account created*', '*account was created*', '*password reset*',
        '4720*', '4722*', '4724*', '4728*', '4732*', '4756*', '4672*',
    ]),
    logClearedPatterns: zod_1.z
        .array(zod_1.z.string().trim().min(1))
        .max(50)
        .default(['1102*', '104', '*log*cleared*', '*cleared*log*', '*clear*log*', '*logs deleted*', '*audit log*deleted*']),
});
const FAILURE_OUTCOME = /fail|denied|invalid|error|reject|unsuccess|^false$|^0$/i;
const FAILURE_EVENT = /fail|4625|4771|4776|denied|bad password|invalid password|wrong password/i;
const LOCKOUT_EVENT = /lockout|locked out|4740/i;
const HIGH_SEVERITY = /crit|emerg|alert|high|sev(erity)? ?[12]\b|^[12]$/i;
const MAX_LISTED = 20;
const text = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null);
/** Sliding-window bursts: groups of ≥ threshold events within the window, non-overlapping. */
const findBursts = (events, threshold, windowMs) => {
    const sorted = [...events].sort((a, b) => a.at.getTime() - b.at.getTime());
    const bursts = [];
    let start = 0;
    for (let end = 0; end < sorted.length; end += 1) {
        while (sorted[end].at.getTime() - sorted[start].at.getTime() > windowMs)
            start += 1;
        if (end - start + 1 >= threshold) {
            // Extend to everything inside this window, then continue after it.
            let last = end;
            while (last + 1 < sorted.length && sorted[last + 1].at.getTime() - sorted[start].at.getTime() <= windowMs)
                last += 1;
            bursts.push(sorted.slice(start, last + 1));
            start = last + 1;
            end = last;
        }
    }
    return bursts;
};
const isBusinessHours = (at, hours) => {
    const day = at.getDay();
    if (hours.weekdaysOnly && (day === 0 || day === 6))
        return false;
    const h = at.getHours();
    return h >= hours.startHour && h < hours.endHour;
};
const group = (items, key) => {
    const map = new Map();
    for (const item of items) {
        const k = key(item);
        if (k)
            map.set(k, [...(map.get(k) ?? []), item]);
    }
    return map;
};
const analyse = (records, params, _context) => {
    const events = [];
    let unreadable = 0;
    for (const r of records) {
        const at = r.values.timestamp instanceof Date ? r.values.timestamp : null;
        const type = text(r.values.event_type);
        if (!at || !type) {
            unreadable += 1;
            continue;
        }
        const outcome = text(r.values.outcome) ?? '';
        events.push({
            row: r.rowNumber,
            at,
            type,
            user: text(r.values.user)?.toLowerCase() ?? null,
            ip: text(r.values.source_ip),
            failed: FAILURE_OUTCOME.test(outcome) || FAILURE_EVENT.test(type),
            severity: text(r.values.severity),
            host: text(r.values.host),
        });
    }
    const exceptions = [];
    const windowMs = params.bruteForceWindowMinutes * 60_000;
    const failures = events.filter((e) => e.failed);
    let bruteForce = 0;
    for (const [user, list] of group(failures, (e) => e.user)) {
        for (const burst of findBursts(list, params.bruteForceThreshold, windowMs)) {
            bruteForce += 1;
            const ips = Array.from(new Set(burst.map((e) => e.ip).filter(Boolean)));
            exceptions.push({
                ruleCode: 'BRUTE_FORCE',
                severity: system_audit_enum_1.ExceptionSeverity.High,
                title: `${burst.length} failed sign-ins for ${user} within ${params.bruteForceWindowMinutes} minutes`,
                recordRef: user,
                details: { from: burst[0].at.toISOString(), to: burst[burst.length - 1].at.toISOString(), attempts: burst.length, sourceIps: ips, rows: burst.slice(0, MAX_LISTED).map((e) => e.row) },
            });
        }
    }
    let spray = 0;
    for (const [ip, list] of group(failures, (e) => e.ip)) {
        const sorted = [...list].sort((a, b) => a.at.getTime() - b.at.getTime());
        let start = 0;
        for (let end = 0; end < sorted.length; end += 1) {
            while (sorted[end].at.getTime() - sorted[start].at.getTime() > windowMs)
                start += 1;
            const accounts = new Set(sorted.slice(start, end + 1).map((e) => e.user).filter(Boolean));
            if (accounts.size >= params.sprayDistinctAccounts) {
                spray += 1;
                exceptions.push({
                    ruleCode: 'PASSWORD_SPRAY',
                    severity: system_audit_enum_1.ExceptionSeverity.High,
                    title: `${ip} failed to sign in to ${accounts.size} different accounts within ${params.bruteForceWindowMinutes} minutes`,
                    recordRef: ip,
                    details: { from: sorted[start].at.toISOString(), to: sorted[end].at.toISOString(), accounts: Array.from(accounts).slice(0, MAX_LISTED) },
                });
                start = end + 1;
            }
        }
    }
    const offHours = events.filter((e) => !e.failed && (0, system_audit_utility_1.matchesAny)(e.type, params.privilegedEventPatterns) && !isBusinessHours(e.at, params.businessHours));
    for (const [key, list] of group(offHours, (e) => `${e.user ?? 'unknown account'}|${e.at.toISOString().slice(0, 10)}`)) {
        const [user, day] = key.split('|');
        exceptions.push({
            ruleCode: 'OFF_HOURS_PRIVILEGED',
            severity: system_audit_enum_1.ExceptionSeverity.Medium,
            title: `${user} performed ${list.length} privileged action(s) outside business hours on ${day}`,
            recordRef: user,
            details: { events: list.slice(0, MAX_LISTED).map((e) => ({ at: e.at.toISOString(), event: e.type, host: e.host })) },
        });
    }
    const cleared = events.filter((e) => (0, system_audit_utility_1.matchesAny)(e.type, params.logClearedPatterns));
    for (const e of cleared) {
        exceptions.push({
            ruleCode: 'AUDIT_LOG_CLEARED',
            severity: system_audit_enum_1.ExceptionSeverity.Critical,
            title: `Audit log was cleared${e.user ? ` by ${e.user}` : ''} at ${e.at.toISOString()}`,
            recordRef: e.user ?? `row ${e.row}`,
            details: { event: e.type, row: e.row },
        });
    }
    let alerts = 0;
    const severe = events.filter((e) => e.severity && HIGH_SEVERITY.test(e.severity));
    for (const [type, list] of group(severe, (e) => e.type)) {
        alerts += list.length;
        const critical = list.some((e) => /crit|emerg|sev(erity)? ?1\b|^1$/i.test(e.severity ?? ''));
        exceptions.push({
            ruleCode: 'HIGH_SEVERITY_ALERT',
            severity: critical ? system_audit_enum_1.ExceptionSeverity.Critical : system_audit_enum_1.ExceptionSeverity.High,
            title: `${list.length} high-severity alert(s): ${type}`,
            recordRef: type,
            details: { first: list[0].at.toISOString(), last: list[list.length - 1].at.toISOString(), rows: list.slice(0, MAX_LISTED).map((e) => e.row) },
        });
    }
    const lockouts = events.filter((e) => LOCKOUT_EVENT.test(e.type));
    for (const [user, list] of group(lockouts, (e) => e.user)) {
        exceptions.push({
            ruleCode: 'ACCOUNT_LOCKOUT',
            severity: system_audit_enum_1.ExceptionSeverity.Low,
            title: `${user} was locked out ${list.length} time(s)`,
            recordRef: user,
            details: { dates: list.slice(0, MAX_LISTED).map((e) => e.at.toISOString()) },
        });
    }
    const first = events.reduce((min, e) => (!min || e.at < min ? e.at : min), null);
    const last = events.reduce((max, e) => (!max || e.at > max ? e.at : max), null);
    return {
        summary: {
            events: events.length,
            failedEvents: failures.length,
            distinctAccounts: new Set(events.map((e) => e.user).filter(Boolean)).size,
            bruteForceBursts: bruteForce,
            passwordSprayBursts: spray,
            offHoursPrivilegedActions: offHours.length,
            auditLogCleared: cleared.length,
            highSeverityAlerts: alerts,
            lockouts: lockouts.length,
            periodStart: first?.toISOString() ?? null,
            periodEnd: last?.toISOString() ?? null,
            unreadableRows: unreadable,
        },
        exceptions,
    };
};
exports.securityEventLogAnalyzer = {
    type: system_audit_enum_1.AnalysisType.SecurityEventLog,
    label: 'Security log anomaly analysis',
    description: 'Analyses security event logs (SIEM, Active Directory, firewall, application) for anomalies: brute-force and password-spray attempts, privileged activity out of hours, cleared audit logs, and high-severity alerts.',
    controls: ['ISO27001-A.8.15', 'ISO27001-A.8.16', 'NIST-CSF-DE.CM', 'PCIDSS-10.2', 'ISO27001-A.8.2'],
    fields: [
        { key: 'timestamp', label: 'Event time', kind: 'date', required: true, synonyms: ['time', 'date', 'event time', 'datetime', 'date time', 'timecreated', 'time generated', 'created', 'logged at', '@timestamp', 'timestamp'] },
        { key: 'event_type', label: 'Event', kind: 'text', required: true, synonyms: ['event', 'event type', 'action', 'activity', 'event id', 'eventid', 'message', 'event name', 'operation', 'description'] },
        { key: 'user', label: 'Account', kind: 'text', required: false, synonyms: ['username', 'account', 'account name', 'subject', 'actor', 'targetusername', 'user name', 'principal', 'user'] },
        { key: 'outcome', label: 'Outcome', kind: 'text', required: false, synonyms: ['result', 'status', 'success', 'audit result', 'keywords'] },
        { key: 'source_ip', label: 'Source IP', kind: 'text', required: false, synonyms: ['ip', 'source ip', 'client ip', 'src', 'src ip', 'ip address', 'source address', 'ipaddress', 'caller ip'] },
        { key: 'severity', label: 'Severity', kind: 'text', required: false, synonyms: ['level', 'priority', 'alert level', 'risk', 'criticality'] },
        { key: 'host', label: 'Host', kind: 'text', required: false, synonyms: ['computer', 'device', 'destination', 'hostname', 'server', 'workstation'] },
    ],
    parametersSchema: ParametersSchema,
    rules: [
        { code: 'BRUTE_FORCE', label: 'Repeated failed sign-ins for one account', severity: system_audit_enum_1.ExceptionSeverity.High },
        { code: 'PASSWORD_SPRAY', label: 'One address failing across many accounts', severity: system_audit_enum_1.ExceptionSeverity.High },
        { code: 'OFF_HOURS_PRIVILEGED', label: 'Privileged activity outside business hours', severity: system_audit_enum_1.ExceptionSeverity.Medium },
        { code: 'AUDIT_LOG_CLEARED', label: 'Audit log cleared', severity: system_audit_enum_1.ExceptionSeverity.Critical },
        { code: 'HIGH_SEVERITY_ALERT', label: 'High-severity alerts', severity: 'varies' },
        { code: 'ACCOUNT_LOCKOUT', label: 'Account lockouts', severity: system_audit_enum_1.ExceptionSeverity.Low },
    ],
    analyse,
};
//# sourceMappingURL=security-event-log.analyzer.js.map