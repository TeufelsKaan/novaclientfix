const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const source = path.join(root, 'nova-hud-mod', 'build', 'libs', 'nova-hud-0.1.0.jar');
const destination = path.join(root, 'launcher', 'assets', 'nova-hud-0.1.0.jar');

if (!fs.existsSync(source)) throw new Error('Nova HUD was not built.');
fs.mkdirSync(path.dirname(destination), { recursive: true });
fs.copyFileSync(source, destination);
console.log(`Bundled Nova HUD: ${path.relative(root, destination)}`);
