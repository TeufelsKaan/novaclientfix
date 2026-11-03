const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const yauzl = require('yauzl');

const MAX_ARCHIVE_ENTRIES = 20000;
const MAX_ENTRY_SIZE = 2 * 1024 * 1024 * 1024;

function openArchive(file) {
  return new Promise((resolve, reject) => yauzl.open(file, { lazyEntries: true, decodeStrings: true, strictFileNames: true, validateEntrySizes: true, autoClose: false }, (error, zip) => error ? reject(error) : resolve(zip)));
}
function readEntry(zip, entry) {
  return new Promise((resolve, reject) => zip.openReadStream(entry, (error, stream) => {
    if (error) return reject(error);
    const chunks = [];
    stream.on('data', chunk => chunks.push(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(Buffer.concat(chunks)));
  }));
}
function zipEntries(zip) {
  return new Promise((resolve, reject) => {
    const entries = new Map();
    let count = 0;
    zip.on('error', reject);
    zip.on('entry', entry => {
      if (++count > MAX_ARCHIVE_ENTRIES) return reject(new Error('Das Modpack enthält zu viele Dateien.'));
      if (entry.uncompressedSize > MAX_ENTRY_SIZE) return reject(new Error('Eine Datei im Modpack ist zu groß.'));
      entries.set(entry.fileName.replaceAll('\\', '/'), entry);
      zip.readEntry();
    });
    zip.on('end', () => resolve(entries));
    zip.readEntry();
  });
}
function safeRelativePath(input) {
  if (typeof input !== 'string' || !input || input.includes('\0')) throw new Error('Das Modpack enthält einen ungültigen Dateipfad.');
  const normalized = input.replaceAll('\\', '/');
  if (normalized.startsWith('/') || /^[a-z]:/i.test(normalized) || normalized.split('/').some(part => part === '..' || part === '')) throw new Error('Das Modpack enthält einen unsicheren Dateipfad.');
  return normalized;
}
async function downloadPackFile(file, fetchImpl) {
  const url = file.downloads?.find(value => { try { return new URL(value).protocol === 'https:'; } catch { return false; } });
  const expected = file.hashes?.sha1 || file.hashes?.sha512;
  const algorithm = file.hashes?.sha1 ? 'sha1' : 'sha512';
  if (!url || !expected) throw new Error(`Für ${file.path} fehlt ein sicherer HTTPS-Download oder Prüfsumme.`);
  const response = await fetchImpl(url, { headers: { 'User-Agent': 'NovaClient/0.4.0 (modpack import)' } });
  if (!response.ok) throw new Error(`Eine Mod-Datei konnte nicht geladen werden (HTTP ${response.status}).`);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (crypto.createHash(algorithm).update(bytes).digest('hex').toLowerCase() !== String(expected).toLowerCase()) throw new Error(`Die Prüfsumme für ${path.basename(file.path)} stimmt nicht überein.`);
  return bytes;
}
async function extractOverrides(entries, zip, prefix, destination) {
  for (const [name, entry] of entries) {
    if (!name.startsWith(prefix) || name.endsWith('/')) continue;
    const relative = safeRelativePath(name.slice(prefix.length));
    const target = path.resolve(destination, relative);
    if (!target.startsWith(path.resolve(destination) + path.sep)) throw new Error('Das Modpack enthält einen unsicheren Dateipfad.');
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, await readEntry(zip, entry));
  }
}
async function importModpackArchive(archivePath, destination, fetchImpl = fetch) {
  const zip = await openArchive(archivePath);
  try {
    const entries = await zipEntries(zip);
    const mrEntry = entries.get('modrinth.index.json');
    const cfEntry = entries.get('manifest.json');
    if (!mrEntry && !cfEntry) throw new Error('Keine Modrinth- oder CurseForge-Modpack-Datei erkannt.');
    const modrinth = Boolean(mrEntry);
    const manifest = JSON.parse((await readEntry(zip, mrEntry || cfEntry)).toString('utf8'));
    const minecraftVersion = modrinth ? manifest.dependencies?.minecraft : manifest.minecraft?.version;
    const loaderKeys = { fabric: 'fabric-loader', quilt: 'quilt-loader', forge: 'forge', neoforge: 'neoforge' };
    const loaders = modrinth
      ? Object.entries(loaderKeys).filter(([, key]) => manifest.dependencies?.[key]).map(([loader]) => loader)
      : (manifest.minecraft?.modLoaders || []).map(item => String(item.id || '').split('-')[0].toLowerCase()).filter(loader => ['fabric', 'quilt', 'forge', 'neoforge'].includes(loader));
    const loader = loaders[0] || 'vanilla';
    let loaderVersion = modrinth ? manifest.dependencies?.[loaderKeys[loader]] : manifest.minecraft?.modLoaders?.find(item => String(item.id).startsWith(`${loader}-`))?.id?.slice(loader.length + 1);
    if (loader === 'forge' && loaderVersion && !loaderVersion.startsWith(`${minecraftVersion}-`)) loaderVersion = `${minecraftVersion}-${loaderVersion}`;
    if (!minecraftVersion) throw new Error('Im Modpack fehlt die Minecraft-Version.');
    if (!modrinth) {
      const unresolved = (manifest.files || []).filter(file => !file.downloadUrl).length;
      if (unresolved) throw new Error(`Dieses CurseForge-Exportpaket verweist auf ${unresolved} Mod-Dateien, deren Download CurseForge nur über einen genehmigten API-Schlüssel bereitstellt. Importiere bitte ein Modrinth-Paket oder ein CurseForge-Paket, das die Mod-Dateien bereits enthält.`);
    }
    await fs.mkdir(destination, { recursive: true });
    const overrideFolder = modrinth ? safeRelativePath(manifest.overrides || 'overrides').replace(/\/$/, '') : 'overrides';
    await extractOverrides(entries, zip, `${overrideFolder}/`, destination);
    const downloads = [];
    if (modrinth) {
      for (const file of manifest.files || []) {
        if (file.env?.client === 'unsupported') continue;
        const relative = safeRelativePath(file.path);
        const target = path.resolve(destination, relative);
        if (!target.startsWith(path.resolve(destination) + path.sep)) throw new Error('Das Modpack enthält einen unsicheren Dateipfad.');
        await fs.mkdir(path.dirname(target), { recursive: true });
        await fs.writeFile(target, await downloadPackFile(file, fetchImpl));
        downloads.push(relative);
      }
    } else {
      for (const file of manifest.files || []) {
        const url = new URL(file.downloadUrl);
        if (url.protocol !== 'https:') throw new Error('CurseForge-Mod-Datei verwendet keine sichere HTTPS-Adresse.');
        const response = await fetchImpl(url);
        if (!response.ok) throw new Error(`Eine CurseForge-Mod-Datei konnte nicht geladen werden (HTTP ${response.status}).`);
        const bytes = Buffer.from(await response.arrayBuffer());
        if (bytes.length > MAX_ENTRY_SIZE) throw new Error('Eine Mod-Datei im Modpack ist zu groß.');
        const relative = safeRelativePath(`mods/${path.basename(url.pathname)}`);
        await fs.writeFile(path.join(destination, relative), bytes);
        downloads.push(relative);
      }
    }
    return { name: manifest.name || path.basename(archivePath), minecraftVersion, loader, loaderVersion, files: downloads.length };
  } finally { zip.close(); }
}

module.exports = { importModpackArchive, safeRelativePath };
