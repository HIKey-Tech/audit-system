import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { PDFParse } from 'pdf-parse';

export interface ExtractedDocumentControl {
  controlReference: string;
  controlDescription: string;
  testProcedure: string;
}

export interface ExtractedDocumentResult {
  suggestedCode: string;
  suggestedName: string;
  controls: ExtractedDocumentControl[];
}

const MAX_CONTROLS = 150;

export const deriveFrameworkMetaFromFilename = (
  originalName: string,
  customPrefix?: string,
): { suggestedCode: string; suggestedName: string; prefix: string } => {
  const base = originalName.replace(/\.[^.]+$/, '').trim();
  const cleanName = base
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || 'Uploaded Policy / Act';

  if (customPrefix && customPrefix.trim()) {
    const cleanPrefix = customPrefix
      .trim()
      .toUpperCase()
      .replace(/[^A-Z0-9-]/g, '')
      .slice(0, 16) || 'DOC';
    return {
      suggestedCode: cleanPrefix,
      suggestedName: cleanName.slice(0, 150),
      prefix: cleanPrefix,
    };
  }

  const words = cleanName
    .split(/[^A-Za-z0-9]+/)
    .filter((w) => w.length > 0);
  const stopWords = new Set(['THE', 'AND', 'FOR', 'OF', 'IN', 'ON', 'TO', 'WITH', 'ACT', 'POLICY', 'FRAMEWORK', 'SOP']);
  const significant = words.filter((w) => !stopWords.has(w.toUpperCase()));

  let prefix = '';
  const yearMatch = cleanName.match(/\b(19\d{2}|20\d{2})\b/);
  if (significant.length >= 2) {
    prefix = significant
      .slice(0, 4)
      .map((w) => w[0].toUpperCase())
      .join('');
  } else if (significant.length === 1) {
    prefix = significant[0].toUpperCase().slice(0, 6);
  } else {
    prefix = 'DOC';
  }
  if ( prefix.length < 3 && words.length > 0) {
    prefix = words.join('').toUpperCase().slice(0, 6) || 'DOC';
  }

  const suggestedCode = yearMatch ? `${prefix}-${yearMatch[1]}` : prefix;
  return {
    suggestedCode: suggestedCode.slice(0, 30),
    suggestedName: cleanName.slice(0, 150),
    prefix: prefix.slice(0, 12),
  };
};

export const extractControlsFromDocument = async (
  buffer: Buffer,
  mimeType: string,
  originalName: string,
  customPrefix?: string,
): Promise<ExtractedDocumentResult> => {
  const name = (originalName || 'document').toLowerCase();
  const { suggestedCode, suggestedName, prefix } = deriveFrameworkMetaFromFilename(
    originalName || 'Document',
    customPrefix,
  );

  // 1. Check if Excel or CSV
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    || mimeType === 'application/vnd.ms-excel'
    || mimeType === 'text/csv'
    || name.endsWith('.xlsx')
    || name.endsWith('.xls')
    || name.endsWith('.csv')
  ) {
    const spreadsheetControls = extractFromSpreadsheet(buffer, prefix);
    if (spreadsheetControls.length > 0) {
      return {
        suggestedCode,
        suggestedName,
        controls: deduplicateReferences(spreadsheetControls, prefix),
      };
    }
  }

  // 2. Extract raw text from PDF, DOCX, XLSX fallback, or plain text
  const rawText = await extractRawText(buffer, mimeType, name);
  const controls = extractControlsFromText(rawText, prefix, suggestedName);

  return {
    suggestedCode,
    suggestedName,
    controls: deduplicateReferences(controls, prefix),
  };
};

