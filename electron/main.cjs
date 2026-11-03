const { app, BrowserWindow, Menu, ipcMain, safeStorage, shell, screen, dialog } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { fetchCompatibleVersion, chooseJarFile } = require('../lib/modrinth.cjs');
const catalog = require('../lib/mod-catalog.json');
const { getMinecraftVersions, getLoaderVersions } = require('../lib/minecraft-catalog.cjs');
const { importModpackArchive } = require('../lib/modpack-importer.cjs');
const { createUpdateService } = require('./updates.cjs');

app.setName('Nova Client');
app.setAppUserModelId('gg.nova.client');
Menu.setApplicationMenu(null);
let mainWindow;
let activeAccount = null;
let launchBusy = false;
let gameRunning = false;
let updates;
const defaults = { profile: 'performance', gameVersion: catalog.gameVersion, loader: catalog.loader, loaderVersion: '', instanceSlug: '', modpackName: '', ramMB: 4096, selectedMods: catalog.mods.filter((m) => m.default).map((m) => m.slug), resolution: '1280x720', modPackVersion: 2 };
let settings = { ...defaults };
const profileKeys = new Set(Object.keys(catalog.profiles));
const modKeys = new Set(catalog.mods.map((m) => m.slug));
const gameRoot = path.join(app.getPath('appData'), '.nova_client');
const accountFile = () => path.join(app.getPath('userData'), 'account.enc');
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

