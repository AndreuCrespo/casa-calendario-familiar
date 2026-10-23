// npm run icons → generates the app icons from the SVG sources.
//   public/favicon.svg   (rounded corners) → regular icons and favicon.ico
//   assets/icon-full.svg (full-bleed)      → iPhone and Android adaptive icon
import { writeFile } from 'node:fs/promises';
import sharp from 'sharp';

const render = (src, size) => sharp(src, { density: Math.ceil((72 * size) / 100) * 2 })
  .resize(size, size)
  .png({ compressionLevel: 9 });

const jobs = [
  ['public/favicon.svg', 'public/pwa-64x64.png', 64],
  ['public/favicon.svg', 'public/pwa-192x192.png', 192],
  ['public/favicon.svg', 'public/pwa-512x512.png', 512],
  ['assets/icon-full.svg', 'public/apple-touch-icon-180x180.png', 180],
  ['assets/icon-full.svg', 'public/maskable-icon-512x512.png', 512],
];

for (const [src, out, size] of jobs) {
  await render(src, size).toFile(out);
  console.log(`✓ ${out}`);
}

// 32×32 favicon.ico: an ICO container holding a PNG (supported by every browser).
const png = await render('public/favicon.svg', 32).toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(1, 4); // one image
header.writeUInt8(32, 6); // width
header.writeUInt8(32, 7); // height
header.writeUInt16LE(1, 10); // colour planes
header.writeUInt16LE(32, 12); // bits per pixel
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18); // image offset
await writeFile('public/favicon.ico', Buffer.concat([header, png]));
console.log('✓ public/favicon.ico');