const extractFromSpreadsheet = (
  buffer: Buffer,
  prefix: string,
): ExtractedDocumentControl[] => {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const controls: ExtractedDocumentControl[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      if (rows.length === 0) continue;

      const headers = Object.keys(rows[0]);
      const refHeader = headers.find((h) => /^(control[_\s-]*)?(ref(erence)?|code|clause|id|no|number|section|article)$/i.test(h.trim()))
        ?? headers.find((h) => /(ref|code|clause|id|section)/i.test(h));
      const descHeader = headers.find((h) => /^(control[_\s-]*)?(desc(ription)?|requirement|control|statement|title|objective|obligation|policy|summary)$/i.test(h.trim()))
        ?? headers.find((h) => /(desc|requirement|control|statement|title|obligation|section)/i.test(h));
      const procHeader = headers.find((h) => /^(test[_\s-]*|audit[_\s-]*)?(proc(edure)?|test|verification|step|steps|check|method|evidence)$/i.test(h.trim()))
        ?? headers.find((h) => /(proc|test|verif|audit|step|check)/i.test(h));

      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        const rawRef = refHeader ? String(row[refHeader] ?? '').trim() : '';
        let rawDesc = descHeader ? String(row[descHeader] ?? '').trim() : '';
        const rawProc = procHeader ? String(row[procHeader] ?? '').trim() : '';

        if (!rawDesc) {
          // Fallback: join non-empty values in the row
          const nonEmpty = headers
            .filter((h) => h !== refHeader && h !== procHeader)
            .map((h) => String(row[h] ?? '').trim())
            .filter(Boolean);
          rawDesc = nonEmpty.join(' — ');
        }

        if (!rawDesc || rawDesc.length < 4) continue;

        const split = splitDescriptionAndTestProcedure(rawDesc.split(/\r?\n/));
        const cleanedDesc = split.description || rawDesc;
        const extractedProc = rawProc || split.testProcedure || '';

        const controlReference = sanitizeReference(
          rawRef || `${prefix}-${String(controls.length + 1).padStart(3, '0')}`,
          prefix,
          controls.length + 1,
        );
        const controlDescription = truncateText(cleanedDesc, 450);
        const testProcedure = extractedProc
          ? truncateText(extractedProc, 600)
          : synthesizeTestProcedure(controlReference, controlDescription);

        controls.push({
          controlReference,
          controlDescription,
          testProcedure,
        });

        if (controls.length >= MAX_CONTROLS) break;
      }
      if (controls.length >= MAX_CONTROLS) break;
    }

    return controls;
  } catch {
    return [];
  }
};

const extractRawText = async (
  buffer: Buffer,
  mimeType: string,
  lowerName: string,
): Promise<string> => {
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || lowerName.endsWith('.docx')
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return normalizeText(result.value);
  }

  if (mimeType === 'application/pdf' || lowerName.endsWith('.pdf')) {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      return normalizeText(result.text);
    } finally {
      await parser.destroy();
    }
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    || mimeType === 'application/vnd.ms-excel'
    || lowerName.endsWith('.xlsx')
    || lowerName.endsWith('.xls')
  ) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheets = workbook.SheetNames.map((sheetName) =>
      XLSX.utils.sheet_to_csv(workbook.Sheets[sheetName]),
    );
    return normalizeText(sheets.join('\n\n'));
  }

  return normalizeText(buffer.toString('utf8'));
};

const CLAUSE_START_REGEX =
  /^(?:(?:section|sec\.?|article|art\.?|clause|policy|regulation|reg\.?|rule|part|schedule|item|control|standard)\s+([A-Za-z0-9]+(?:\.[A-Za-z0-9]+)*(?:\([a-z0-9]+\))?)|(\d+(?:\.\d+){1,4}(?:\([a-z0-9]+\))?)|(\d+\([a-z0-9]+\))|(?:(\d+)[.)](?:\s+|$))|([A-Z]{2,8}-\d{1,4})(?=\s*[:.\-–—]\s+))\s*[:.\-–—]?\s*(.*)$/i;

const EXPLICIT_PROC_HEADER_ONLY_REGEX =
  /^(?:test(?:ing)?\s+procedures?|audit\s+procedures?|verification\s+procedures?|verification\s+steps?|testing\s+steps?|audit\s+steps?|verification|how\s+to\s+test|evidence\s+required|test\s+method|test|procedure)\s*[:\-–—]?\s*$/i;

