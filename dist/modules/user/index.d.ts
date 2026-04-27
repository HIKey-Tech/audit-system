import { Router } from 'express';
import './docs/auth.docs';
import './docs/user.docs';
export declare const createUserModule: () => Router;
export { UserService } from './service/implementation/user.service';
export { AuthService } from './service/implementation/auth.service';
export type { IUserService } from './service/interface/user.service.interface';
export type { IAuthService } from './service/interface/auth.service.interface';
//# sourceMappingURL=index.d.ts.map