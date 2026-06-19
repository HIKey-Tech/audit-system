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
//# sourceMappingURL=signed-document.utility.d.ts.map