const EXPLICIT_PROC_LINE_START_REGEX =
  /^(?:test(?:ing)?\s+procedures?|audit\s+procedures?|verification\s+procedures?|verification\s+steps?|testing\s+steps?|audit\s+steps?|verification|how\s+to\s+test|evidence\s+required|test\s+method|test|procedure)\s*[:\-–—]\s*(.+)$/i;

const EXPLICIT_PROC_INLINE_SPLIT_REGEX =
  /\b(?:test(?:ing)?\s+procedures?|audit\s+procedures?|verification\s+procedures?|verification\s+steps?|testing\s+steps?|audit\s+steps?|verification|how\s+to\s+test|evidence\s+required|test\s+method)\s*[:\-–—]\s*/i;

const IMPERATIVE_TEST_LINE_REGEX =
  /^(?:verify|inspect|obtain|review|confirm|sample|reconcile|check)\s+/i;

const IMPERATIVE_TEST_SENTENCE_SPLIT_REGEX =
  /(?<=[.!?])\s+(?=(?:verify|inspect|obtain|review|confirm|sample|reconcile|check)\s+)/i;

const isTestProcedureLine = (line: string): boolean => {
  const trimmed = line.trim();
  return (
    EXPLICIT_PROC_HEADER_ONLY_REGEX.test(trimmed) ||
    EXPLICIT_PROC_LINE_START_REGEX.test(trimmed) ||
    IMPERATIVE_TEST_LINE_REGEX.test(trimmed)
  );
};

const isLikelyTitleLine = (line: string, documentTitle: string): boolean => {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (CLAUSE_START_REGEX.test(trimmed)) return false;

  const normLine = trimmed.toLowerCase().replace(/[^a-z0-9]/g, '');
  const normTitle = documentTitle.toLowerCase().replace(/[^a-z0-9]/g, '');
  if (
    normLine &&
    normTitle &&
    (normLine === normTitle ||
      (trimmed.length < 120 && (normLine.includes(normTitle) || normTitle.includes(normLine))))
  ) {
    return true;
  }

  // All-caps header/title line
  if (trimmed.length < 140 && trimmed === trimmed.toUpperCase() && /[A-Z]{3,}/.test(trimmed)) {
    return true;
  }

  // Short single line without sentence-ending period and not a requirement/test sentence
  if (
    trimmed.length < 100 &&
    !/[.!?;]$/.test(trimmed) &&
    !/\b(shall|must|required|ensure|maintain|establish|submit|implement|comply|verify|inspect|obtain|review|confirm)\b/i.test(
      trimmed,
    )
  ) {
    return true;
  }

  return false;
};

