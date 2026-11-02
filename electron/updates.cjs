// The updater owns validation and caching. The renderer only receives plain state.
function classifyUpdateError(error) {
  const code = String(error?.code || '');
  const message = String(error?.message || error || '');
  if (error?.statusCode === 404 || code === 'HTTP_ERROR_404' || code === 'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND') return 'channel_unavailable';
  if (['ERR_CHECKSUM_MISMATCH', 'ERR_UPDATER_INVALID_SIGNATURE'].includes(code) || /checksum mismatch|sha512.*mismatch/i.test(message)) return 'integrity';
  if (/^(EAI_AGAIN|ENOTFOUND|ECONNREFUSED|ECONNRESET|ETIMEDOUT|ENETUNREACH|EHOSTUNREACH)$/.test(code) || /net::ERR_(INTERNET_DISCONNECTED|NAME_NOT_RESOLVED|CONNECTION_[A-Z_]+|NETWORK_CHANGED|TIMED_OUT|EMPTY_RESPONSE)|socket hang up/i.test(message)) return 'network';
  if (Number(error?.statusCode) >= 400 || /^HTTP_ERROR_\d+$/.test(code)) return 'server';
  return 'unknown';
}
function createUpdateService({ updater, version, enabled, onState = () => {}, canInstall = () => true, now = () => new Date().toISOString() }) {
  let state = { status: enabled ? 'idle' : 'disabled', currentVersion: version, nextVersion: null, percent: 0, checkedAt: null, attemptedAt: null, errorCode: null };
  let checking = false;
  let stopped = false;
  let timer;
  const listeners = [];
  const publish = patch => { state = { ...state, ...patch }; if (!stopped) onState({ ...state }); };
  const fail = error => publish({ status: 'error', errorCode: classifyUpdateError(error) });
  const listen = (event, handler) => { updater.on(event, handler); listeners.push([event, handler]); };
  if (enabled) {
    // Explicit download handling gives one path for errors and duplicate requests.
    updater.autoDownload = false;
    updater.autoInstallOnAppQuit = true;
    updater.autoRunAppAfterInstall = true;
    updater.allowPrerelease = false;
    updater.allowDowngrade = false;
    updater.disableWebInstaller = true;
    listen('checking-for-update', () => publish({ status: 'checking', percent: 0 }));
    listen('update-not-available', () => publish({ status: 'current', checkedAt: now(), nextVersion: null, errorCode: null }));
    listen('update-available', info => {
      publish({ status: 'downloading', nextVersion: info.version, percent: 0, checkedAt: now(), errorCode: null });
      Promise.resolve().then(() => updater.downloadUpdate()).catch(fail);
    });
    listen('download-progress', progress => publish({ status: 'downloading', percent: Math.min(100, Math.max(0, Number(progress.percent) || 0)) }));
    listen('update-downloaded', info => publish({ status: 'ready', nextVersion: info.version, percent: 100 }));
    listen('error', fail);
  }
  async function check() {
    if (!enabled || stopped || checking || ['checking', 'downloading', 'ready', 'installing'].includes(state.status)) return { ...state };
    checking = true;
    publish({ status: 'checking', attemptedAt: now(), errorCode: null, percent: 0, nextVersion: null });
    try { await updater.checkForUpdates(); } catch (error) { fail(error); } finally { checking = false; }
    return { ...state };
  }
  function install() {
    if (!enabled || state.status !== 'ready') return { ok: false, error: 'Es ist noch kein Update zur Installation bereit.' };
    if (!canInstall()) return { ok: false, error: 'Schließe zuerst Minecraft und warte, bis der Spielstart abgeschlossen ist.' };
    publish({ status: 'installing' });
    try { updater.quitAndInstall(false, true); return { ok: true }; } catch { publish({ status: 'ready' }); return { ok: false, error: 'Die Installation konnte nicht gestartet werden. Bitte versuche es erneut.' }; }
  }
  return {
    state: () => ({ ...state }), check, install,
    start() { if (!enabled || timer || stopped) return; check(); timer = setInterval(check, 30 * 60 * 1000); timer.unref?.(); },
    prepareQuit() { if (enabled) updater.autoInstallOnAppQuit = canInstall(); },
    stop() { stopped = true; clearInterval(timer); for (const [event, handler] of listeners) updater.removeListener(event, handler); },
  };
}
module.exports = { createUpdateService, classifyUpdateError };