async function readJson(file, fallback) { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; } }
async function saveSettingsFile() { await fs.mkdir(app.getPath('userData'), { recursive: true }); await fs.writeFile(settingsFile(), JSON.stringify(settings, null, 2)); }
function sendProgress(stage, detail = '', percent = null) { mainWindow?.webContents.send('nova:progress', { stage, detail, percent }); }
function publicState() {
  return { loggedIn: Boolean(activeAccount), username: activeAccount?.name || activeAccount?.username || null, uuid: activeAccount?.uuid || null, settings, catalog, gameVersion: settings.gameVersion, launchBusy, version: app.getVersion() };
}
function normalizeSettings(data = {}) {
  const profile = profileKeys.has(data.profile) ? data.profile : defaults.profile;
  const ramMB = Math.min(12288, Math.max(2048, Math.round(Number(data.ramMB) / 512) * 512 || defaults.ramMB));
  const selectedMods = Array.isArray(data.selectedMods) ? [...new Set(data.selectedMods.filter((slug) => modKeys.has(slug)))] : [...defaults.selectedMods];
  if ((Number(data.modPackVersion) || 0) < 2 && !selectedMods.includes('nova-hud')) selectedMods.push('nova-hud');
  const resolution = ['1280x720', '1600x900', '1920x1080'].includes(data.resolution) ? data.resolution : defaults.resolution;
  const gameVersion = typeof data.gameVersion === 'string' && /^[a-zA-Z0-9._-]+$/.test(data.gameVersion) ? data.gameVersion : defaults.gameVersion;
  const loader = ['vanilla', 'fabric', 'quilt', 'forge', 'neoforge'].includes(data.loader) ? data.loader : defaults.loader;
  const loaderVersion = typeof data.loaderVersion === 'string' ? data.loaderVersion : '';
  const instanceSlug = typeof data.instanceSlug === 'string' && /^[a-z0-9-]{1,80}$/.test(data.instanceSlug) ? data.instanceSlug : '';
  const modpackName = typeof data.modpackName === 'string' ? data.modpackName.slice(0, 100) : '';
  return { profile, gameVersion, loader, loaderVersion, instanceSlug, modpackName, ramMB, selectedMods, resolution, modPackVersion: 2 };
}
function currentInstanceSlug() {
  if (settings.instanceSlug) return settings.instanceSlug;
  if (settings.gameVersion === catalog.gameVersion && settings.loader === catalog.loader && settings.profile === 'performance' && !settings.modpackName) return 'nova-client';
  return `nova-${settings.loader}-${settings.gameVersion.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`;
}
function currentProfileDir() { return path.join(gameRoot, currentInstanceSlug()); }
function createWindow() {
  const primary = screen.getPrimaryDisplay();
  const display = screen.getAllDisplays().find((item) => item.id !== primary.id) || primary;
  const width = Math.min(1440, display.workArea.width);
  const height = Math.min(920, display.workArea.height);
  mainWindow = new BrowserWindow({
    width, height, x: display.workArea.x + Math.round((display.workArea.width - width) / 2),
    y: display.workArea.y + Math.round((display.workArea.height - height) / 2), minWidth: 1000, minHeight: 680,
    backgroundColor: '#0b0f15', title: 'Nova Client', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, '../launcher/index.html'));
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

async function persistAccount(account) {
  activeAccount = account;
  if (!safeStorage.isEncryptionAvailable()) throw new Error('Windows-Speicherschutz ist nicht verfügbar. Anmeldung wurde nicht lokal gespeichert.');
  await fs.mkdir(app.getPath('userData'), { recursive: true });
  const encrypted = safeStorage.encryptString(JSON.stringify(account));
  await fs.writeFile(accountFile(), encrypted);
}
async function loadAccount() {
  try {
    if (!safeStorage.isEncryptionAvailable()) return;
    const encrypted = await fs.readFile(accountFile());
    activeAccount = JSON.parse(safeStorage.decryptString(encrypted));
  } catch { activeAccount = null; }
}

async function fetchModTree(selectedSlugs) {
  const selected = catalog.mods.filter((mod) => selectedSlugs.includes(mod.slug));
  const resolved = new Map();
  const visiting = new Set();
  async function visit(project) {
    if (resolved.has(project) || visiting.has(project)) return;
    if (project === 'nova-hud') {
      if (settings.gameVersion !== catalog.gameVersion) throw new Error(`Nova HUD ist derzeit nur für Minecraft ${catalog.gameVersion} verfügbar.`);
      await visit('fabric-api');
      const bundledPath = path.join(app.getAppPath(), 'launcher', 'assets', 'nova-hud-0.1.0.jar');
      const bytes = await fs.readFile(bundledPath);
      resolved.set(project, { project, version: { version_number: '0.1.0' }, file: {
        filename: 'nova-hud-0.1.0.jar', hashes: { sha1: crypto.createHash('sha1').update(bytes).digest('hex') }, bundledPath
      } });
      return;
    }
    visiting.add(project);
    try {
      const version = await fetchCompatibleVersion(project, settings.gameVersion, settings.loader);
      for (const dep of version.dependencies || []) if (dep.dependency_type === 'required' && dep.project_id) await visit(dep.project_id);
      const file = chooseJarFile(version);
      if (!file) throw new Error(`Die Mod-Datei für ${project} ist nicht verfügbar.`);
      resolved.set(project, { project, version, file });
    } finally { visiting.delete(project); }
  }
  for (const mod of selected) {
    try { await visit(mod.slug); }
    catch (error) {
      if (/Keine passende .*Version|Nova HUD ist derzeit nur für/.test(error?.message || '')) {
        sendProgress('mods', `${mod.name} wird für Minecraft ${settings.gameVersion} übersprungen.`);
        continue;
      }
      throw error;
    }
  }
  return [...resolved.values()];
}

async function installMods(selectedSlugs) {
  sendProgress('mods', 'Prüfe HUD- und Performance-Mods …');
  const profileDir = currentProfileDir();
  await fs.mkdir(path.join(profileDir, 'mods'), { recursive: true });
  const manifestPath = path.join(profileDir, 'nova-managed-mods.json');
  const oldManifest = await readJson(manifestPath, { files: [] });
  const entries = await fetchModTree(selectedSlugs);
  const nextFiles = [];
  let completed = 0;
  for (const entry of entries) {
    const file = entry.file;
    const safeName = path.basename(file.filename);
    if (!safeName.toLowerCase().endsWith('.jar')) continue;
    const destination = path.join(profileDir, 'mods', safeName);
    let valid = false;
    try {
      const bytes = await fs.readFile(destination);
      valid = crypto.createHash('sha1').update(bytes).digest('hex') === file.hashes.sha1;
    } catch { /* first install or changed file */ }
    if (!valid) {
      sendProgress('mods', `Lade ${entry.project} …`, Math.round((completed / Math.max(entries.length, 1)) * 100));
      let bytes;
      if (file.bundledPath) bytes = await fs.readFile(file.bundledPath);
      else {
        const response = await fetch(file.url, { headers: { 'User-Agent': 'NovaClient/' + app.getVersion() + ' (desktop launcher)' } });
        if (!response.ok) throw new Error(`Download von ${safeName} fehlgeschlagen (HTTP ${response.status}).`);
        bytes = Buffer.from(await response.arrayBuffer());
      }
      if (file.hashes.sha1 && crypto.createHash('sha1').update(bytes).digest('hex') !== file.hashes.sha1) throw new Error(`Integritätsprüfung für ${safeName} fehlgeschlagen.`);
      const temporary = `${destination}.part`;
      await fs.writeFile(temporary, bytes);
      await fs.rename(temporary, destination);
    }
    nextFiles.push(safeName);
    completed++;
  }
  for (const oldName of oldManifest.files || []) {
    if (!nextFiles.includes(oldName) && path.basename(oldName) === oldName) await fs.rm(path.join(profileDir, 'mods', oldName), { force: true });
  }
  await fs.writeFile(manifestPath, JSON.stringify({ gameVersion: settings.gameVersion, loader: settings.loader, files: nextFiles }, null, 2));
  sendProgress('mods', `${nextFiles.length} Mods bereit`, 100);
}

async function startMinecraft() {
  if (launchBusy || gameRunning) return { ok: false, error: 'Minecraft läuft bereits oder wird gerade gestartet.' };
  if (!activeAccount) return { ok: false, error: 'Melde dich zuerst mit deinem Microsoft-Konto an. Für den Spielstart wird eine Minecraft: Java Edition-Lizenz benötigt.' };
  launchBusy = true;
  try {
    const { Launcher, MicrosoftAuth } = await import('eml-lib');
    const auth = new MicrosoftAuth(mainWindow);
    if (!await auth.validate(activeAccount)) {
      activeAccount = await auth.refresh(activeAccount);
      await persistAccount(activeAccount);
    }
    const loaderVersions = await getLoaderVersions(settings.gameVersion, settings.loader);
    const loaderVersion = settings.loader === 'vanilla' ? settings.gameVersion : (settings.loaderVersion && loaderVersions.includes(settings.loaderVersion) ? settings.loaderVersion : loaderVersions[0]);
    if (!loaderVersion) throw new Error(`Für Minecraft ${settings.gameVersion} gibt es aktuell keine ${settings.loader}-Version.`);
    settings.loaderVersion = loaderVersion;
    if (settings.loader === 'fabric' && !settings.modpackName) await installMods(settings.selectedMods);
    const launcher = new Launcher({
      root: 'nova-client', account: activeAccount,
      profile: { slug: currentInstanceSlug(), minecraft: { version: settings.gameVersion, loader: { loader: settings.loader, version: loaderVersion } } },
      java: { install: 'auto' }, memory: { min: 1024, max: settings.ramMB },
      window: { width: Number(settings.resolution.split('x')[0]), height: Number(settings.resolution.split('x')[1]), fullscreen: false },
      storage: 'shared',
      cleaning: { enabled: false }
    });
    launcher.on('launch_download', (d) => sendProgress('download', `${d.total.downloaded} / ${d.total.amount} Dateien`, d.total.amount ? Math.round(d.total.downloaded / d.total.amount * 100) : null));
    launcher.on('launch_install_loader', (d) => sendProgress('loader', `Installiere ${settings.loader} ${d.loaderVersion} …`));
    launcher.on('launch_check_java', () => sendProgress('java', 'Prüfe Java-Laufzeit …'));
    launcher.on('launch_launch', () => { gameRunning = true; sendProgress('launch', 'Nova Client startet Minecraft …', 100); });
    launcher.on('launch_data', (line) => sendProgress('game', String(line).trim().slice(0, 180)));
    launcher.on('launch_close', (code) => { gameRunning = false; sendProgress('closed', code === 0 ? 'Minecraft wurde geschlossen.' : `Minecraft beendet (Code ${code}).`); });
    launcher.on('launch_crash', (data) => { gameRunning = false; sendProgress('error', data?.crashData || 'Minecraft ist abgestürzt.'); });
    sendProgress('prepare', `Bereite Minecraft ${settings.gameVersion} · ${settings.loader} vor …`);
    await launcher.launch();
    sendProgress('launched', 'Spiel wurde gestartet.');
    return { ok: true };
  } catch (error) {
    gameRunning = false;
    sendProgress('error', error?.message || 'Der Spielstart ist fehlgeschlagen.');
    return { ok: false, error: error?.message || 'Der Spielstart ist fehlgeschlagen.' };
  } finally {
    launchBusy = false;
  }
}

ipcMain.handle('nova:get-state', () => publicState());
ipcMain.handle('nova:get-minecraft-versions', () => getMinecraftVersions());
ipcMain.handle('nova:get-loader-versions', (_event, gameVersion, loader) => getLoaderVersions(gameVersion, loader));
ipcMain.handle('nova:import-modpack', async (_event, input = '') => {
  let archivePath;
  let temporaryFile = '';
  try {
    if (input.trim()) {
      const url = new URL(input.trim());
      const allowedHosts = ['modrinth.com', 'cdn.modrinth.com', 'www.curseforge.com', 'curseforge.com', 'mediafilez.forgecdn.net', 'edge.forgecdn.net'];
      if (url.protocol !== 'https:' || !allowedHosts.includes(url.hostname.toLowerCase())) throw new Error('Füge einen sicheren Modrinth- oder CurseForge-Link ein.');
      const modrinthPage = url.hostname === 'modrinth.com' && url.pathname.match(/^\/modpack\/([^/]+)(?:\/versions\/([^/]+))?\/?$/);
      if (modrinthPage) {
        const [, slug, versionId] = modrinthPage;
        const endpoint = versionId
          ? `https://api.modrinth.com/v2/version/${encodeURIComponent(versionId)}`
          : `https://api.modrinth.com/v2/project/${encodeURIComponent(slug)}/version`;
        const response = await fetch(endpoint, { headers: { 'User-Agent': `NovaClient/${app.getVersion()} (modpack import)` } });
        if (!response.ok) throw new Error('Das Modrinth-Modpack wurde nicht gefunden.');
        const payload = await response.json();
        const versions = Array.isArray(payload) ? payload : [payload];
        const file = versions.flatMap(item => item.files || []).find(item => item.primary && item.filename?.toLowerCase().endsWith('.mrpack')) || versions.flatMap(item => item.files || []).find(item => item.filename?.toLowerCase().endsWith('.mrpack'));
        if (!file?.url) throw new Error('Für dieses Modrinth-Modpack ist keine .mrpack-Datei verfügbar.');
        url.href = file.url;
      }
      if (!/\.(mrpack|zip)$/i.test(new URL(url.href).pathname)) throw new Error('Dieser Link ist keine direkte Modpack-Datei. Modrinth-Projektlinks oder .mrpack/.zip-Dateien werden unterstützt.');
      const response = await fetch(url.href, { headers: { 'User-Agent': `NovaClient/${app.getVersion()} (modpack import)` } });
      if (!response.ok) throw new Error(`Der Modpack-Download ist fehlgeschlagen (HTTP ${response.status}).`);
      const bytes = Buffer.from(await response.arrayBuffer());
      if (bytes.length > 1024 * 1024 * 1024) throw new Error('Das Modpack ist größer als 1 GB.');
      temporaryFile = path.join(app.getPath('temp'), `nova-pack-${crypto.randomUUID()}${path.extname(new URL(url.href).pathname)}`);
      await fs.writeFile(temporaryFile, bytes);
      archivePath = temporaryFile;
    } else {
      const result = await dialog.showOpenDialog(mainWindow, { title: 'Modpack importieren', properties: ['openFile'], filters: [{ name: 'Modrinth oder CurseForge Modpack', extensions: ['mrpack', 'zip'] }] });
      if (result.canceled || !result.filePaths[0]) return { ok: false, canceled: true };
      archivePath = result.filePaths[0];
    }
    const slug = `pack-${path.basename(archivePath, path.extname(archivePath)).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'import'}`;
    const destination = path.join(gameRoot, slug);
    const pack = await importModpackArchive(archivePath, destination);
    settings = normalizeSettings({ ...settings, gameVersion: pack.minecraftVersion, loader: pack.loader, loaderVersion: pack.loaderVersion || '', instanceSlug: slug, modpackName: pack.name, selectedMods: [] });
    await saveSettingsFile();
    return { ok: true, pack: { ...pack, instanceSlug: slug }, state: publicState() };
  } catch (error) { return { ok: false, error: error?.message || 'Das Modpack konnte nicht importiert werden.' }; }
  finally { if (temporaryFile) await fs.rm(temporaryFile, { force: true }).catch(() => {}); }
});
ipcMain.handle('nova:login', async () => {
  try {
    const { MicrosoftAuth } = await import('eml-lib');
    const account = await new MicrosoftAuth(mainWindow).auth();
    await persistAccount(account);
    return { ok: true, state: publicState() };
  } catch (error) { return { ok: false, error: error?.message || 'Microsoft-Anmeldung abgebrochen.' }; }
});
ipcMain.handle('nova:logout', async () => { activeAccount = null; await fs.rm(accountFile(), { force: true }); return publicState(); });
ipcMain.handle('nova:save-settings', async (_event, next) => {
  settings = normalizeSettings({ ...settings, ...(next || {}) });
  await saveSettingsFile();
  return publicState();
});
ipcMain.handle('nova:launch', startMinecraft);
ipcMain.handle('nova:update-state', () => updates.state());
ipcMain.handle('nova:update-check', () => updates.check());
ipcMain.handle('nova:update-install', () => updates.install());
ipcMain.handle('nova:open-game-folder', async () => { await fs.mkdir(currentProfileDir(), { recursive: true }); return shell.openPath(currentProfileDir()); });
ipcMain.handle('nova:open-website', async () => shell.openPath(path.join(app.getAppPath(), 'website', 'index.html')));

app.whenReady().then(async () => {
  settings = normalizeSettings(await readJson(settingsFile(), {}));
  await loadAccount();
  const { autoUpdater } = require('electron-updater');
  updates = createUpdateService({
    updater: autoUpdater, version: app.getVersion(),
    enabled: app.isPackaged && process.platform === 'win32' && Boolean(require('../package.json').novaUpdateUrl),
    canInstall: () => !launchBusy && !gameRunning,
    onState: state => { if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send('nova:update-state', state); },
  });
  app.on('before-quit', () => updates.prepareQuit());
  app.on('will-quit', () => updates.stop());
  createWindow();
  mainWindow.webContents.once('did-finish-load', () => updates.start());
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
