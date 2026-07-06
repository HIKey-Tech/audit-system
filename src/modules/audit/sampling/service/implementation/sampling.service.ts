import * as XLSX from 'xlsx';
import { AppError } from '../../../../../shared/errors/app.error';
import { logger } from '../../../../../shared/utils/logger.util';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { ActorContext } from '../../../domain/entity/audit.entity';
import { IEvidenceService } from '../../../evidence/service/interface/evidence.service.interface';
import { RunSamplingRequestDto } from '../../dto/request/sampling.request.dto';
import { drawSample, SampleDraw } from '../../utility/sampler.utility';
import {
  ISamplingService,
  SamplingRunFile,
  SamplingRunResultDto,
} from '../interface/sampling.service.interface';

const MAX_POPULATION_ROWS = 50_000;
const METHODOLOGY_TABLE_CAP = 50;
const PREVIEW_ROWS = 20;
const PREVIEW_COLUMNS = 6;

const METHOD_LABEL: Record<string, string> = {
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
export class SamplingService implements ISamplingService {
  constructor(private readonly evidenceService: IEvidenceService) {}

  async runSampling(
    engagementId: string,
    file: SamplingRunFile,
    dto: RunSamplingRequestDto,
    actor: ActorContext,
  ): Promise<SamplingRunResultDto> {
    const rows = this._parsePopulation(file.buffer);
    const seed = dto.seed ?? Math.floor(Date.now() % 2_147_483_647);

    let draw: SampleDraw;
    try {
      draw = drawSample(rows, {
        method: dto.method,
        sampleSize: dto.sampleSize,
        seed,
        valueColumn: dto.valueColumn,
        threshold: dto.threshold,
      });
    } catch (err) {
      throw AppError.badRequest(err instanceof Error ? err.message : 'Sampling failed');
    }

    // Store population + sample as evidence — the reproducibility trail.
    const sampleCsv = Buffer.from(XLSX.utils.sheet_to_csv(XLSX.utils.json_to_sheet(draw.selected)), 'utf8');
    const baseName = file.originalName.replace(/\.csv$/i, '');

    // Evidence identity is its file name — encode the sampling context there.
    const populationEvidence = await this.evidenceService.uploadEvidence(
      engagementId,
      {
        originalName: `${baseName}-population-${rows.length}rows.csv`,
        mimeType: 'text/csv',
        fileSize: file.fileSize,
        buffer: file.buffer,
      },
      actor,
    );
    const sampleEvidence = await this.evidenceService.uploadEvidence(
      engagementId,
      {
        originalName: `${baseName}-sample-${dto.method}-n${draw.selected.length}-seed${seed}.csv`,
        mimeType: 'text/csv',
        fileSize: sampleCsv.length,
        buffer: sampleCsv,
      },
      actor,
    );

    const methodologyMarkdown = this._buildMethodology(file.originalName, rows, draw, dto, seed);

    logger.info('Audit sample drawn', {
      engagementId,
      method: dto.method,
      populationCount: rows.length,
      sampleCount: draw.selected.length,
      seed,
      actorId: actor.id,
    });
    auditLogService.logAsync({
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
      previewRows: draw.selected.slice(0, PREVIEW_ROWS).map((row) =>
        Object.fromEntries(columns.map((c) => [c, row[c]])),
      ),
      previewColumns: columns,
    };
  }

  private _parsePopulation(buffer: Buffer): Record<string, unknown>[] {
    let rows: Record<string, unknown>[];
    try {
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
    } catch {
      throw AppError.badRequest('Could not parse the population file — upload a valid CSV');
    }
    if (rows.length === 0) throw AppError.badRequest('The population file has no data rows');
    if (rows.length > MAX_POPULATION_ROWS) {
      throw AppError.badRequest(`Population too large (${rows.length} rows; max ${MAX_POPULATION_ROWS})`);
    }
    return rows;
  }

  private _buildMethodology(
    fileName: string,
    rows: Record<string, unknown>[],
    draw: SampleDraw,
    dto: RunSamplingRequestDto,
    seed: number,
  ): string {
    const columns = Object.keys(rows[0] ?? {}).slice(0, 5);
    const capped = draw.selected.slice(0, METHODOLOGY_TABLE_CAP);
    const header = `| Row # | ${columns.join(' | ')} |`;
    const divider = `| --- | ${columns.map(() => '---').join(' | ')} |`;
    const body = capped
      .map((row, i) => `| ${draw.rowNumbers[i]} | ${columns.map((c) => String(row[c] ?? '')).join(' | ')} |`)
      .join('\n');
    const truncation =
      draw.selected.length > METHODOLOGY_TABLE_CAP
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
