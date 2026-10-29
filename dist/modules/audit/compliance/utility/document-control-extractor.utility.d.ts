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
export declare const deriveFrameworkMetaFromFilename: (originalName: string, customPrefix?: string) => {
    suggestedCode: string;
    suggestedName: string;
    prefix: string;
};
export declare const extractControlsFromDocument: (buffer: Buffer, mimeType: string, originalName: string, customPrefix?: string) => Promise<ExtractedDocumentResult>;
export declare const splitDescriptionAndTestProcedure: (rawLines: string[]) => {
    description: string;
    testProcedure?: string;
};
export declare const synthesizeTestProcedure: (controlReference: string, controlDescription: string) => string;
//# sourceMappingURL=document-control-extractor.utility.d.ts.map