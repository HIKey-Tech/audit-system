import express from 'express';
import type { AddressInfo } from 'net';
import { errorHandlerMiddleware } from '../error-handler.middleware';

// Creating an engagement sends the whole control checklist (hundreds of controls with their text),
// which is far larger than Express's default 100kb JSON limit and used to surface as a generic 500.
const buildApp = (limit: string | number) => {
  const app = express();
  app.use(express.json({ limit }));
  app.post('/echo', (req, res) => res.status(200).json({ count: req.body.controls.length }));
  app.use(errorHandlerMiddleware);
  return app;
};

const controls = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ ref: `C-${i}`, text: 'x'.repeat(600) }));

const post = async (limit: string | number, n: number): Promise<{ status: number; body: any }> => {
  const server = buildApp(limit).listen(0);
  try {
    const { port } = server.address() as AddressInfo;
    const res = await fetch(`http://127.0.0.1:${port}/echo`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ controls: controls(n) }),
    });
    return { status: res.status, body: await res.json() };
  } finally {
    server.close();
  }
};

describe('large request bodies', () => {
  it('accepts a 720-control checklist under the raised limit', async () => {
    const res = await post('10mb', 720);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(720);
  });

  it('has no size limit when the limit is Infinity', async () => {
    const res = await post(Infinity, 3000);
    expect(res.status).toBe(200);
    expect(res.body.count).toBe(3000);
  });

  it('answers 413 with a clear message instead of a generic 500 when a body is too large', async () => {
    const res = await post('100kb', 720);
    expect(res.status).toBe(413);
    expect(res.body.message).toMatch(/too large/i);
  });
});
