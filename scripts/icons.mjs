// npm run icons → genera los iconos de la app a partir de los SVG.
//   public/favicon.svg   (esquinas redondeadas) → iconos normales y favicon.ico
//   assets/icon-full.svg (a sangre)            → iPhone y icono adaptable de Android
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

// favicon.ico de 32×32: un ICO que lleva dentro un PNG (lo aceptan todos los navegadores).
const png = await render('public/favicon.svg', 32).toBuffer();
const header = Buffer.alloc(22);
header.writeUInt16LE(0, 0); // reservado
header.writeUInt16LE(1, 2); // tipo: icono
header.writeUInt16LE(1, 4); // una imagen
header.writeUInt8(32, 6); // ancho
header.writeUInt8(32, 7); // alto
header.writeUInt16LE(1, 10); // planos
header.writeUInt16LE(32, 12); // bits por píxel
header.writeUInt32LE(png.length, 14);
header.writeUInt32LE(22, 18); // posición de la imagen
await writeFile('public/favicon.ico', Buffer.concat([header, png]));
console.log('✓ public/favicon.ico');
