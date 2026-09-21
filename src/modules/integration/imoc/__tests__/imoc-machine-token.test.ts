import { AppError } from '../../../../shared/errors/app.error';
import { MachineUserImocTokenProvider } from '../service/client/imoc.client';

const machineOptions = {
  baseUrl: 'https://service-imoc.gbb.com.ng:443',
  tenantAccount: 'tenant-account',
  machineUserAccount: 'machine-user',
  accessKey: 'test-access-key',
  secretKey: 'test-secret-key',
  timeoutMs: 1_000,
  refreshSkewMs: 60_000,
};

describe('IMOC machine token provider', () => {
  it('encodes, caches, and sends only the documented machine-user token request', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        code: '1',
        msg: 'success',
        data: { imoc_token: 'token+/with space' },
      }),
    });
    const provider = new MachineUserImocTokenProvider(machineOptions, fetchImpl);

    await expect(provider.getToken()).resolves.toBe('token+/with%20space');
    await expect(provider.getToken()).resolves.toBe('token+/with%20space');

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://service-imoc.gbb.com.ng:443/esf/iamservice/v1/token/machine-user/apply',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({
          tenantAccount: 'tenant-account',
          accessKey: 'test-access-key',
          secretKey: 'test-secret-key',
          machineUserAccount: 'machine-user',
        }),
      }),
    );
  });

  it('does not cache a failed token response', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => JSON.stringify({ code: '2', msg: 'denied', data: null }),
    });
    const provider = new MachineUserImocTokenProvider(machineOptions, fetchImpl);

    await expect(provider.getToken()).rejects.toMatchObject<Partial<AppError>>({
      statusCode: 503,
    });
    await expect(provider.getToken()).rejects.toMatchObject<Partial<AppError>>({
      statusCode: 503,
    });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
