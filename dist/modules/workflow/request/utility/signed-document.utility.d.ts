export interface SignaturePanelEntry {
    name: string;
    role: string;
    actedAt: Date;
    action: 'signed' | 'approved';
    signatureImage?: {
        bytes: Buffer;
        format: 'png' | 'jpg';
    };
}
export interface SignaturePageData {
    reference: string;
    title: string;
    manifestHash: string;
    fileChecksum?: string;
    entries: SignaturePanelEntry[];
}
export declare function appendSignaturePage(sourcePdf: Buffer, data: SignaturePageData): Promise<Buffer>;
export declare function buildCertificatePdf(data: SignaturePageData): Promise<Buffer>;
export interface PlacementData {
    type: 'signature' | 'text';
    pageIndex: number;
    xPercent: number;
    yPercent: number;
    widthPercent?: number;
    heightPercent?: number;
    text?: string;
    fontSize?: number;
}
export declare function stampPdfWithPlacements(opts: {
    pdfBuffer: Buffer;
    placements: PlacementData[];
    signatureImageBuffer?: Buffer;
    signatureFormat?: 'png' | 'jpg';
    signerName: string;
    signerRole?: string;
    referenceNumber: string;
    manifestHash?: string;
}): Promise<Buffer>;
//# sourceMappingURL=signed-document.utility.d.ts.map