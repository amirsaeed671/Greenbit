/**
 * Greenbit sync relay: stores one opaque, client-encrypted blob per sync chain.
 *
 * - The client sends its relay key (derived from the sync code) as a bearer token.
 *   The storage path is SHA-256(relay key), so the key itself is never stored and
 *   only someone holding the sync code can read or write the chain.
 * - Writes are conditional on the ETag the client last saw, so two devices
 *   can't silently overwrite each other; the loser re-merges and retries.
 * - The relay never sees plaintext and keeps no accounts or logs of content.
 */
export interface StoredBlob {
  text: string;
  etag: string;
}

export class Conflict extends Error {}

export interface BlobStore {
  read(path: string, ifNoneMatch?: string): Promise<StoredBlob | 'not-modified' | null>;
  /** ifMatch: replace only if current etag matches; null: create only if absent; '*': write unconditionally (repair). */
  write(path: string, text: string, ifMatch: string | null): Promise<{ etag: string }>;
  remove(path: string): Promise<void>;
}

export const MAX_BYTES = 4 * 1024 * 1024; // Vercel function body limit is 4.5 MB

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function chainPath(req: Request): Promise<string | null> {
  const m = /^Bearer ([0-9a-f]{64})$/.exec(req.headers.get('authorization') ?? '');
  return m ? `greenbit-sync/v1/${await sha256Hex(m[1])}.json` : null;
}

export async function handle(req: Request, store: BlobStore): Promise<Response> {
  const path = await chainPath(req);
  if (!path) return json(401, { error: 'Missing or malformed sync key' });

  try {
    if (req.method === 'GET') {
      const ifNoneMatch = req.headers.get('if-none-match') ?? undefined;
      const r = await store.read(path, ifNoneMatch);
      if (r === 'not-modified') return new Response(null, { status: 304, headers: { etag: ifNoneMatch!, 'cache-control': 'no-store' } });
      // Empty chain: 204 rather than 404, so browsers don't log it as an error.
      if (!r) return new Response(null, { status: 204, headers: { 'cache-control': 'no-store' } });
      return json(200, { etag: r.etag, data: r.text }, { etag: r.etag });
    }

    if (req.method === 'PUT') {
      const len = Number(req.headers.get('content-length') ?? 0);
      if (len > MAX_BYTES) return json(413, { error: 'Sync data too large' });
      const body = (await req.json().catch(() => null)) as { data?: unknown; ifMatch?: unknown; force?: unknown } | null;
      if (!body || typeof body.data !== 'string' || !/^[A-Za-z0-9_-]+$/.test(body.data)) return json(400, { error: 'Body must be { data: base64url, ifMatch: string | null }' });
      if (body.data.length > MAX_BYTES) return json(413, { error: 'Sync data too large' });
      // force: a client-side "Repair" that has just merged the latest copy overwrites unconditionally.
      const ifMatch = body.force === true ? '*' : typeof body.ifMatch === 'string' ? body.ifMatch : null;
      try {
        const { etag } = await store.write(path, body.data, ifMatch);
        return json(200, { etag }, { etag });
      } catch (e) {
        if (e instanceof Conflict) return json(412, { error: 'Changed on another device; pull and retry' });
        throw e;
      }
    }

    if (req.method === 'DELETE') {
      await store.remove(path);
      return new Response(null, { status: 204 });
    }

    return json(405, { error: 'Method not allowed' }, { allow: 'GET, PUT, DELETE' });
  } catch (e) {
    console.error('relay error', e);
    return json(502, { error: 'Storage unavailable, try again shortly' });
  }
}

/** For tests and local development. */
export class MemoryStore implements BlobStore {
  private m = new Map<string, StoredBlob>();
  private n = 0;
  async read(path: string, ifNoneMatch?: string) {
    const b = this.m.get(path);
    if (!b) return null;
    return ifNoneMatch && ifNoneMatch === b.etag ? ('not-modified' as const) : b;
  }
  async write(path: string, text: string, ifMatch: string | null) {
    const cur = this.m.get(path);
    if (ifMatch !== '*' && (ifMatch === null ? !!cur : cur?.etag !== ifMatch)) throw new Conflict();
    const etag = `"e${++this.n}"`;
    this.m.set(path, { text, etag });
    return { etag };
  }
  async remove(path: string) {
    this.m.delete(path);
  }
  get size() {
    return this.m.size;
  }
}