export const splitDescriptionAndTestProcedure = (
  rawLines: string[],
): { description: string; testProcedure?: string } => {
  const lines = rawLines.map((l) => l.trim()).filter(Boolean);
  const descLines: string[] = [];
  const procLines: string[] = [];
  let inProc = false;

  for (const line of lines) {
    if (inProc) {
      const stripped = EXPLICIT_PROC_LINE_START_REGEX.exec(line);
      procLines.push(stripped ? stripped[1].trim() : line);
      continue;
    }

    if (EXPLICIT_PROC_HEADER_ONLY_REGEX.test(line)) {
      inProc = true;
      continue;
    }

    const explicitStart = EXPLICIT_PROC_LINE_START_REGEX.exec(line);
    if (explicitStart) {
      inProc = true;
      if (explicitStart[1]?.trim()) {
        procLines.push(explicitStart[1].trim());
      }
      continue;
    }

    if (EXPLICIT_PROC_INLINE_SPLIT_REGEX.test(line)) {
      const parts = line.split(EXPLICIT_PROC_INLINE_SPLIT_REGEX);
      if (parts[0]?.trim()) {
        descLines.push(parts[0].trim());
      }
      const rest = parts.slice(1).join(' ').trim();
      if (rest) {
        procLines.push(rest);
      }
      inProc = true;
      continue;
    }

    if (descLines.length > 0 && IMPERATIVE_TEST_LINE_REGEX.test(line)) {
      inProc = true;
      procLines.push(line);
      continue;
    }

    descLines.push(line);
  }

  let description = descLines.join(' ').replace(/\s+/g, ' ').trim();
  let testProcedure = procLines.join(' ').replace(/\s+/g, ' ').trim();

  if (!testProcedure && description) {
    if (EXPLICIT_PROC_INLINE_SPLIT_REGEX.test(description)) {
      const parts = description.split(EXPLICIT_PROC_INLINE_SPLIT_REGEX);
      description = parts[0]?.trim() || description;
      testProcedure = parts.slice(1).join(' ').trim();
    } else if (/(?<=[.!?;])\s+(?:test|procedure)\s*[:\-–—]\s+/i.test(description)) {
      const parts = description.split(/(?<=[.!?;])\s+(?:test|procedure)\s*[:\-–—]\s+/i);
      description = parts[0]?.trim() || description;
      testProcedure = parts.slice(1).join(' ').trim();
    } else if (IMPERATIVE_TEST_SENTENCE_SPLIT_REGEX.test(description)) {
      const parts = description.split(IMPERATIVE_TEST_SENTENCE_SPLIT_REGEX);
      if (parts.length > 1 && parts[0].trim().length >= 10) {
        description = parts[0].trim();
        testProcedure = parts.slice(1).join(' ').trim();
      }
    }
  }

  return {
    description,
    testProcedure: testProcedure || undefined,
  };
};

const extractControlsFromText = (
  text: string,
  prefix: string,
  documentTitle: string,
): ExtractedDocumentControl[] => {
  const clean = text.trim();
  if (!clean) {
    return [
      {
        controlReference: `${prefix}-001`,
        controlDescription: `Compliance with ${documentTitle} requirements and statutory obligations.`,
        testProcedure: `Verify compliance with ${prefix}-001: inspect supporting documentation, approvals, and records to confirm adherence to ${documentTitle}.`,
      },
    ];
  }

  const rawLines = clean
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  // If the document contains numbered/labeled clauses, skip any title or preamble lines before the first clause
  const firstClauseIdx = rawLines.findIndex((l) => CLAUSE_START_REGEX.test(l));
  const hasNumberedClauses = firstClauseIdx >= 0;

  let lines: string[];
  if (hasNumberedClauses) {
    lines = rawLines.slice(firstClauseIdx);
  } else {
    lines = [...rawLines];
    while (lines.length > 1 && isLikelyTitleLine(lines[0], documentTitle)) {
      lines.shift();
    }
  }

  interface RawChunk {
    extractedRef?: string;
    lines: string[];
  }

  const chunks: RawChunk[] = [];
  let current: RawChunk | null = null;

  for (const line of lines) {
    const match = CLAUSE_START_REGEX.exec(line);
    if (match) {
      const refToken = match[1] || match[2] || match[3] || match[4] || match[5];
      const remainder = (match[6] ?? '').trim();

      if (current && current.lines.join(' ').trim().length >= 8) {
        chunks.push(current);
      }

      const formattedRef = refToken
        ? `${prefix}-${refToken.replace(/[^A-Za-z0-9.()-]/g, '')}`
        : undefined;

      current = {
        extractedRef: formattedRef,
        lines: remainder ? [remainder] : [line],
      };
    } else if (current) {
      current.lines.push(line);
      // If a single unnumbered section grows very large, split on paragraph boundaries (unless we are appending a test procedure)
      if (!hasNumberedClauses && !isTestProcedureLine(line) && current.lines.join(' ').length > 650) {
        chunks.push(current);
        current = null;
      }
    } else {
      current = { lines: [line] };
      if (!hasNumberedClauses && !isTestProcedureLine(line) && current.lines.join(' ').length > 500) {
        chunks.push(current);
        current = null;
      }
    }
  }

  if (current && current.lines.join(' ').trim().length > 0) {
    chunks.push(current);
  }

  // If line-based clause detection only produced 1 big unnumbered block, try splitting by double newlines or sentences
  const bodyClean = lines.join('\n');
  const effectiveChunks: RawChunk[] =
    !hasNumberedClauses && chunks.length <= 1 && bodyClean.length > 350
      ? splitIntoParagraphChunks(bodyClean)
      : chunks;

  const controls: ExtractedDocumentControl[] = [];

  for (const chunk of effectiveChunks) {
    const fullText = chunk.lines.join(' ').replace(/\s+/g, ' ').trim();
    if (fullText.length < 10) continue;

    const { description: descPart, testProcedure: explicitProc } = splitDescriptionAndTestProcedure(
      chunk.lines,
    );
    if (!descPart && !explicitProc) continue;

    const index = controls.length + 1;
    const controlReference = sanitizeReference(
      chunk.extractedRef || `${prefix}-${String(index).padStart(3, '0')}`,
      prefix,
      index,
    );
    const controlDescription = truncateText(descPart || fullText, 450);
    const testProcedure = explicitProc
      ? truncateText(explicitProc, 600)
      : synthesizeTestProcedure(controlReference, controlDescription);

    controls.push({
      controlReference,
      controlDescription,
      testProcedure,
    });

    if (controls.length >= MAX_CONTROLS) break;
  }

  if (controls.length === 0) {
    const desc = truncateText(bodyClean || clean, 450);
    const ref = `${prefix}-001`;
    controls.push({
      controlReference: ref,
      controlDescription: desc,
      testProcedure: synthesizeTestProcedure(ref, desc),
    });
  }

  return controls;
};

