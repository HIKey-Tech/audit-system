import { AppError } from '../../../../shared/errors/app.error';
import { HttpProjectPlusClient } from '../service/client/projectplus.client';
import { ProjectPlusService } from '../service/implementation/projectplus.service';
import {
  classifyProjectPlusHttpStatus,
  classifyProjectPlusNetworkError,
  normalizeProjectPlusEntity,
} from '../utility/projectplus.utility';

const settings = {
  enabled: true,
  baseUrl: 'https://gateway.test',
  authMode: 'api-key',
  authHeader: 'X-Api-Key',
  authSecret: 'secret-value',
  timeoutMs: 1000,
  caCertPath: '',
};

const reply = (status: number, body: unknown) =>
  jest.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, text: async () => JSON.stringify(body) });

describe('normalizeProjectPlusEntity', () => {
  it('drops sensitive and unknown fields', () => {
    const out = normalizeProjectPlusEntity({
      fullName: 'Acme Ltd', password: 'hunter2', nin: '123', email: 'a@b.c', phoneNumber: '080', referenceCode: 'C-1', finvendorId: 'V9',
    });
    expect(out.fullName).toBe('Acme Ltd');
    expect(out.finVendorId).toBe('V9');
    const json = JSON.stringify(out);
    expect(json).not.toContain('hunter2');
    expect(json).not.toContain('a@b.c');
    expect(json).not.toContain('"nin"');
  });

  it('builds a name from parts when fullName is absent', () => {
    expect(normalizeProjectPlusEntity({ firstName: 'Ada', surname: 'Obi' }).fullName).toBe('Ada Obi');
  });
});

describe('HttpProjectPlusClient', () => {
  it('only issues GET requests and sends the configured api key', async () => {
    const fetchImpl = reply(200, [{ code: 'A', description: 'Award letter' }]);
    const client = new HttpProjectPlusClient(fetchImpl, settings);
    await expect(client.getContractDocumentTypes()).resolves.toEqual([{ code: 'A', description: 'Award letter' }]);
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe('https://gateway.test/ProjectPlus/GetContractDocumentTypes');
    expect(init.method).toBe('GET');
    expect(init.headers['X-Api-Key']).toBe('secret-value');
    expect(init.body).toBeUndefined();
  });

  it('url-encodes the customer type', async () => {
    const fetchImpl = reply(200, []);
    await new HttpProjectPlusClient(fetchImpl, settings).listEntities('Vendor X');
    expect(fetchImpl.mock.calls[0][0]).toBe('https://gateway.test/ProjectPlus/GetCustomers/Vendor%20X');
  });

  it('maps auth rejection without leaking secrets', async () => {
    const client = new HttpProjectPlusClient(reply(401, {}), settings);
    const err = await client.listEntities('vendor').catch((e) => e);
    expect(err).toBeInstanceOf(AppError);
    expect(err.message).toContain('rejected the integration credentials');
    expect(err.message).not.toContain('secret-value');
  });

  it('reports not configured without calling the network', async () => {
    const fetchImpl = jest.fn();
    const client = new HttpProjectPlusClient(fetchImpl, { ...settings, authSecret: '' });
    const status = await client.checkStatus();
    expect(status.reachable).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('checkStatus succeeds on a healthy gateway', async () => {
    const status = await new HttpProjectPlusClient(reply(200, []), settings).checkStatus();
    expect(status).toMatchObject({ reachable: true, authenticated: true, lastError: null });
  });
});

describe('error classification', () => {
  it('classifies network causes', () => {
    expect(classifyProjectPlusNetworkError({ cause: { code: 'ENOTFOUND' } }).message).toContain('unreachable');
    expect(classifyProjectPlusNetworkError({ cause: { code: 'SELF_SIGNED_CERT_IN_CHAIN' } }).message).toContain('TLS certificate');
    expect(classifyProjectPlusNetworkError({ name: 'AbortError' }).message).toContain('timeout');
  });

  it('classifies http statuses', () => {
    expect(classifyProjectPlusHttpStatus(404)).toBeInstanceOf(AppError);
    expect(classifyProjectPlusHttpStatus(500).message).toContain('HTTP 500');
  });
});

describe('ProjectPlusService', () => {
  const entities = [
    { fullName: 'Alpha Ltd', status: 'Active', tin: '111' },
    { fullName: 'Beta Ltd', status: 'Inactive', tin: '222' },
    { fullName: 'Gamma Co', status: 'Active', tin: '333' },
  ].map(normalizeProjectPlusEntity);
  const client = { enabled: true, configured: true, listEntities: jest.fn().mockResolvedValue(entities), getContractDocumentTypes: jest.fn(), checkStatus: jest.fn() };
  const service = new ProjectPlusService(client);

  it('filters by search and status, then paginates', async () => {
    const page = await service.listEntities({ customerType: 'vendor', search: 'ltd', status: 'active', page: 1, pageSize: 10 });
    expect(page.total).toBe(1);
    expect(page.items[0].fullName).toBe('Alpha Ltd');
    const second = await service.listEntities({ customerType: 'vendor', page: 2, pageSize: 2 });
    expect(second.items).toHaveLength(1);
    expect(second.total).toBe(3);
  });
});
