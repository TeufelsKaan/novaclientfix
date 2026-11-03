const { app, BrowserWindow, Menu, ipcMain, safeStorage, shell, screen } = require('electron');
const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { fetchCompatibleVersion, chooseJarFile } = require('../lib/modrinth.cjs');
const catalog = require('../lib/mod-catalog.json');
const { createUpdateService } = require('./updates.cjs');

app.setName('Nova Client');
app.setAppUserModelId('gg.nova.client');
Menu.setApplicationMenu(null);
let mainWindow;
let activeAccount = null;
let launchBusy = false;
let gameRunning = false;
let updates;
const defaults = { profile: 'performance', ramMB: 4096, selectedMods: catalog.mods.filter((m) => m.default).map((m) => m.slug), resolution: '1280x720', modPackVersion: 2 };
let settings = { ...defaults };
const profileKeys = new Set(Object.keys(catalog.profiles));
const modKeys = new Set(catalog.mods.map((m) => m.slug));
const gameRoot = path.join(app.getPath('appData'), '.nova-client');
const accountFile = () => path.join(app.getPath('userData'), 'account.enc');
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

async function readJson(file, fallback) { try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; } }
async function saveSettingsFile() { await fs.mkdir(app.getPath('userData'), { recursive: true }); await fs.writeFile(settingsFile(), JSON.stringify(settings, null, 2)); }
function sendProgress(stage, detail = '', percent = null) { mainWindow?.webContents.send('nova:progress', { stage, detail, percent }); }
function publicState() {
  return { loggedIn: Boolean(activeAccount), username: activeAccount?.name || activeAccount?.username || null, uuid: activeAccount?.uuid || null, settings, catalog, gameVersion: catalog.gameVersion, launchBusy, version: app.getVersion() };
}
function normalizeSettings(data = {}) {
  const profile = profileKeys.has(data.profile) ? data.profile : defaults.profile;
  const ramMB = Math.min(12288, Math.max(2048, Math.round(Number(data.ramMB) / 512) * 512 || defaults.ramMB));
  const selectedMods = Array.isArray(data.selectedMods) ? [...new Set(data.selectedMods.filter((slug) => modKeys.has(slug)))] : [...defaults.selectedMods];
  if ((Number(data.modPackVersion) || 0) < 2 && !selectedMods.includes('nova-hud')) selectedMods.push('nova-hud');
  const resolution = ['1280x720', '1600x900', '1920x1080'].includes(data.resolution) ? data.resolution : defaults.resolution;
  return { profile, ramMB, selectedMods, resolution, modPackVersion: 2 };
}
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

async function resolveFabricVersion() {
  const response = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${catalog.gameVersion}`, { headers: { 'User-Agent': 'NovaClient/' + app.getVersion() } });
  if (!response.ok) throw new Error(`Fabric-Metadaten sind nicht erreichbar (HTTP ${response.status}).`);
  const versions = await response.json();
  const selected = versions.find((v) => v.loader?.stable) || versions[0];
  if (!selected?.loader?.version) throw new Error('Es wurde keine passende Fabric-Version gefunden.');
  return selected.loader.version;
}

async function fetchModTree(selectedSlugs) {
  const selected = catalog.mods.filter((mod) => selectedSlugs.includes(mod.slug));
  const resolved = new Map();
  const visiting = new Set();
  async function visit(project) {
    if (resolved.has(project) || visiting.has(project)) return;
    if (project === 'nova-hud') {
      await visit('fabric-api');
      const bundledPath = path.join(app.getAppPath(), 'launcher', 'assets', 'nova-hud-0.1.0.jar');
      const bytes = await fs.readFile(bundledPath);
      resolved.set(project, { project, version: { version_number: '0.1.0' }, file: {
        filename: 'nova-hud-0.1.0.jar', hashes: { sha1: crypto.createHash('sha1').update(bytes).digest('hex') }, bundledPath
      } });
      return;
    }
    visiting.add(project);
    const version = await fetchCompatibleVersion(project, catalog.gameVersion, catalog.loader);
    for (const dep of version.dependencies || []) if (dep.dependency_type === 'required' && dep.project_id) await visit(dep.project_id);
    const file = chooseJarFile(version);
    if (!file) throw new Error(`Die Mod-Datei für ${project} ist nicht verfügbar.`);
    resolved.set(project, { project, version, file });
    visiting.delete(project);
  }
  for (const mod of selected) await visit(mod.slug);
  return [...resolved.values()];
}

async function installMods(selectedSlugs) {
  sendProgress('mods', 'Prüfe HUD- und Performance-Mods …');
  await fs.mkdir(path.join(gameRoot, 'mods'), { recursive: true });
  const manifestPath = path.join(gameRoot, 'nova-managed-mods.json');
  const oldManifest = await readJson(manifestPath, { files: [] });
  const entries = await fetchModTree(selectedSlugs);
  const nextFiles = [];
  let completed = 0;
  for (const entry of entries) {
    const file = entry.file;
    const safeName = path.basename(file.filename);
    if (!safeName.toLowerCase().endsWith('.jar')) continue;
    const destination = path.join(gameRoot, 'mods', safeName);
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
    if (!nextFiles.includes(oldName) && path.basename(oldName) === oldName) await fs.rm(path.join(gameRoot, 'mods', oldName), { force: true });
  }
  await fs.writeFile(manifestPath, JSON.stringify({ gameVersion: catalog.gameVersion, files: nextFiles }, null, 2));
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
    await installMods(settings.selectedMods);
    const fabricVersion = await resolveFabricVersion();
    const launcher = new Launcher({
      root: 'nova-client', account: activeAccount,
      profile: { slug: 'nova-client', minecraft: { version: catalog.gameVersion, loader: { loader: 'fabric', version: fabricVersion } } },
      java: { install: 'auto' }, memory: { min: 1024, max: settings.ramMB },
      window: { width: Number(settings.resolution.split('x')[0]), height: Number(settings.resolution.split('x')[1]), fullscreen: false },
      storage: 'shared',
      cleaning: { enabled: false }
    });
    launcher.on('launch_download', (d) => sendProgress('download', `${d.total.downloaded} / ${d.total.amount} Dateien`, d.total.amount ? Math.round(d.total.downloaded / d.total.amount * 100) : null));
    launcher.on('launch_install_loader', (d) => sendProgress('loader', `Installiere Fabric ${d.loaderVersion} …`));
    launcher.on('launch_check_java', () => sendProgress('java', 'Prüfe Java-Laufzeit …'));
    launcher.on('launch_launch', () => { gameRunning = true; sendProgress('launch', 'Nova Client startet Minecraft …', 100); });
    launcher.on('launch_data', (line) => sendProgress('game', String(line).trim().slice(0, 180)));
    launcher.on('launch_close', (code) => { gameRunning = false; sendProgress('closed', code === 0 ? 'Minecraft wurde geschlossen.' : `Minecraft beendet (Code ${code}).`); });
    launcher.on('launch_crash', (data) => { gameRunning = false; sendProgress('error', data?.crashData || 'Minecraft ist abgestürzt.'); });
    sendProgress('prepare', `Bereite ${catalog.profiles[settings.profile].name} vor …`);
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
ipcMain.handle('nova:open-game-folder', async () => { await fs.mkdir(gameRoot, { recursive: true }); return shell.openPath(gameRoot); });
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
