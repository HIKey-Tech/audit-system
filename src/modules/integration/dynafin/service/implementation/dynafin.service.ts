import { DynafinConnectionInfo, DynafinStatus } from '../../domain/entity/dynafin.entity';
import { IDynafinClient } from '../client/dynafin.client';
import { IDynafinService } from '../interface/dynafin.service.interface';

/** Read-only status passthrough. Dynafin data itself is only ever read by the financial analyses. */
export class DynafinService implements IDynafinService {
  constructor(private readonly client: IDynafinClient) {}

  getStatus(): DynafinConnectionInfo {
    return this.client.info;
  }

  checkStatus(): Promise<DynafinStatus> {
    return this.client.checkStatus();
  }
}
