export interface SignedAttachmentManifest {
    documentId: string;
    originalName: string;
    fileSize: number;
    sha256: string;
}
export interface SignatureManifest {
    requestId: string;
    title: string;
    description: string | null;
    attachments: SignedAttachmentManifest[];
    signerId: string;
    signedAt: string;
}
/** SHA-256 hex digest of arbitrary file bytes. */
export declare const hashBuffer: (buffer: Buffer) => string;
/**
 * Canonical JSON of the manifest with attachments sorted by documentId, so the
 * hash is stable regardless of attachment insertion order. This is what gets
 * hashed and stored — recomputing it later and comparing detects tampering.
 */
export declare const canonicalManifest: (manifest: SignatureManifest) => string;
export declare const hashManifest: (manifest: SignatureManifest) => string;
//# sourceMappingURL=signature.utility.d.ts.map