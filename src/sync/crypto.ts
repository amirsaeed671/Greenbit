/**
 * Sync chain secrets. A chain is 32 random bytes (the seed), shown as 24 words
 * (BIP39) or carried in a link fragment. Everything else is derived from it:
 *  - relayKey: identifies and authorises the chain at the relay (sent over HTTPS, hashed into the storage path)
 *  - encKey:   AES-GCM key; never leaves the device
 * The relay only ever sees the relay key and ciphertext.
 */
import { entropyToMnemonic, mnemonicToEntropy, validateMnemonic } from '@scure/bip39';
import { wordlist } from '@scure/bip39/wordlists/english.js';

const te = new TextEncoder();
const td = new TextDecoder();
const subtle = () => globalThis.crypto.subtle;

export const b64u = {
  enc(bytes: Uint8Array): string {
    let s = '';
    bytes.forEach((b) => (s += String.fromCharCode(b)));
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  },
  dec(s: string): Uint8Array {
    const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
    return Uint8Array.from(b, (c) => c.charCodeAt(0));
  },
};
const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

export const newSeed = () => globalThis.crypto.getRandomValues(new Uint8Array(32));
export const seedToWords = (seed: Uint8Array) => entropyToMnemonic(seed, wordlist).split(' ');

/** Accepts 24 words separated by spaces/newlines/commas, any case. Throws on a typo (checksum). */
export function wordsToSeed(input: string): Uint8Array {
  const phrase = input.trim().toLowerCase().split(/[\s,]+/).filter(Boolean).join(' ');
  if (!validateMnemonic(phrase, wordlist)) throw new Error('That sync code isn’t valid. Check each of the 24 words.');
  return mnemonicToEntropy(phrase, wordlist);
}

export const SYNC_PATH = '/sync';
export const seedToLink = (seed: Uint8Array, origin: string) => `${origin}${SYNC_PATH}#k=${b64u.enc(seed)}`;
export function linkToSeed(hash: string): Uint8Array | null {
  const m = /k=([A-Za-z0-9_-]{43})/.exec(hash);
  if (!m) return null;
  const s = b64u.dec(m[1]);
  return s.length === 32 ? s : null;
}

async function hkdf(seed: Uint8Array, info: string, bits: number): Promise<ArrayBuffer> {
  const base = await subtle().importKey('raw', seed as BufferSource, 'HKDF', false, ['deriveBits']);
  return subtle().deriveBits({ name: 'HKDF', hash: 'SHA-256', salt: te.encode('greenbit-sync-v1'), info: te.encode(info) }, base, bits);
}

export interface ChainKeys {
  relayKey: string; // hex, 64 chars
  encKey: CryptoKey;
  /** Short fingerprint to compare on two devices ("same chain?"). */
  fingerprint: string;
}

export async function deriveKeys(seed: Uint8Array): Promise<ChainKeys> {
  const relayKey = hex(await hkdf(seed, 'relay-key', 256));
  const raw = await hkdf(seed, 'encryption-key', 256);
  const encKey = await subtle().importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt']);
  const fp = hex(await hkdf(seed, 'fingerprint', 32)).toUpperCase();
  return { relayKey, encKey, fingerprint: `${fp.slice(0, 4)}-${fp.slice(4)}` };
}

async function pipe(data: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const out = new Response(new Blob([data as BlobPart]).stream().pipeThrough(stream));
  return new Uint8Array(await out.arrayBuffer());
}

/** JSON → gzip → AES-GCM. Output: base64url(iv ‖ ciphertext). */
export async function seal(key: CryptoKey, value: unknown): Promise<string> {
  const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
  const zipped = await pipe(te.encode(JSON.stringify(value)), new CompressionStream('gzip'));
  const ct = new Uint8Array(await subtle().encrypt({ name: 'AES-GCM', iv }, key, zipped as BufferSource));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv);
  out.set(ct, iv.length);
  return b64u.enc(out);
}

export async function open<T>(key: CryptoKey, sealed: string): Promise<T> {
  const bytes = b64u.dec(sealed);
  const pt = await subtle().decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12));
  return JSON.parse(td.decode(await pipe(new Uint8Array(pt), new DecompressionStream('gzip'))));
}
