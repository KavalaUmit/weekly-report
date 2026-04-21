/**
 * generate-favicon.js
 * Creates public/favicon.ico (16, 32, 48 px) with no external dependencies.
 * Design: navy rounded square, teal header stripe, white document, content lines.
 * Colors match the PDF header: navy #0f2850, teal #48c7c7.
 */
'use strict';
const zlib = require('zlib');
const fs   = require('fs');
const path = require('path');

// ── CRC32 table ──────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff];
  return (crc ^ 0xffffffff) >>> 0;
}

// ── PNG encoder ──────────────────────────────────────────────────────────────
function encodePNG(pixels, w, h) {
  // pixels: Uint8Array RGBA, row-major
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const t   = Buffer.from(type);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
    const c   = Buffer.alloc(4); c.writeUInt32BE(crc32(Buffer.concat([t, data])), 0);
    return Buffer.concat([len, t, data, c]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr.writeUInt8(8, 8);   // bit depth
  ihdr.writeUInt8(6, 9);   // RGBA
  // bytes 10-12: compression=0, filter=0, interlace=0

  // Build raw scanlines (filter byte 0 per row)
  const raw = Buffer.alloc(h * (w * 4 + 1));
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0;
    for (let x = 0; x < w; x++) {
      const s = (y * w + x) * 4;
      const d = y * (w * 4 + 1) + 1 + x * 4;
      raw[d]   = pixels[s];
      raw[d+1] = pixels[s+1];
      raw[d+2] = pixels[s+2];
      raw[d+3] = pixels[s+3];
    }
  }

  return Buffer.concat([
    sig,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── ICO packer ───────────────────────────────────────────────────────────────
function packICO(images) {
  // images: [{png: Buffer, w, h}]
  const n   = images.length;
  const hdr = Buffer.alloc(6);
  hdr.writeUInt16LE(0, 0); hdr.writeUInt16LE(1, 2); hdr.writeUInt16LE(n, 4);

  let offset = 6 + n * 16;
  const entries = images.map(({ png, w, h }) => {
    const e = Buffer.alloc(16);
    e.writeUInt8(w >= 256 ? 0 : w, 0);
    e.writeUInt8(h >= 256 ? 0 : h, 1);
    e.writeUInt8(0, 2); e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4); e.writeUInt16LE(32, 6);
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    return e;
  });

  return Buffer.concat([hdr, ...entries, ...images.map(i => i.png)]);
}

// ── Pixel helpers ─────────────────────────────────────────────────────────────
function inRoundedRect(px, py, x, y, w, h, r) {
  if (px < x || px >= x + w || py < y || py >= y + h) return false;
  if (px < x + r && py < y + r)         return (px-(x+r))**2+(py-(y+r))**2 <= r*r;
  if (px >= x+w-r && py < y + r)        return (px-(x+w-r))**2+(py-(y+r))**2 <= r*r;
  if (px < x + r && py >= y+h-r)        return (px-(x+r))**2+(py-(y+h-r))**2 <= r*r;
  if (px >= x+w-r && py >= y+h-r)       return (px-(x+w-r))**2+(py-(y+h-r))**2 <= r*r;
  return true;
}

function setPixel(px, size, x, y, r, g, b, a) {
  if (x < 0 || x >= size || y < 0 || y >= size) return;
  const i = (y * size + x) * 4;
  px[i]=r; px[i+1]=g; px[i+2]=b; px[i+3]=a;
}

function fillRect(px, size, x, y, w, h, r, g, b, a) {
  for (let py = y; py < y+h; py++)
    for (let qx = x; qx < x+w; qx++)
      setPixel(px, size, qx, py, r, g, b, a);
}

// ── Icon drawing ──────────────────────────────────────────────────────────────
function drawIcon(size) {
  const px     = new Uint8Array(size * size * 4); // transparent
  const corner = Math.round(size * 0.22);

  // Navy rounded background
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (inRoundedRect(x, y, 0, 0, size, size, corner))
        setPixel(px, size, x, y, 15, 40, 80, 255);

  // Teal header stripe (top 26%)
  const hH = Math.round(size * 0.26);
  for (let y = 0; y < hH; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (px[i+3] > 0) { px[i]=72; px[i+1]=199; px[i+2]=199; }
    }

  // White document body
  const dX = Math.round(size * 0.19),  dY = Math.round(size * 0.32);
  const dW = Math.round(size * 0.625), dH = Math.round(size * 0.55);
  fillRect(px, size, dX, dY, dW, dH, 255, 255, 255, 240);

  // Content lines (navy/teal)
  const lX = dX + Math.round(size * 0.09);
  const lH = Math.max(1, Math.round(size * 0.05));
  const lW = Math.round(size * 0.44);
  const gaps = [0.12, 0.22, 0.32, 0.42];
  gaps.forEach((g, i) => {
    const ly = dY + Math.round(dH * g);
    const lw = i === 3 ? Math.round(lW * 0.6) : Math.round(lW * [1, 0.72, 0.88, 0.6][i]);
    const [r,gr2,b,a] = i === 3 ? [72,199,199,200] : [15,40,80,100];
    fillRect(px, size, lX, ly, lw, lH, r, gr2, b, a);
  });

  // Teal bottom accent stripe (bottom 10%)
  const bH = Math.max(2, Math.round(size * 0.10));
  for (let y = size - bH; y < size; y++)
    for (let x = 0; x < size; x++) {
      const i = (y * size + x) * 4;
      if (px[i+3] > 0) { px[i]=72; px[i+1]=199; px[i+2]=199; }
    }

  return px;
}

// ── Main ──────────────────────────────────────────────────────────────────────
const outIco = path.join(__dirname, '..', 'public', 'favicon.ico');
const outSvg = path.join(__dirname, '..', 'public', 'favicon.svg');

const images = [16, 32, 48].map(size => ({
  png: encodePNG(drawIcon(size), size, size),
  w: size, h: size,
}));

fs.writeFileSync(outIco, packICO(images));
console.log('✓ public/favicon.ico  (' + [16,32,48].join(', ') + ' px)');

// Also write SVG version for modern browsers
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="#0f2850"/>
  <rect x="0" y="0" width="32" height="8" rx="7" fill="#48c7c7"/>
  <rect x="0" y="4" width="32" height="4" fill="#48c7c7"/>
  <rect x="6" y="10" width="20" height="17" rx="2" fill="white" opacity="0.95"/>
  <rect x="9" y="14" width="14" height="1.5" rx="0.75" fill="#0f2850" opacity="0.4"/>
  <rect x="9" y="17" width="10" height="1.5" rx="0.75" fill="#0f2850" opacity="0.4"/>
  <rect x="9" y="20" width="12" height="1.5" rx="0.75" fill="#0f2850" opacity="0.4"/>
  <rect x="9" y="23" width="7"  height="1.5" rx="0.75" fill="#48c7c7" opacity="0.9"/>
  <rect x="0" y="27" width="32" height="5" rx="7" fill="#48c7c7"/>
  <rect x="0" y="27" width="32" height="3" fill="#48c7c7"/>
</svg>`;

fs.writeFileSync(outSvg, svg.trim());
console.log('✓ public/favicon.svg');