const splitIntoParagraphChunks = (text: string): Array<{ extractedRef?: string; lines: string[] }> => {
  const rawParagraphs = text
    .split(/\n{2,}|(?<=[.;])\s+(?=[A-Z0-9])/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 15);

  if (rawParagraphs.length === 0) {
    return [{ lines: [text] }];
  }

  const merged: Array<{ extractedRef?: string; lines: string[] }> = [];
  for (const para of rawParagraphs) {
    if (merged.length > 0 && isTestProcedureLine(para)) {
      merged[merged.length - 1].lines.push(para);
    } else {
      merged.push({ lines: [para] });
    }
  }
  return merged;
};

export const synthesizeTestProcedure = (
  controlReference: string,
  controlDescription: string,
): string => {
  const cleanSummary = controlDescription
    .replace(/^[0-9A-Za-z.()-]+\s*[:.\-–—]\s*/, '')
    .trim();
  const summarySnippet =
    cleanSummary.length > 220 ? `${cleanSummary.slice(0, 217).trim()}...` : cleanSummary;
  const lowerFirst =
    summarySnippet.length > 1
      ? summarySnippet[0].toLowerCase() + summarySnippet.slice(1)
      : summarySnippet;

  return `Verify compliance with ${controlReference}: inspect supporting documentation, approvals, and records to confirm that ${lowerFirst}`;
};

const sanitizeReference = (raw: string, prefix: string, index: number): string => {
  const cleaned = raw
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9.()_-]/g, '')
    .slice(0, 50);
  return cleaned || `${prefix}-${String(index).padStart(3, '0')}`;
};

const deduplicateReferences = (
  controls: ExtractedDocumentControl[],
  prefix: string,
): ExtractedDocumentControl[] => {
  const seen = new Set<string>();
  return controls.map((c, idx) => {
    let ref = sanitizeReference(c.controlReference, prefix, idx + 1);
    if (seen.has(ref.toUpperCase())) {
      ref = `${ref.slice(0, 44)}-${idx + 1}`;
    }
    seen.add(ref.toUpperCase());
    return {
      controlReference: ref,
      controlDescription: c.controlDescription,
      testProcedure: c.testProcedure,
    };
  });
};

const truncateText = (value: string, maxLen: number): string => {
  const normalized = value.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLen) return normalized;
  return `${normalized.slice(0, maxLen - 3).trim()}...`;
};

const normalizeText = (value: string): string =>
  value
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \u00a0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
