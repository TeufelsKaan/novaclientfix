const fs = require('node:fs/promises');
const path = require('node:path');
const sharp = require('sharp');
const pngToIco = require('png-to-ico').default;

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'assets', 'nova-icon.svg');
const png = path.join(root, 'assets', 'nova-icon.png');
const ico = path.join(root, 'assets', 'nova-icon.ico');

async function main() {
  const svg = await fs.readFile(source);
  const pngBytes = await sharp(svg, { density: 192 }).resize(256, 256).png().toBuffer();
  await fs.writeFile(png, pngBytes);
  await fs.writeFile(ico, await pngToIco(pngBytes));
  console.log(`Created ${path.relative(root, png)} and ${path.relative(root, ico)}`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
