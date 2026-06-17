// src/modules/user/service/interface/signature.service.interface.ts
import { SetSignatureDto } from '../../dto/request/signature.request.dto';
import { UserSignatureResponseDto } from '../../dto/response/signature.response.dto';

export interface IUserSignatureService {
  /** Create or replace the caller's active signature. */
  setSignature(dto: SetSignatureDto): Promise<UserSignatureResponseDto>;
  /** Active signature for a user, or null. */
  getActiveSignature(userId: string): Promise<UserSignatureResponseDto | null>;
  /** Active signature row id + document id (for the sign flow / generator). */
  getActiveSignatureRef(userId: string): Promise<{ id: string; documentId: string } | null>;
  /** Soft-delete the caller's active signature. */
  removeSignature(userId: string): Promise<void>;
}
