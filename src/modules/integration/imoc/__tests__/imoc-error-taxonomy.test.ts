import { describe, expect, it } from '@jest/globals';
import { AppError } from '../../../../shared/errors/app.error';
import {
  classifyImocNetworkError,
  classifyImocUpstreamError,
} from '../utility/imoc.utility';
import { createImocClient } from '../service/client/imoc.client';

describe('IMOC Error Taxonomy and Resolution (P0)', () => {
  describe('Network and TLS Error Classification', () => {
    it('maps TLS certificate errors to 503 with safe admin guidance', () => {
      const tlsErrors = [
        new Error('self signed certificate in certificate chain'),
        { name: 'TypeError', cause: { code: 'SELF_SIGNED_CERT_IN_CHAIN', message: 'self signed certificate' } },
        { name: 'TypeError', cause: { code: 'UNABLE_TO_VERIFY_LEAF_SIGNATURE', message: 'unable to verify' } },
        { name: 'TypeError', cause: { code: 'ERR_TLS_CERT_ALTNAME_INVALID', message: 'Hostname does not match altnames' } },
        { name: 'Error', cause: { code: 'CERT_HAS_EXPIRED', message: 'certificate has expired' } },
      ];

      for (const err of tlsErrors) {
        const classified = classifyImocNetworkError(err);
        expect(classified).toBeInstanceOf(AppError);
        expect(classified.statusCode).toBe(503);
        expect(classified.message).toBe(
          "IMOC's TLS certificate is not trusted by IAMS. Contact the administrator (CA not installed).",
        );
      }
    });

    it('maps DNS and connection errors to 503 unreachable', () => {
      const connErrors = [
        { name: 'TypeError', cause: { code: 'ENOTFOUND', message: 'getaddrinfo ENOTFOUND' } },
        { name: 'TypeError', cause: { code: 'ECONNREFUSED', message: 'connect ECONNREFUSED' } },
        { name: 'TypeError', cause: { code: 'ETIMEDOUT', message: 'connect ETIMEDOUT' } },
        { name: 'TypeError', cause: { code: 'EHOSTUNREACH', message: 'connect EHOSTUNREACH' } },
        { name: 'TypeError', cause: { code: 'UND_ERR_CONNECT_TIMEOUT', message: 'connect timeout' } },
      ];

      for (const err of connErrors) {
        const classified = classifyImocNetworkError(err);
        expect(classified).toBeInstanceOf(AppError);
        expect(classified.statusCode).toBe(503);
        expect(classified.message).toBe('IMOC is unreachable from IAMS.');
      }
    });

    it('maps abort and gateway timeout errors to 504', () => {
      const timeoutErrors = [
        { name: 'AbortError', message: 'This operation was aborted' },
        { name: 'TypeError', cause: { name: 'AbortError', message: 'The user aborted a request' } },
        { name: 'TypeError', cause: { code: 'UND_ERR_HEADERS_TIMEOUT', message: 'Headers Timeout' } },
      ];

      for (const err of timeoutErrors) {
        const classified = classifyImocNetworkError(err);
        expect(classified).toBeInstanceOf(AppError);
        expect(classified.statusCode).toBe(504);
        expect(classified.message).toBe('IMOC did not respond before the configured timeout.');
      }
    });
  });

  describe('Upstream Vendor Return Codes', () => {
    it('maps mandatory parameter missing (100) and invalid parameter (5002) to 400', () => {
      const err100 = classifyImocUpstreamError(100, 'modelId is mandatory');
      expect(err100.statusCode).toBe(400);
      expect(err100.message).toBe('IMOC rejected the request parameters.');
      expect(err100.details).toEqual({ detail: 'modelId is mandatory' });

      const err5002 = classifyImocUpstreamError('5002', 'orderStatus invalid');
      expect(err5002.statusCode).toBe(400);
      expect(err5002.message).toBe('IMOC rejected the request parameters.');
    });

    it('maps model not found or disabled (101) to 404', () => {
      const err101 = classifyImocUpstreamError('101');
      expect(err101.statusCode).toBe(404);
      expect(err101.message).toBe('IMOC ticket model not found');
    });

    it('maps empty data on single-ticket lookup to 404 not found', () => {
      const notFoundErr = classifyImocUpstreamError('200', 'Success', true);
      expect(notFoundErr.statusCode).toBe(404);
      expect(notFoundErr.message).toBe('IMOC ticket not found');
    });

    it('maps operational errors (500 / -1) to 502 Bad Gateway with upstream code', () => {
      const err500 = classifyImocUpstreamError('500');
      expect(err500.statusCode).toBe(502);
      expect(err500.message).toBe('IMOC reported an error (code 500).');

      const errMinus1 = classifyImocUpstreamError('-1');
      expect(errMinus1.statusCode).toBe(502);
      expect(errMinus1.message).toBe('IMOC reported an error (code -1).');
    });
  });

  describe('Ticket Number Lookup and Status Check', () => {
    it('disabled client returns clean status check', async () => {
      const client = createImocClient();
      const status = await client.checkStatus();
      expect(status.reachable).toBe(false);
      expect(status.authenticated).toBe(false);
      expect(typeof status.checkedAt).toBe('string');
    });
  });
});
