import { describe, it, expect } from 'vitest';
import { app } from '../src/server.js';

describe('API health', () => {
  it('returns health status', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
    expect(body.version).toBe('0.1.0');
  });
});
