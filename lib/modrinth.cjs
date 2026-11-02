const API = 'https://api.modrinth.com/v2';

function chooseCompatibleVersion(versions, gameVersion, loader) {
  return versions.find((version) =>
    version.game_versions?.includes(gameVersion) && version.loaders?.includes(loader) &&
    version.version_type === 'release'
  ) || versions.find((version) =>
    version.game_versions?.includes(gameVersion) && version.loaders?.includes(loader)
  ) || null;
}

function chooseJarFile(version) {
  const files = version?.files || [];
  return files.find((file) => file.primary && file.filename?.toLowerCase().endsWith('.jar')) ||
    files.find((file) => file.filename?.toLowerCase().endsWith('.jar')) || null;
}

async function fetchCompatibleVersion(slugOrId, gameVersion, loader, fetchImpl = fetch) {
  const params = new URLSearchParams({
    game_versions: JSON.stringify([gameVersion]),
    loaders: JSON.stringify([loader])
  });
  const response = await fetchImpl(`${API}/project/${encodeURIComponent(slugOrId)}/version?${params}`, {
    headers: { 'User-Agent': 'NovaClient/0.1.0 (desktop launcher)' }
  });
  if (!response.ok) throw new Error(`Modrinth lieferte HTTP ${response.status} für ${slugOrId}.`);
  const version = chooseCompatibleVersion(await response.json(), gameVersion, loader);
  if (!version || !chooseJarFile(version)) throw new Error(`Keine passende ${loader}-Version für ${slugOrId} (${gameVersion}) gefunden.`);
  return version;
}

module.exports = { chooseCompatibleVersion, chooseJarFile, fetchCompatibleVersion };
