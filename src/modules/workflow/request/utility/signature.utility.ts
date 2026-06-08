import crypto from 'crypto';

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
export const hashBuffer = (buffer: Buffer): string =>
  crypto.createHash('sha256').update(buffer).digest('hex');

/**
 * Canonical JSON of the manifest with attachments sorted by documentId, so the
 * hash is stable regardless of attachment insertion order. This is what gets
 * hashed and stored — recomputing it later and comparing detects tampering.
 */
export const canonicalManifest = (manifest: SignatureManifest): string => {
  const ordered: SignatureManifest = {
    ...manifest,
    attachments: [...manifest.attachments].sort((a, b) =>
      a.documentId.localeCompare(b.documentId),
    ),
  };
  return JSON.stringify(ordered);
};

export const hashManifest = (manifest: SignatureManifest): string =>
  crypto.createHash('sha256').update(canonicalManifest(manifest)).digest('hex');
