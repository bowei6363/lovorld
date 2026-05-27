/**
 * Generates a real 16×16 red PNG and prints it as base64. Used only to
 * populate the inline test image in src/scripts/check.ts. Run once with:
 *   npx tsx src/scripts/make-test-png.ts
 */
import { deflateSync } from "node:zlib";

function crc32(buf: Uint8Array): number {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c;
  }
  let crc = 0xffffffff;
  for (const b of buf) crc = (crc >>> 8) ^ table[(crc ^ b) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const typeBuf = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  const crcInput = Buffer.concat([typeBuf, data]);
  crc.writeUInt32BE(crc32(crcInput), 0);
  return Buffer.concat([length, typeBuf, data, crc]);
}

const W = 16;
const H = 16;
const SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

// IHDR: width, height, bitdepth, colortype, compression, filter, interlace
const ihdrData = Buffer.alloc(13);
ihdrData.writeUInt32BE(W, 0);
ihdrData.writeUInt32BE(H, 4);
ihdrData[8] = 8; // bit depth
ihdrData[9] = 2; // color type: RGB
ihdrData[10] = 0; // compression
ihdrData[11] = 0; // filter
ihdrData[12] = 0; // interlace

// IDAT: per-row filter byte (0 = none) + RGB triples
const stride = W * 3 + 1;
const raw = Buffer.alloc(stride * H);
for (let y = 0; y < H; y++) {
  raw[y * stride] = 0; // filter: none
  for (let x = 0; x < W; x++) {
    const i = y * stride + 1 + x * 3;
    raw[i] = 0xff;
    raw[i + 1] = 0x00;
    raw[i + 2] = 0x00;
  }
}
const idatData = deflateSync(raw);

const png = Buffer.concat([
  SIGNATURE,
  chunk("IHDR", ihdrData),
  chunk("IDAT", idatData),
  chunk("IEND", Buffer.alloc(0)),
]);

console.log(png.toString("base64"));
