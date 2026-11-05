const { app, BrowserWindow, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

app.disableHardwareAcceleration();
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'nova-site-')));
const base = process.env.NOVA_SITE_PREVIEW_URL || 'http://127.0.0.1:4175';
const delay = ms => new Promise(resolve => setTimeout(resolve,ms));
app.whenReady().then(async () => {
  try {
    const primary = screen.getPrimaryDisplay();
    const display = screen.getAllDisplays().find(item => item.id !== primary.id) || primary;
    const win = new BrowserWindow({
      width: 1440, height: 1000,
      x: display.workArea.x, y: display.workArea.y, show: true,
      webPreferences: { contextIsolation: true, nodeIntegration: false },
    });
    const run = code => win.webContents.executeJavaScript(code);
    const check = async (label,code) => {
      if (!await run(code)) throw new Error(label);
      console.log('PASS ' + label);
    };
    await win.loadURL(base);
    await run('document.fonts.ready');
    await run('document.querySelector("#launcher-preview").decode()');
    const output = path.join(__dirname,'../release/previews');
    fs.mkdirSync(output,{recursive:true});
    for (const [width,height] of [[1440,1000],[390,844]]) {
      win.setContentSize(width,height);
      await run('scrollTo(0,0)');
      await delay(200);
      await check('website fits ' + width + 'px with readable text','document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1 && parseFloat(getComputedStyle(document.querySelector(".hero-description")).fontSize) >= 16');
      await check('download remains a direct public link at ' + width + 'px','[...document.querySelectorAll("#top-download-button,#download-button")].every(link=>link.href==="https://github.com/TeufelsKaan/novaclientfix/releases/latest/download/Nova-Client-Setup.exe")');
      await check('real launcher screenshot loads at ' + width + 'px','document.querySelector("#launcher-preview").naturalWidth===1424');
      fs.writeFileSync(path.join(output,'website-' + width + '.png'),(await win.webContents.capturePage()).toPNG());
    }
    await run('document.querySelector("#tab-mods").click();document.querySelector("#launcher-preview").decode()');
    await check('preview tabs change screenshot, caption and accessible selection','document.querySelector("#tab-mods").getAttribute("aria-selected")==="true"&&document.querySelector("#launcher-preview").src.endsWith("nova-mods.webp")&&document.querySelector("#preview-enlarge").href.endsWith("nova-mods.webp")&&document.querySelector("#preview-caption").textContent.includes("Mods durchsuchen")');
    await run('document.querySelector("#tab-mods").dispatchEvent(new KeyboardEvent("keydown",{key:"ArrowRight",bubbles:true}));document.querySelector("#launcher-preview").decode()');
    await check('preview tabs work from the keyboard','document.querySelector("#tab-settings").getAttribute("aria-selected")==="true"&&document.activeElement.id==="tab-settings"&&document.querySelector("#preview-panel").getAttribute("aria-labelledby")==="tab-settings"');
    await run('document.querySelector("details summary").click()');
    await check('FAQ expands without a script dependency','document.querySelector("details").open');
    await check('in-page navigation targets exist',`[...document.querySelectorAll('a[href^="#"]')].every(link=>document.querySelector(link.hash))`);
    await check('public page exposes the admin route','document.querySelector(".footer-admin-link").getAttribute("href")==="./admin.html"');
    await check('interface fonts do not depend on Google Fonts','![...document.querySelectorAll("link")].some(link=>link.href.includes("fonts.googleapis"))');
    win.setContentSize(1440,1000);
    await run('document.querySelector("#tab-play").click();scrollTo({top:document.querySelector("#funktionen").offsetTop-25,behavior:"instant"})');
    await delay(150);
    fs.writeFileSync(path.join(output,'website-features.png'),(await win.webContents.capturePage()).toPNG());
    await run('document.querySelector("#download").scrollIntoView({behavior:"instant"})');
    await delay(150);
    fs.writeFileSync(path.join(output,'website-download.png'),(await win.webContents.capturePage()).toPNG());
    await win.loadURL(new URL('/admin.html',base).href);
    await check('admin page and login form are present','document.title==="Nova Client — Admin"&&document.querySelector("#admin-email").type==="email"&&document.querySelector("#admin-password").type==="password"&&document.querySelector("#admin-tools").hidden');
    for (const [width,height] of [[1440,1000],[390,844]]) {
      win.setContentSize(width,height);
      await delay(150);
      await check('admin page fits ' + width + 'px','document.documentElement.scrollWidth<=document.documentElement.clientWidth+1');
      fs.writeFileSync(path.join(output,'website-admin-' + width + '.png'),(await win.webContents.capturePage()).toPNG());
    }
    console.log('Website checks complete. No authenticated admin session was used.');
    app.exit(0);
  } catch (error) { console.error(error);app.exit(1); }
});
