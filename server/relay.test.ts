// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { handle, MemoryStore } from './relay';

const KEY = 'a'.repeat(64);
const req = (method: string, body?: unknown, headers: Record<string, string> = {}) =>
  new Request('https://x/api/sync', { method, headers: { authorization: `Bearer ${KEY}`, 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });

describe('relay', () => {
  it('rejects missing or malformed keys', async () => {
    const s = new MemoryStore();
    expect((await handle(new Request('https://x/api/sync'), s)).status).toBe(401);
    expect((await handle(new Request('https://x/api/sync', { headers: { authorization: 'Bearer nothex' } }), s)).status).toBe(401);
  });
  it('create, read, conditional update, 304 and conflict', async () => {
    const s = new MemoryStore();
    expect((await handle(req('GET'), s)).status).toBe(204);
    const c = await handle(req('PUT', { data: 'abc', ifMatch: null }), s);
    expect(c.status).toBe(200);
    const { etag } = await c.json();
    // creating again without an etag conflicts
    expect((await handle(req('PUT', { data: 'zzz', ifMatch: null }), s)).status).toBe(412);
    const g = await handle(req('GET'), s);
    expect(await g.json()).toEqual({ etag, data: 'abc' });
    expect((await handle(req('GET', undefined, { 'if-none-match': etag }), s)).status).toBe(304);
    const u = await handle(req('PUT', { data: 'def', ifMatch: etag }), s);
    expect(u.status).toBe(200);
    // a device holding the old etag must re-merge
    expect((await handle(req('PUT', { data: 'old', ifMatch: etag }), s)).status).toBe(412);
  });
  it('force overwrites regardless of etag (repair)', async () => {
    const s = new MemoryStore();
    await handle(req('PUT', { data: 'one', ifMatch: null }), s);
    expect((await handle(req('PUT', { data: 'two', ifMatch: '"stale"' }), s)).status).toBe(412);
    expect((await handle(req('PUT', { data: 'two', force: true }), s)).status).toBe(200);
    expect((await (await handle(req('GET'), s)).json()).data).toBe('two');
  });
  it('different keys never see each other’s data', async () => {
    const s = new MemoryStore();
    await handle(req('PUT', { data: 'mine', ifMatch: null }), s);
    const other = new Request('https://x/api/sync', { headers: { authorization: `Bearer ${'b'.repeat(64)}` } });
    expect((await handle(other, s)).status).toBe(204);
  });
  it('validates bodies and deletes', async () => {
    const s = new MemoryStore();
    expect((await handle(req('PUT', { data: '<script>' }), s)).status).toBe(400);
    expect((await handle(req('POST', {}), s)).status).toBe(405);
    await handle(req('PUT', { data: 'x', ifMatch: null }), s);
    expect((await handle(req('DELETE'), s)).status).toBe(204);
    expect(s.size).toBe(0);
  });
});
