const MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const LOADER_APIS = {
  fabric: version => `https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(version)}`,
  quilt: version => `https://meta.quiltmc.org/v3/versions/loader/${encodeURIComponent(version)}`,
};

async function getJson(url, fetchImpl) {
  const response = await fetchImpl(url, { headers: { 'User-Agent': 'NovaClient/0.4.0 (desktop launcher)' } });
  if (!response.ok) throw new Error(`Minecraft-Metadaten sind gerade nicht erreichbar (HTTP ${response.status}).`);
  return response.json();
}

async function getMinecraftVersions(fetchImpl = fetch) {
  const manifest = await getJson(MANIFEST_URL, fetchImpl);
  if (!Array.isArray(manifest.versions) || !manifest.latest?.release) throw new Error('Mojang hat keine gültige Versionsliste geliefert.');
  return {
    latestRelease: manifest.latest.release,
    latestSnapshot: manifest.latest.snapshot,
    versions: manifest.versions.map(({ id, type, releaseTime }) => ({ id, type, releaseTime })),
  };
}

async function getLoaderVersions(minecraftVersion, loader, fetchImpl = fetch) {
  if (!minecraftVersion || !/^[a-zA-Z0-9._-]+$/.test(minecraftVersion)) throw new Error('Wähle zuerst eine gültige Minecraft-Version.');
  if (loader === 'vanilla') return [minecraftVersion];
  if (LOADER_APIS[loader]) {
    const versions = await getJson(LOADER_APIS[loader](minecraftVersion), fetchImpl);
    const list = versions.filter(item => item?.loader?.version && (loader !== 'fabric' || item.loader.stable !== false));
    return [...new Set(list.map(item => item.loader.version))];
  }
  if (loader === 'forge') {
    const promotions = await getJson('https://files.minecraftforge.net/maven/net/minecraftforge/forge/promotions_slim.json', fetchImpl);
    const key = `${minecraftVersion}-recommended`;
    const recommended = promotions.promos?.[key];
    const latest = promotions.promos?.[`${minecraftVersion}-latest`];
    const result = [...new Set([recommended, latest].filter(Boolean).map(v => `${minecraftVersion}-${v}`))];
    if (result.length) return result;
    const response = await fetchImpl('https://maven.minecraftforge.net/net/minecraftforge/forge/maven-metadata.xml');
    if (!response.ok) throw new Error('Forge-Versionen konnten nicht geladen werden.');
    const xml = await response.text();
    const prefix = `${minecraftVersion}-`;
    return [...new Set([...xml.matchAll(/<version>([^<]+)<\/version>/g)].map(match => match[1]).filter(version => version.startsWith(prefix)))].reverse();
  }
  if (loader === 'neoforge') {
    const response = await fetchImpl('https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml');
    if (!response.ok) throw new Error('NeoForge-Versionen konnten nicht geladen werden.');
    const xml = await response.text();
    const mavenPrefix = `${minecraftVersion.replace(/^1\./, '')}.`;
    return [...new Set([...xml.matchAll(/<version>([^<]+)<\/version>/g)].map(match => match[1]).filter(version => version.startsWith(mavenPrefix)))].reverse();
  }
  throw new Error('Dieser Mod-Loader wird nicht unterstützt.');
}

module.exports = { getMinecraftVersions, getLoaderVersions };
