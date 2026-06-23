import { Router } from 'express';
import { IDirectoryMappingService } from '../service/interface/directory.service.interface';
export declare class DirectoryMappingController {
    private readonly service;
    readonly router: Router;
    constructor(service: IDirectoryMappingService);
    private _registerRoutes;
    /** @route GET /integration/directory/mappings @desc List group→role mappings @access settings:read */
    private _list;
    /** @route POST /integration/directory/mappings @desc Create a mapping @access settings:manage */
    private _create;
    /** @route PATCH /integration/directory/mappings/:id @desc Update a mapping @access settings:manage */
    private _update;
    /** @route DELETE /integration/directory/mappings/:id @desc Delete a mapping @access settings:manage */
    private _delete;
    /** @route POST /integration/directory/sync @desc Trigger a full directory sync @access settings:manage */
    private _sync;
}
//# sourceMappingURL=directory-mapping.controller.d.ts.map