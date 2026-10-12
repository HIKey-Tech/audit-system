import { Router } from 'express';
import { imocIngestionService, ImocIngestionService } from './imoc/service/implementation/imoc-ingestion.service';
import { imocStoreService, ImocStoreService } from './imoc/service/implementation/imoc-store.service';
import { IImocIngestionService } from './imoc/service/interface/imoc-ingestion.service.interface';
import { IImocStoreService } from './imoc/service/interface/imoc-store.service.interface';
export declare const createIntegrationModule: () => Router;
export { DirectoryMappingService, directoryMappingService, } from './service/implementation/directory-mapping.service';
export type { IDirectoryMappingService } from './service/interface/directory.service.interface';
export { ImocTicketService } from './imoc/service/implementation/imoc-ticket.service';
export type { IImocTicketService } from './imoc/service/interface/imoc-ticket.service.interface';
export { ImocIngestionService, imocIngestionService };
export type { IImocIngestionService };
export { ImocStoreService, imocStoreService };
export type { IImocStoreService };
//# sourceMappingURL=index.d.ts.map