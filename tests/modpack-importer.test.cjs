const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const yazl = require('yazl');
const { importModpackArchive, safeRelativePath } = require('../lib/modpack-importer.cjs');

async function makeArchive(entries) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'nova-pack-test-'));
  const archive = path.join(dir, 'test.mrpack');
  await new Promise((resolve, reject) => {
    const zip = new yazl.ZipFile();
    zip.outputStream.on('error', reject).pipe(require('node:fs').createWriteStream(archive).on('error', reject).on('close', resolve));
    for (const [name, content] of Object.entries(entries)) zip.addBuffer(Buffer.from(content), name);
    zip.end();
  });
  return { dir, archive };
}

test('accepts ordinary modpack paths and normalizes Windows separators', () => {
  assert.equal(safeRelativePath('overrides/config/options.txt'), 'overrides/config/options.txt');
  assert.equal(safeRelativePath('overrides\\mods\\example.jar'), 'overrides/mods/example.jar');
});

test('rejects absolute and parent-traversal paths from imported archives', () => {
  assert.throws(() => safeRelativePath('../outside.txt'), /unsicheren Dateipfad/);
  assert.throws(() => safeRelativePath('C:\\outside.txt'), /unsicheren Dateipfad/);
  assert.throws(() => safeRelativePath('/outside.txt'), /unsicheren Dateipfad/);
});

test('imports a Modrinth pack, downloads checked files and applies overrides', async () => {
  const jar = Buffer.from('verified mod bytes');
  const manifest = {
    formatVersion: 1, game: 'minecraft', versionId: 'nova-test', name: 'Test Pack',
    dependencies: { minecraft: '1.21.10', 'fabric-loader': '0.17.0' },
    files: [{ path: 'mods/example.jar', downloads: ['https://cdn.modrinth.com/example.jar'], hashes: { sha1: crypto.createHash('sha1').update(jar).digest('hex') } }],
  };
  const fixture = await makeArchive({ 'modrinth.index.json': JSON.stringify(manifest), 'overrides/config/options.txt': 'pack setting' });
  const output = path.join(fixture.dir, 'instance');
  try {
    const pack = await importModpackArchive(fixture.archive, output, async () => ({ ok: true, arrayBuffer: async () => Uint8Array.from(jar).buffer }));
    assert.deepEqual({ name: pack.name, minecraftVersion: pack.minecraftVersion, loader: pack.loader, loaderVersion: pack.loaderVersion, files: pack.files }, { name: 'Test Pack', minecraftVersion: '1.21.10', loader: 'fabric', loaderVersion: '0.17.0', files: 1 });
    assert.equal(await fs.readFile(path.join(output, 'config', 'options.txt'), 'utf8'), 'pack setting');
    assert.deepEqual(await fs.readFile(path.join(output, 'mods', 'example.jar')), jar);
  } finally { await fs.rm(fixture.dir, { recursive: true, force: true }); }
});

test('refuses a CurseForge export when its manifest needs an unavailable API key', async () => {
  const manifest = { name: 'CF Pack', minecraft: { version: '1.20.1', modLoaders: [{ id: 'forge-47.2.0', primary: true }] }, files: [{ projectID: 1, fileID: 2, required: true }] };
  const fixture = await makeArchive({ 'manifest.json': JSON.stringify(manifest), 'overrides/config/options.txt': 'pack setting' });
  try {
    await assert.rejects(importModpackArchive(fixture.archive, path.join(fixture.dir, 'instance')), /genehmigten API-Schlüssel/);
    await assert.rejects(fs.access(path.join(fixture.dir, 'instance')));
  } finally { await fs.rm(fixture.dir, { recursive: true, force: true }); }
});
