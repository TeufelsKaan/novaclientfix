const test = require('node:test');
const assert = require('node:assert/strict');
const { getMinecraftVersions, getLoaderVersions } = require('../lib/minecraft-catalog.cjs');

test('uses Mojang latest release and returns all listed version IDs', async () => {
  const result = await getMinecraftVersions(async url => ({
    ok: true,
    json: async () => ({ latest: { release: '1.21.10', snapshot: '26w01a' }, versions: [
      { id: '1.21.10', type: 'release', releaseTime: '2026-01-01' },
      { id: '26w01a', type: 'snapshot', releaseTime: '2026-01-02' },
    ] }),
  }));
  assert.equal(result.latestRelease, '1.21.10');
  assert.deepEqual(result.versions.map(v => v.id), ['1.21.10', '26w01a']);
});

test('vanilla does not require a separate loader download', async () => {
  assert.deepEqual(await getLoaderVersions('1.21.10', 'vanilla'), ['1.21.10']);
});

test('selects the stable Fabric loader for the requested Minecraft version', async () => {
  const versions = await getLoaderVersions('1.21.10', 'fabric', async url => {
    assert.match(url, /1\.21\.10$/);
    return { ok: true, json: async () => [
      { loader: { version: '0.17.1', stable: false } },
      { loader: { version: '0.17.0', stable: true } },
    ] };
  });
  assert.deepEqual(versions, ['0.17.0']);
});

test('uses the Forge recommended build before latest', async () => {
  const versions = await getLoaderVersions('1.21.10', 'forge', async () => ({
    ok: true, json: async () => ({ promos: { '1.21.10-recommended': '61.0.3', '1.21.10-latest': '61.1.0' } }),
  }));
  assert.deepEqual(versions, ['1.21.10-61.0.3', '1.21.10-61.1.0']);
});

test('filters NeoForge metadata to the selected Minecraft line', async () => {
  const versions = await getLoaderVersions('1.21.1', 'neoforge', async () => ({
    ok: true, text: async () => '<metadata><versioning><versions><version>21.1.2</version><version>20.4.8</version><version>21.1.3</version></versions></versioning></metadata>',
  }));
  assert.deepEqual(versions, ['21.1.3', '21.1.2']);
});

test('reports an offline version service clearly', async () => {
  await assert.rejects(getMinecraftVersions(async () => ({ ok: false, status: 503 })), /HTTP 503/);
});
