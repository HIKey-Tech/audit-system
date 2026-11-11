import { AppError } from '../../../../shared/errors/app.error';
import { ProjectPlusDocumentType, ProjectPlusEntity } from '../domain/entity/projectplus.entity';
/** Allow-list normaliser: anything not named here is dropped, never passed through. */
export declare const normalizeProjectPlusEntity: (raw: unknown) => ProjectPlusEntity;
export declare const normalizeProjectPlusDocumentType: (raw: unknown) => ProjectPlusDocumentType;
/** Case-insensitive match across the searchable identity fields. */
export declare const matchesProjectPlusSearch: (entity: ProjectPlusEntity, search: string) => boolean;
/** Maps transport failures to safe, actionable errors. Never includes bodies or headers. */
export declare const classifyProjectPlusNetworkError: (err: unknown) => AppError;
/** Maps non-2xx HTTP responses from the gateway to safe errors. */
export declare const classifyProjectPlusHttpStatus: (status: number) => AppError;
//# sourceMappingURL=projectplus.utility.d.ts.map