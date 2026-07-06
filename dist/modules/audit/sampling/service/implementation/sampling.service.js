"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.SamplingService = void 0;
const XLSX = __importStar(require("xlsx"));
const app_error_1 = require("../../../../../shared/errors/app.error");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const audit_log_service_1 = require("../../../../logging/service/implementation/audit-log.service");
const sampler_utility_1 = require("../../utility/sampler.utility");
const MAX_POPULATION_ROWS = 50_000;
const METHODOLOGY_TABLE_CAP = 50;
const PREVIEW_ROWS = 20;
const PREVIEW_COLUMNS = 6;
const METHOD_LABEL = {
    random: 'Simple random',
    interval: 'Systematic interval',
    high_value: 'High value',
};
/**
 * Audit sampling: parses an uploaded population CSV, draws a reproducible
 * sample (recorded seed), stores BOTH files as engagement evidence, and
 * produces a methodology write-up ready to paste into a working paper.
 * The evidence trail (population + sample + seed) is what makes the selection
 * defensible when a reviewer or regulator asks "how did you pick these?".
 */
class SamplingService {
    evidenceService;
    constructor(evidenceService) {
        this.evidenceService = evidenceService;
    }
    async runSampling(engagementId, file, dto, actor) {
        const rows = this._parsePopulation(file.buffer);
        const seed = dto.seed ?? Math.floor(Date.now() % 2_147_483_647);
        let draw;
        try {
            draw = (0, sampler_utility_1.drawSample)(rows, {
                method: dto.method,
                sampleSize: dto.sampleSize,
                seed,
                valueColumn: dto.valueColumn,
                threshold: dto.threshold,
            });
        }
        catch (err) {
            throw app_error_1.AppError.badRequest(err instanceof Error ? err.message : 'Sampling failed');
        }
        // Store population + sample as evidence — the reproducibility trail.
        const sampleCsv = Buffer.from(XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(draw.selected)), 'utf8');
        const baseName = file.originalName.replace(/\.csv$/i, '');
        // Evidence identity is its file name — encode the sampling context there.
        const populationEvidence = await this.evidenceService.uploadEvidence(engagementId, {
            originalName: `${baseName}-population-${rows.length}rows.csv`,
            mimeType: 'text/csv',
            fileSize: file.fileSize,
            buffer: file.buffer,
        }, actor);
        const sampleEvidence = await this.evidenceService.uploadEvidence(engagementId, {
            originalName: `${baseName}-sample-${dto.method}-n${draw.selected.length}-seed${seed}.csv`,
            mimeType: 'text/csv',
            fileSize: sampleCsv.length,
            buffer: sampleCsv,
        }, actor);
        const methodologyMarkdown = this._buildMethodology(file.originalName, rows, draw, dto, seed);
        logger_util_1.logger.info('Audit sample drawn', {
            engagementId,
            method: dto.method,
            populationCount: rows.length,
            sampleCount: draw.selected.length,
            seed,
            actorId: actor.id,
        });
        audit_log_service_1.auditLogService.logAsync({
            userId: actor.id,
            action: 'audit.sampling.run',
            module: 'audit',
            entityType: 'audit_engagement',
            entityId: engagementId,
            newValues: {
                method: dto.method,
                populationCount: rows.length,
                sampleCount: draw.selected.length,
                seed,
                populationEvidenceId: populationEvidence.id,
                sampleEvidenceId: sampleEvidence.id,
            },
        });
        const columns = Object.keys(rows[0] ?? {}).slice(0, PREVIEW_COLUMNS);
        return {
            populationEvidenceId: populationEvidence.id,
            sampleEvidenceId: sampleEvidence.id,
            populationCount: rows.length,
            sampleCount: draw.selected.length,
            method: dto.method,
            seed,
            methodologyMarkdown,
            previewRows: draw.selected.slice(0, PREVIEW_ROWS).map((row) => Object.fromEntries(columns.map((c) => [c, row[c]]))),
            previewColumns: columns,
        };
    }
    _parsePopulation(buffer) {
        let rows;
        try {
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            rows = XLSX.utils.sheet_to_json(sheet, { defval: '' });
        }
        catch {
            throw app_error_1.AppError.badRequest('Could not parse the population file — upload a valid CSV');
        }
        if (rows.length === 0)
            throw app_error_1.AppError.badRequest('The population file has no data rows');
        if (rows.length > MAX_POPULATION_ROWS) {
            throw app_error_1.AppError.badRequest(`Population too large (${rows.length} rows; max ${MAX_POPULATION_ROWS})`);
        }
        return rows;
    }
    _buildMethodology(fileName, rows, draw, dto, seed) {
        const columns = Object.keys(rows[0] ?? {}).slice(0, 5);
        const capped = draw.selected.slice(0, METHODOLOGY_TABLE_CAP);
        const header = `| Row # | ${columns.join(' | ')} |`;
        const divider = `| --- | ${columns.map(() => '---').join(' | ')} |`;
        const body = capped
            .map((row, i) => `| ${draw.rowNumbers[i]} | ${columns.map((c) => String(row[c] ?? '')).join(' | ')} |`)
            .join('\n');
        const truncation = draw.selected.length > METHODOLOGY_TABLE_CAP
            ? `\n\n*Table truncated to the first ${METHODOLOGY_TABLE_CAP} of ${draw.selected.length} selected items — the full sample is attached as evidence.*`
            : '';
        return [
            '## Sampling Methodology',
            '',
            '| Item | Value |',
            '| --- | --- |',
            `| Population file | ${fileName} (${rows.length} rows) |`,
            `| Method | ${METHOD_LABEL[dto.method]} |`,
            `| Sample size | ${draw.selected.length} |`,
            `| Seed | ${seed} |`,
            ...(dto.valueColumn ? [`| Value column | ${dto.valueColumn} |`] : []),
            ...(dto.threshold !== undefined ? [`| Threshold | ${dto.threshold} |`] : []),
            `| Selected on | ${new Date().toISOString().slice(0, 10)} |`,
            '',
            draw.methodDescription,
            'The population file and the drawn sample are both attached as engagement evidence; re-running the same method with the same seed reproduces this exact selection.',
            '',
            '### Selected items',
            '',
            header,
            divider,
            body + truncation,
        ].join('\n');
    }
}
exports.SamplingService = SamplingService;
//# sourceMappingURL=sampling.service.js.map