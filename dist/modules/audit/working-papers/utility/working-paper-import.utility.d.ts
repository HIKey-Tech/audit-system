import { WorkingPaperTemplateSection } from '../../../settings/domain/entity/settings.entity';
export interface ExtractedWorkingPaperFile {
    text: string;
    warnings: string[];
}
export interface MappedWorkingPaperSection {
    title: string;
    description: string;
    required: boolean;
    content: string;
    confidence: number;
}
export declare const extractWorkingPaperText: (buffer: Buffer, mimeType: string, originalName: string) => Promise<ExtractedWorkingPaperFile>;
export declare const mapTextToWorkingPaperSections: (text: string, templateSections: WorkingPaperTemplateSection[]) => MappedWorkingPaperSection[];
export declare const buildWorkingPaperContentFromSections: (sections: MappedWorkingPaperSection[]) => string;
export declare const averageSectionConfidence: (sections: MappedWorkingPaperSection[]) => number;
export declare const truncateExtractedText: (text: string) => string;
//# sourceMappingURL=working-paper-import.utility.d.ts.map