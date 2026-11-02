const test = require('node:test');
const assert = require('node:assert/strict');
const { chooseCompatibleVersion, chooseJarFile } = require('../lib/modrinth.cjs');

test('chooses the newest compatible release for the selected loader', () => {
  const versions = [
    { id: 'beta', version_type: 'beta', game_versions: ['26.3'], loaders: ['fabric'] },
    { id: 'wrong-loader', version_type: 'release', game_versions: ['26.3'], loaders: ['forge'] },
    { id: 'release', version_type: 'release', game_versions: ['26.3'], loaders: ['fabric'] }
  ];
  assert.equal(chooseCompatibleVersion(versions, '26.3', 'fabric').id, 'release');
});

test('falls back to a compatible beta only when no release exists', () => {
  const versions = [{ id: 'beta', version_type: 'beta', game_versions: ['26.3'], loaders: ['fabric'] }];
  assert.equal(chooseCompatibleVersion(versions, '26.3', 'fabric').id, 'beta');
  assert.equal(chooseCompatibleVersion(versions, '1.20.1', 'fabric'), null);
});

test('prefers a marked primary jar and ignores non-jar downloads', () => {
  const version = { files: [
    { filename: 'sources.zip', primary: true },
    { filename: 'mod.jar', primary: false },
    { filename: 'mod-main.jar', primary: true }
  ] };
  assert.equal(chooseJarFile(version).filename, 'mod-main.jar');
});
