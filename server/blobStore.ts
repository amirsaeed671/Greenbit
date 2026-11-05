import { BlobPreconditionFailedError, BlobError, del, get, put } from '@vercel/blob';
import { Conflict, type BlobStore } from './relay.js';

/** Vercel Blob (private store). Needs BLOB_READ_WRITE_TOKEN, which connecting the store to the project provides. */
export const vercelBlobStore: BlobStore = {
  async read(path, ifNoneMatch) {
    const r = await get(path, { access: 'private', useCache: false, ifNoneMatch }).catch((e) => {
      if (e instanceof BlobError && /not.?found/i.test(e.message)) return null;
      throw e;
    });
    if (!r) return null;
    if (r.statusCode === 304) return 'not-modified';
    if (!r.stream) return null;
    return { text: await new Response(r.stream).text(), etag: r.blob.etag };
  },
  async write(path, text, ifMatch) {
    try {
      const r = await put(path, text, {
        access: 'private',
        contentType: 'application/json',
        addRandomSuffix: false,
        cacheControlMaxAge: 60,
        ...(ifMatch ? { ifMatch } : { allowOverwrite: false }),
      });
      return { etag: r.etag };
    } catch (e) {
      if (e instanceof BlobPreconditionFailedError || (e instanceof BlobError && /already exists/i.test(e.message))) throw new Conflict();
      throw e;
    }
  },
  async remove(path) {
    await del(path);
  },
};
