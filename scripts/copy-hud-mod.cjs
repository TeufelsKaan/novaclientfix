const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const manifest = require('../lib/hud-mod.json');
const properties = fs.readFileSync(path.join(root, 'nova-hud-mod', 'gradle.properties'), 'utf8');
if (!properties.includes('version=' + manifest.version)) throw new Error('HUD version differs from its bundle manifest.');
const source = path.join(root, 'nova-hud-mod', 'build', 'libs', manifest.filename);
const destination = path.join(root, 'launcher', 'assets', manifest.filename);

if (!fs.existsSync(source)) throw new Error('Nova HUD was not built.');
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.copyFileSync(source, destination);
for (const filename of fs.readdirSync(path.dirname(destination))) {
  if (/^nova-hud-[0-9.]+\.jar$/.test(filename) && filename !== manifest.filename) fs.unlinkSync(path.join(path.dirname(destination), filename));
}
console.log(`Bundled Nova HUD: ${path.relative(root, destination)}`);
