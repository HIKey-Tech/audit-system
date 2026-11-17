import { DynafinConnectionInfo, DynafinStatus } from '../../domain/entity/dynafin.entity';

export interface IDynafinService {
  /** Whether Dynafin is enabled/configured and which driver is in use. No network call. */
  getStatus(): DynafinConnectionInfo;
  /** Live reachability / authentication check. */
  checkStatus(): Promise<DynafinStatus>;
}
