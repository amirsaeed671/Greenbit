import { vercelBlobStore } from '../server/blobStore.js';
import { handle } from '../server/relay.js';

// Vercel Function (Node runtime, Web Request/Response handlers).
export const GET = (req: Request) => handle(req, vercelBlobStore);
export const PUT = (req: Request) => handle(req, vercelBlobStore);
export const DELETE = (req: Request) => handle(req, vercelBlobStore);
