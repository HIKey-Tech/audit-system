export interface UserSignatureResponseDto {
    id: string;
    kind: 'drawn' | 'uploaded';
    documentId: string;
    /** Same-origin proxy URL the frontend can render directly. */
    imageUrl: string;
    createdAt: string;
    updatedAt: string;
}
export interface UserSignatureRow {
    id: string;
    kind: string;
    document_id: string;
    created_at: Date;
    updated_at: Date;
}
export declare const mapSignatureToResponse: (row: UserSignatureRow) => UserSignatureResponseDto;
//# sourceMappingURL=signature.response.dto.d.ts.map