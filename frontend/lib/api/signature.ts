import { api } from '../api-client';
import type { UserSignature } from '../types/domain';

export const signatureApi = {
  /** The caller's active signature, or null. */
  get: () => api.get<UserSignature | null>('/settings/signature'),
  /** Create or replace the caller's active signature (multipart). */
  save: (file: Blob, kind: 'drawn' | 'uploaded') => {
    const fd = new FormData();
    fd.append('file', file, 'signature.png');
    fd.append('kind', kind);
    return api.upload<UserSignature>('/settings/signature', fd);
  },
  remove: () => api.delete('/settings/signature'),
};
