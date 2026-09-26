// Generates the four app-icon PNGs at the repo root. Node built-ins only.
//   node tools/make-icons.mjs [outDir]
// The mark: two thin muted rules with one accent bar between them, on black.
// Opaque RGB (colour type 2, no alpha), not pre-rounded — iOS and Android
// apply their own corner masks.

import { writeFileSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---- Design grid: 512 units, origin top-left ----
const GRID = 512;
const BG = [0x00, 0x00, 0x00];        // --bg
const MUTED = [0x8C, 0x8C, 0x86];     // --ink2
const ACCENT = [0xD9, 0x77, 0x57];    // --acc
const X0 = 87, X1 = 425;              // shared left/right edge of all three shapes
const SHAPES = [
  // [y0, y1, cornerRadius, colour]
  [102, 134, 16, MUTED],              // top rule (fully rounded ends)
  [194, 318, 28, ACCENT],             // accent bar
  [378, 410, 16, MUTED],              // bottom rule
];

// contentScale shrinks the mark about the centre; <1 keeps it inside
// Android's maskable safe circle (inner 80% of the canvas).
const TARGETS = [
  { file: 'icon-180.png',          size: 180, contentScale: 1 },
  { file: 'icon-192.png',          size: 192, contentScale: 1 },
  { file: 'icon-512.png',          size: 512, contentScale: 1 },
  { file: 'icon-512-maskable.png', size: 512, contentScale: 0.78 },
];

const SS = 4; // supersamples per axis for anti-aliasing

function inRoundRect(x, y, x0, y0, x1, y1, r) {
  if (x < x0 || x > x1 || y < y0 || y > y1) return false;
  const cx = Math.min(Math.max(x, x0 + r), x1 - r);
  const cy = Math.min(Math.max(y, y0 + r), y1 - r);
  return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
}

function render(size, contentScale) {
  const px = Buffer.alloc(size * size * 3);
  const k = GRID / size, c = GRID / 2;
  for (let py = 0; py < size; py++) {
    for (let pxl = 0; pxl < size; pxl++) {
      const acc = [0, 0, 0];
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          // sample point in grid units, then undo the content scale
          const gx = c + ((pxl + (sx + 0.5) / SS) * k - c) / contentScale;
          const gy = c + ((py + (sy + 0.5) / SS) * k - c) / contentScale;
          let col = BG;
          for (const [y0, y1, r, fill] of SHAPES) {
            if (inRoundRect(gx, gy, X0, y0, X1, y1, r)) { col = fill; break; }
          }
          acc[0] += col[0]; acc[1] += col[1]; acc[2] += col[2];
        }
      }
      const i = (py * size + pxl) * 3, n = SS * SS;
      px[i] = Math.round(acc[0] / n); px[i + 1] = Math.round(acc[1] / n); px[i + 2] = Math.round(acc[2] / n);
    }
  }
  return px;
}

const CRC = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let j = 0; j < 8; j++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, rgb) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit, colour type 2 (RGB, no alpha)
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter: none
    rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const outDir = process.argv[2] ?? join(dirname(fileURLToPath(import.meta.url)), '..');
for (const { file, size, contentScale } of TARGETS) {
  writeFileSync(join(outDir, file), png(size, render(size, contentScale)));
  console.log(`wrote ${file} (${size}×${size}, contentScale ${contentScale})`);
}
