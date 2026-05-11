export interface IReportGenerationService {
  generateDocx(reportId: string): Promise<Buffer>;
  generatePdf(reportId: string): Promise<Buffer>;
  exportReport(reportId: string, format: 'docx' | 'pdf'): Promise<{ buffer: Buffer; filename: string; mimeType: string }>;
}
