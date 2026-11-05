// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { newSeed, seedToLink, seedToWords } from '../sync/crypto';
import { parseSyncCode } from './SyncPanel';

describe('parseSyncCode', () => {
  const seed = newSeed();
  it('accepts the QR link, from any origin', () => {
    expect(parseSyncCode(seedToLink(seed, 'https://greenbit-six.vercel.app'))).toEqual(seed);
    expect(parseSyncCode('  ' + seedToLink(seed, 'http://localhost:5173') + '\n')).toEqual(seed);
  });
  it('accepts the 24 words', () => {
    expect(parseSyncCode(seedToWords(seed).join(' '))).toEqual(seed);
  });
  it('rejects other QR codes and typos with a helpful message', () => {
    expect(() => parseSyncCode('https://example.com/menu')).toThrow(/isn’t a Greenbit sync code/);
    expect(() => parseSyncCode('hello world')).toThrow(/isn’t valid/);
  });
});
