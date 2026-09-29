import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createPNG(width, height, r, g, b) {
  // Signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.writeUInt8(8, 8); // bit depth
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10);
  ihdr.writeUInt8(0, 11);
  ihdr.writeUInt8(0, 12);
  const ihdrChunk = makeChunk('IHDR', ihdr);

  // Raw Image Data (with filter byte 0 for each line)
  const lineSize = width * 4 + 1;
  const rawData = Buffer.alloc(lineSize * height);

  for (let y = 0; y < height; y++) {
    const lineStart = y * lineSize;
    rawData[lineStart] = 0; // Filter none

    for (let x = 0; x < width; x++) {
      const pixelStart = lineStart + 1 + x * 4;

      // Rounded rect mask
      const radius = width * 0.2;
      const dx = Math.max(Math.abs(x - width / 2) - (width / 2 - radius), 0);
      const dy = Math.max(Math.abs(y - height / 2) - (height / 2 - radius), 0);
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        // Gradient color: indigo to purple
        const factor = y / height;
        const curR = Math.round(r + (99 - r) * factor);
        const curG = Math.round(g + (102 - g) * factor);
        const curB = Math.round(b + (241 - b) * factor);

        // Simple white check / QA badge in center
        const cx = width / 2;
        const cy = height / 2;
        const inCenterIcon = Math.abs(x - cx) < width * 0.22 && Math.abs(y - cy) < height * 0.22;

        if (inCenterIcon) {
          rawData[pixelStart] = 255;
          rawData[pixelStart + 1] = 255;
          rawData[pixelStart + 2] = 255;
          rawData[pixelStart + 3] = 255;
        } else {
          rawData[pixelStart] = curR;
          rawData[pixelStart + 1] = curG;
          rawData[pixelStart + 2] = curB;
          rawData[pixelStart + 3] = 255;
        }
      } else {
        rawData[pixelStart] = 0;
        rawData[pixelStart + 1] = 0;
        rawData[pixelStart + 2] = 0;
        rawData[pixelStart + 3] = 0; // Transparent outside
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);

  const typeBuf = Buffer.from(type);
  const body = Buffer.concat([typeBuf, data]);

  const crc = crc32(body);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc, 0);

  return Buffer.concat([len, body, crcBuf]);
}

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let j = 0; j < 8; j++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

const iconsDir = path.resolve('public/icons');
if (!fs.existsSync(iconsDir)) {
  fs.mkdirSync(iconsDir, { recursive: true });
}

// Generate indigo/violet icons (R: 79, G: 70, B: 229)
fs.writeFileSync(path.join(iconsDir, 'icon16.png'), createPNG(16, 16, 79, 70, 229));
fs.writeFileSync(path.join(iconsDir, 'icon48.png'), createPNG(48, 48, 79, 70, 229));
fs.writeFileSync(path.join(iconsDir, 'icon128.png'), createPNG(128, 128, 79, 70, 229));

console.log('Successfully generated icon16.png, icon48.png, icon128.png');
