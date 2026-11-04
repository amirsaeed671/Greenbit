import sharp from 'sharp';
import fs from 'node:fs';
const mark = fs.readFileSync('brand/logo-mark.svg');
const out = (n, s, buf = mark) => sharp(buf, { density: 384 }).resize(s, s).png().toFile('public/' + n);
// maskable: full-bleed background, art in the 80% safe zone
const maskable = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#2A7F52"/><g transform="translate(64 64) scale(0.75)">${mark.toString().replace(/<\?xml.*?\?>/, '').replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</g></svg>`);
await out('pwa-192x192.png', 192);
await out('pwa-512x512.png', 512);
await out('maskable-512x512.png', 512, maskable);
await out('apple-touch-icon.png', 180, Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#2A7F52"/><g transform="translate(40 40) scale(0.84375)">${mark.toString().replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}</g></svg>`));
await out('favicon-32x32.png', 32);
await out('favicon-16x16.png', 16);
// ICO containing a 32px PNG
const png32 = await sharp(mark, { density: 384 }).resize(32, 32).png().toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); header.writeUInt16LE(1, 2); header.writeUInt16LE(1, 4);
header.writeUInt8(32, 6); header.writeUInt8(32, 7); header.writeUInt8(0, 8); header.writeUInt8(0, 9);
header.writeUInt16LE(1, 10); header.writeUInt16LE(32, 12); header.writeUInt32LE(png32.length, 14); header.writeUInt32LE(22, 18);
fs.writeFileSync('public/favicon.ico', Buffer.concat([header, png32]));
fs.copyFileSync('brand/logo-mark.svg', 'public/favicon.svg');
console.log('ok');
