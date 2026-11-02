// Exercise the actual Electron renderer with a temporary, isolated account store.
const { app, BrowserWindow } = require('electron');
app.disableHardwareAcceleration();
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const data = fs.mkdtempSync(path.join(os.tmpdir(), 'nova-ui-'));
app.setPath('userData', data);
app.setPath('sessionData', data);
require('../electron/main.cjs');
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  try {
    while (!BrowserWindow.getAllWindows().length) await delay(50);
    const win = BrowserWindow.getAllWindows()[0];
    if (win.webContents.isLoading()) await new Promise(resolve => win.webContents.once('did-finish-load', resolve));
    await delay(800);
    const run = code => win.webContents.executeJavaScript(code);
    const check = async (name, code) => { if (!await run(code)) throw new Error(name); console.log(`PASS ${name}`); };
    const output = path.join(__dirname, '../release/previews');
    fs.mkdirSync(output, { recursive: true });
    win.setSize(1440, 1000);
    await delay(150);
    await check('main text is readable', `parseFloat(getComputedStyle(document.querySelector('.hero-content>p')).fontSize)>=14`);
    if (win.isMenuBarVisible()) throw new Error('Native menu bar is visible');
    console.log('PASS native menu stays hidden');
    fs.writeFileSync(path.join(output, 'nova-home.png'), (await win.webContents.capturePage()).toPNG());
    await run(`document.querySelector('[data-page="mods"]').click();document.querySelector('#mod-search').value='sodium';document.querySelector('#mod-search').dispatchEvent(new Event('input'))`);
    await check('mod search returns relevant names and descriptions', `document.querySelectorAll('.mod-card:not(.filtered-out)').length>0&&[...document.querySelectorAll('.mod-card:not(.filtered-out)')].every(card=>card.textContent.toLowerCase().includes('sodium'))`);
    await run(`document.querySelector('#mod-search').value='no-such-mod';document.querySelector('#mod-search').dispatchEvent(new Event('input'))`);
    await check('empty search state', `!document.querySelector('#mod-empty').hidden&&document.querySelectorAll('.mod-card:not(.filtered-out)').length===0`);
    await run(`document.querySelector('#mod-search').value='';document.querySelector('#mod-search').dispatchEvent(new Event('input'));document.querySelector('#only-enabled').click()`);
    await check('enabled filter excludes disabled mods', `[...document.querySelectorAll('.mod-card:not(.filtered-out) input')].every(input=>input.checked)`);
    await delay(150);
    fs.writeFileSync(path.join(output, 'nova-mods.png'), (await win.webContents.capturePage()).toPNG());
    await run(`document.querySelector('[data-page="settings"]').click();document.querySelector('[data-settings="appearance"]').click();document.querySelector('#text-size').value='large';document.querySelector('#text-size').dispatchEvent(new Event('change'))`);
    await check('extra large text preference', `getComputedStyle(document.documentElement).fontSize==='18px'&&localStorage.getItem('nova-text-size')==='large'`);
    for (const [width,height] of [[1000,720],[1440,920]]) {
      win.setSize(width,height);await delay(150);
      for (const page of ['home','mods','hud','settings']) {
        await run(`setPage('${page}')`);
        await check(`${page} fits ${width}px with large text`, `document.querySelector('.page.active').scrollWidth<=document.querySelector('.page.active').clientWidth+1`);
      }
    }
    await run(`setProgress({stage:'error',detail:'Testfehler'});document.querySelector('#progress-dismiss').click()`);
    await check('launch error can be dismissed', `!document.querySelector('#progress-scrim').classList.contains('open')`);
    await run(`document.querySelector('#update-status-button').click()`);
    await check('update settings are reachable', `document.querySelector('#settings-content').textContent.includes('Automatische')||document.querySelector('#settings-content').textContent.includes('AUTOMATISCHE')`);
    await run(`receiveUpdateState({status:'downloading',nextVersion:'0.4.0',percent:42})`);
    await check('update progress is visible', `document.querySelector('.update-download').value===42&&document.querySelector('#check-updates').disabled`);
    await run(`receiveUpdateState({status:'ready',nextVersion:'0.4.0',percent:100})`);
    await check('verified update offers restart', `document.querySelector('#install-update').textContent.includes('installieren')&&document.querySelector('#update-status-button').textContent==='Update bereit'`);
    for(const [reason,fragment] of [['channel_unavailable','nicht öffentlich erreichbar'],['network','Internetverbindung'],['integrity','beschädigt']]){
      await run(`receiveUpdateState({status:'error',errorCode:'${reason}',attemptedAt:'2026-11-02T21:00:00Z'})`);
      await check(`${reason} shows a useful message and permits retry`, `document.querySelector('.update-message').textContent.includes('${fragment}')&&!document.querySelector('#check-updates').disabled&&!document.querySelector('#settings-content').textContent.includes('Noch kein Prüfversuch')`);
    }
    await delay(150);
    fs.writeFileSync(path.join(output, 'nova-update-error.png'), (await win.webContents.capturePage()).toPNG());
    console.log('UI checks complete. Preview images: release/previews');
    app.exit(0);
  } catch (error) { console.error(error);app.exit(1); }
});
