import { Router } from 'express';
import { IDocumentService } from '../service/interface/document.service.interface';
export declare class DocumentController {
    private readonly documentService;
    readonly router: Router;
    constructor(documentService: IDocumentService);
    private _registerRoutes;
    private _upload;
    private _getById;
    private _getDownloadUrl;
    private _delete;
    private _listByEntity;
    private _list;
    private _serve;
    private _getFileById;
    private _sendFile;
    private _uploadNewVersion;
    private _listVersions;
    private _getVersion;
    private _getVersionDownloadUrl;
    private _createTemplate;
    private _listTemplates;
    private _getTemplateById;
    private _updateTemplate;
    private _deleteTemplate;
}
//# sourceMappingURL=document.controller.d.ts.map