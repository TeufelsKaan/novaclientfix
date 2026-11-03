const PREVIEW = new URLSearchParams(location.search).has('preview');
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const bridge = window.novaClient || null;
const fallbackCatalog = {
  gameVersion: '26.3', loader: 'fabric',
  profiles: {
    performance: { name: 'Nova Performance', description: 'Hohe FPS, schnelle Ladezeiten und ein sauberes HUD.', mods: ['sodium','lithium','ferrite-core','entityculling','dynamic-fps','modmenu','appleskin','jade','zoomify','nova-hud'] },
    pvp: { name: 'Nova PvP', description: 'Klare Sicht, Zoom und nützliche Kampf-Infos.', mods: ['sodium','lithium','entityculling','modmenu','appleskin','zoomify','nova-hud'] },
    explore: { name: 'Nova Explore', description: 'Minimap, Erkundungs-HUD und optional Shader.', mods: ['sodium','lithium','ferrite-core','iris','modmenu','appleskin','jade','xaeros-minimap','zoomify','nova-hud'] }
  },
  mods: [
    {slug:'sodium',name:'Sodium',category:'Performance',description:'Mehr Bilder pro Sekunde mit optimiertem Rendering.',default:true,hud:false},
    {slug:'lithium',name:'Lithium',category:'Performance',description:'Optimiert die Spiel-Logik für einen flüssigeren Ablauf.',default:true,hud:false},
    {slug:'ferrite-core',name:'FerriteCore',category:'Performance',description:'Reduziert den Speicherbedarf der Spielwelt.',default:true,hud:false},
    {slug:'entityculling',name:'Entity Culling',category:'Performance',description:'Zeichnet verdeckte Kreaturen und Blöcke nicht unnötig.',default:true,hud:false},
    {slug:'dynamic-fps',name:'Dynamic FPS',category:'Performance',description:'Spart Leistung, wenn Minecraft im Hintergrund läuft.',default:true,hud:false},
    {slug:'modmenu',name:'Mod Menu',category:'Werkzeuge',description:'Verwaltet installierte Mods direkt im Spielmenü.',default:true,hud:false},
    {slug:'appleskin',name:'AppleSkin',category:'HUD',description:'Zeigt Sättigung und den Wert von Nahrung an.',default:true,hud:true},
    {slug:'jade',name:'Jade',category:'HUD',description:'Zeigt Infos zu Blöcken und Kreaturen im Fadenkreuz.',default:true,hud:true},
    {slug:'xaeros-minimap',name:"Xaero's Minimap",category:'HUD',description:'Ergänzt eine anpassbare Minimap und Wegpunkte.',default:false,hud:true},
    {slug:'zoomify',name:'Zoomify',category:'HUD',description:'Fügt einen frei konfigurierbaren Zoom hinzu.',default:true,hud:true},
    {slug:'nova-hud',name:'Nova HUD',category:'HUD',description:'Eigenes Overlay für FPS, Koordinaten, Blickrichtung und Dimension.',default:true,hud:true,bundled:true},
    {slug:'iris',name:'Iris Shaders',category:'Grafik',description:'Ermöglicht Shader-Pakete zusammen mit Sodium.',default:false,hud:false}
  ]
};
let appState = { loggedIn:false, username:null, settings:{profile:'performance',gameVersion:fallbackCatalog.gameVersion,loader:fallbackCatalog.loader,loaderVersion:'',instanceSlug:'',modpackName:'',ramMB:4096,selectedMods:fallbackCatalog.mods.filter(m=>m.default).map(m=>m.slug),resolution:'1280x720'}, catalog:fallbackCatalog, gameVersion:fallbackCatalog.gameVersion, launchBusy:false };
let activeFilter='Alle';
let settingsTab='game';
let toastTimeout;
let minecraftVersionData={latestRelease:fallbackCatalog.gameVersion,latestSnapshot:'',versions:[{id:fallbackCatalog.gameVersion,type:'release'}]};
let updateState={status:'disabled',currentVersion:'0.4.0',nextVersion:null,percent:0,checkedAt:null,attemptedAt:null,errorCode:null};
const updateLabels={disabled:'Automatische Updates sind in der Windows-Installation verfügbar.',idle:'Nova sucht automatisch nach neuen Versionen.',checking:'Nova sucht nach Updates …',current:'Du nutzt die neueste verfügbare Version.',downloading:'Eine neue Version wird im Hintergrund geladen.',ready:'Dein Update ist bereit zur Installation.',installing:'Nova wird für das Update neu gestartet.',error:'Updates sind gerade nicht erreichbar. Nova versucht es später erneut.'};
const updateErrorLabels={channel_unavailable:'Der Update-Kanal ist noch nicht veröffentlicht oder nicht öffentlich erreichbar. Bitte versuche es später erneut.',network:'Die Verbindung zum Update-Server ist unterbrochen. Prüfe deine Internetverbindung und versuche es erneut.',integrity:'Der Update-Download ist beschädigt oder konnte nicht bestätigt werden. Er wird nicht installiert. Bitte lade das Update erneut.',server:'Der Update-Server hat die Anfrage abgelehnt oder ist vorübergehend nicht verfügbar. Bitte versuche es später erneut.'};
function receiveUpdateState(next){
  updateState={...updateState,...next};
  const button=$('#update-status-button');
  if(button){button.textContent=updateState.status==='ready'?'Update bereit':updateState.status==='downloading'?`Update ${Math.round(updateState.percent)} %`:'Updates';button.classList.toggle('update-ready',updateState.status==='ready');}
  if(settingsTab==='updates'&&$('#page-settings').classList.contains('active'))renderSettings();
}
function updateSettingsMarkup(){
  const busy=['checking','downloading','installing'].includes(updateState.status);
  const attempted=updateState.attemptedAt?new Date(updateState.attemptedAt).toLocaleString('de-DE'):'Noch kein Prüfversuch';
  const label=updateState.status==='error'?(updateErrorLabels[updateState.errorCode]||updateLabels.error):(updateLabels[updateState.status]||updateLabels.idle);
  return `<div class="setting-group"><div class="setting-label"><span>Nova Client ${escapeHtml(updateState.currentVersion)}</span><small>AUTOMATISCHE UPDATES</small></div><p class="update-message ${updateState.status==='error'?'update-error':''}" role="status">${escapeHtml(label)}</p>${updateState.nextVersion?`<p class="setting-help">Neue Version: ${escapeHtml(updateState.nextVersion)}</p>`:''}${updateState.status==='downloading'?`<progress class="update-download" max="100" value="${updateState.percent}">${Math.round(updateState.percent)} %</progress>`:''}<div class="account-actions"><button class="folder-button" id="check-updates" ${busy||updateState.status==='ready'||updateState.status==='disabled'?'disabled':''}>Nach Updates suchen</button>${updateState.status==='ready'?'<button class="save-button" id="install-update">Neustarten &amp; installieren</button>':''}</div><p class="setting-help">Letzter Prüfversuch: ${escapeHtml(attempted)}</p></div><div class="setting-group"><div class="setting-label">Neue Versionen kommen direkt zu dir.</div><p class="setting-help">Nova prüft beim Öffnen und alle 30 Minuten auf Updates. Neue Versionen werden automatisch heruntergeladen und beim Beenden installiert. Solange Minecraft läuft oder startet, wartet die Installation. Deine Welten, Mods und Einstellungen bleiben gespeichert.</p></div>`;
}
let modQuery = '';
let onlyEnabled = false;
const textSize = localStorage.getItem('nova-text-size') === 'large' ? 'large' : 'normal';
document.documentElement.dataset.textSize = textSize;

function toast(message){const node=$('#toast');node.textContent=message;node.classList.add('show');clearTimeout(toastTimeout);toastTimeout=setTimeout(()=>node.classList.remove('show'),2600);}
function selectedMods(){return new Set(appState.settings.selectedMods||[]);}
function countMods(){return selectedMods().size;}
function fmtRAM(){return Math.round(appState.settings.ramMB/1024*10)/10;}
function setText(selector,value){const el=$(selector);if(el)el.textContent=value;}
function persist(){return bridge?.saveSettings(appState.settings).then(s=>{if(s)appState={...appState,...s};renderHome();}).catch(e=>toast(e.message));}

function renderHome(){
  const profile=appState.catalog.profiles[appState.settings.profile]||appState.catalog.profiles.performance;
  setText('.setup-copy b',appState.settings.modpackName||profile.name);
  setText('.setup-copy span',`${String(appState.settings.loader||'fabric').toUpperCase()} · Minecraft Java ${appState.settings.gameVersion||appState.gameVersion}`);
  setText('.hero-footnote>span:last-child',`${String(appState.settings.loader||'fabric').toUpperCase()} ${appState.settings.gameVersion||appState.gameVersion}`);
  setText('.hud-caption span',appState.settings.gameVersion||appState.gameVersion);
  setText('#side-profile',profile.name);setText('#hero-profile',profile.name);setText('#active-mod-count',`${countMods()} MODS`);setText('#ram-summary',`${fmtRAM()} GB`);setText('#nav-mod-count',countMods());
  setText('#account-name',appState.username||'Gastpilot');setText('#account-status',appState.loggedIn?'Microsoft-Konto verbunden':'Nicht angemeldet');setText('#top-avatar',appState.username?.[0]?.toUpperCase()||'N');
  setText('#connection-label',appState.loggedIn?'KONTO VERBUNDEN':'OFFLINE-BEREIT');
  const active=appState.catalog.mods.filter(m=>selectedMods().has(m.slug));
  $('#mod-preview').innerHTML=active.slice(0,4).map((mod,i)=>`<article class="mod-preview-card"><i class="mod-preview-dot"></i><span class="mod-icon">${modIcon(mod.slug)}</span><strong>${escapeHtml(mod.name)}</strong><small>${escapeHtml(mod.category.toUpperCase())}</small></article>`).join('')||'<div class="empty-note">Wähle Mods in deiner Bibliothek aus.</div>';
  setText('#launch-status',appState.loggedIn?'KONTO BEREIT · SPIEL KANN STARTEN':'MICROSOFT-KONTO ZUM SPIELSTART VERBINDEN');
  $$('[data-hud-mod]').forEach(input=>input.checked=selectedMods().has(input.dataset.hudMod));
  $('#play-button').disabled=Boolean(appState.launchBusy);
}
function modIcon(slug){return ({sodium:'S',lithium:'L','ferrite-core':'F',entityculling:'E','dynamic-fps':'D',modmenu:'M',appleskin:'A',jade:'J','xaeros-minimap':'X',zoomify:'Z',iris:'I'})[slug]||'✦';}
function escapeHtml(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}

function renderMods(){
  const enabled=selectedMods();
  const versionPill=$('.version-pill');if(versionPill)versionPill.textContent=`${String(appState.settings.loader||'fabric').toUpperCase()} ${appState.settings.gameVersion||appState.gameVersion}`;
  $('#mods-grid').innerHTML=appState.catalog.mods.map(mod=>`<article class="mod-card" data-category="${escapeHtml(mod.category)}"><span class="mod-icon">${modIcon(mod.slug)}</span><div class="mod-card-copy"><strong>${escapeHtml(mod.name)}</strong><p>${escapeHtml(mod.description)}</p></div><label class="toggle" aria-label="${escapeHtml(mod.name)} aktivieren"><input type="checkbox" data-mod="${escapeHtml(mod.slug)}" ${enabled.has(mod.slug)?'checked':''}/><span></span></label><div class="mod-card-foot"><span class="mod-category">${escapeHtml(mod.category)}</span><span class="mod-installed">${enabled.has(mod.slug)?'FÜR INSTALLATION AKTIV':'AUSGESCHALTET'}</span></div></article>`).join('');
  applyFilter();
  $$('#mods-grid [data-mod]').forEach(input=>input.addEventListener('change',()=>{
    const mods=selectedMods();if(input.checked)mods.add(input.dataset.mod);else mods.delete(input.dataset.mod);
    appState.settings.selectedMods=[...mods];
    input.closest('.mod-card').querySelector('.mod-installed').textContent=input.checked?'FÜR INSTALLATION AKTIV':'AUSGESCHALTET';
    renderHome();applyFilter();persist();
  }));
}
function applyFilter(){
  let visible=0;
  $$('#mods-grid .mod-card').forEach(card=>{
    const slug=card.querySelector('[data-mod]').dataset.mod;
    const show=(activeFilter==='Alle'||card.dataset.category===activeFilter)&&card.textContent.toLocaleLowerCase('de').includes(modQuery)&&(!onlyEnabled||selectedMods().has(slug));
    card.classList.toggle('filtered-out',!show);if(show)visible++;
  });
  setText('#mod-result-count',`${visible} von ${appState.catalog.mods.length} Mods`);
  const empty=$('#mod-empty');if(empty)empty.hidden=visible>0;
}

function setPage(key){
  const allowed=['home','mods','hud','settings','about'];if(!allowed.includes(key)){key='about';}
  $$('.page').forEach(p=>p.classList.toggle('active',p.id===`page-${key}`));
  $$('.nav-item').forEach(n=>n.classList.toggle('active',n.dataset.page===key));
  setText('#page-name',({home:'ÜBERSICHT',mods:'MOD-BIBLIOTHEK',hud:'HUD & INTERFACE',settings:'EINSTELLUNGEN',about:'ÜBER NOVA'})[key]);
  if(key==='mods')renderMods();if(key==='settings')renderSettings();
  $('.page.active')?.scrollTo(0,0);
}

function profileModal(){
  $('#modal-kicker').textContent='DEIN SPIELSETUP';$('#modal-title').textContent='Profil wählen';
  const current=appState.settings.profile;
  $('#modal-body').innerHTML=`<div class="profile-options">${Object.entries(appState.catalog.profiles).map(([id,p])=>`<button class="profile-option ${id===current?'selected':''}" data-profile="${id}"><span class="profile-option-icon">${id==='performance'?'⚡':id==='pvp'?'◈':'✦'}</span><span><b>${escapeHtml(p.name)}</b><small>${escapeHtml(p.description)}</small></span><span>${id===current?'✓':''}</span></button>`).join('')}</div><p class="modal-note">Die Auswahl schlägt Mods vor. Deine persönliche Mod-Auswahl bleibt in der Bibliothek anpassbar.</p>`;
  $$('#modal-body [data-profile]').forEach(button=>button.addEventListener('click',async()=>{
    const id=button.dataset.profile;appState.settings.profile=id;appState.settings.selectedMods=[...appState.catalog.profiles[id].mods];
    closeModal();renderHome();await persist();toast(`${appState.catalog.profiles[id].name} ausgewählt`);
  }));
  $('#modal-scrim').classList.add('open');
}
function closeModal(){$('#modal-scrim').classList.remove('open');}

function renderSettings(){
  $$('.settings-tab').forEach(tab=>tab.classList.toggle('active',tab.dataset.settings===settingsTab));
  const c=$('#settings-content');
  if(settingsTab==='game')c.innerHTML=`<div class="setting-group"><div class="setting-label"><span>Spielprofil</span><small>Aktiver Mod-Stack</small></div><select id="setting-profile" class="setting-control">${Object.entries(appState.catalog.profiles).map(([id,p])=>`<option value="${id}" ${id===appState.settings.profile?'selected':''}>${escapeHtml(p.name)}</option>`).join('')}</select><p class="setting-help">Ein Wechsel übernimmt die empfohlenen Mods des Profils. Einzelne Mods kannst du danach anpassen.</p></div><div class="setting-group"><div class="setting-label"><span>Fensterauflösung</span><small>Beim Spielstart</small></div><select id="setting-resolution" class="setting-control"><option value="1280x720">1280 × 720</option><option value="1600x900">1600 × 900</option><option value="1920x1080">1920 × 1080</option></select><p class="setting-help">Minecraft läuft im Fenstermodus. Vollbild kannst du im Spiel umschalten.</p></div><div class="setting-group"><div class="setting-label"><span>Spielordner</span><small>Windows AppData</small></div><button class="folder-button" id="setting-folder">Nova-Spielordner öffnen ↗</button><p class="setting-help">Spielstände und Screenshots bleiben im Minecraft-Ordner.</p></div>`;
  if(settingsTab==='game')c.insertAdjacentHTML('afterbegin',`<div class="setting-group"><div class="setting-label"><span>Minecraft-Version</span><small>ALLE OFFIZIELLEN JAVA-VERSIONEN</small></div><select id="setting-minecraft-version" class="setting-control">${minecraftVersionData.versions.map(v=>`<option value="${escapeHtml(v.id)}" ${v.id===appState.settings.gameVersion?'selected':''}>${escapeHtml(v.id)}${v.type==='snapshot'?' · Snapshot':''}</option>`).join('')}</select><p class="setting-help" id="version-catalog-note">${minecraftVersionData.versions.length} Versionen · Neueste Veröffentlichung: ${escapeHtml(minecraftVersionData.latestRelease)}</p></div><div class="setting-group"><div class="setting-label"><span>Mod-Loader</span><small id="loader-version-label">WIRD GELADEN</small></div><select id="setting-loader" class="setting-control"><option value="vanilla">Vanilla</option><option value="fabric">Fabric</option><option value="quilt">Quilt</option><option value="forge">Forge</option><option value="neoforge">NeoForge</option></select><select id="setting-loader-version" class="setting-control" aria-label="Loader-Version" style="margin-top:10px"><option>Versionen werden geladen …</option></select><p class="setting-help">Nova lädt automatisch die ausgewählte Loader-Version passend zu Minecraft herunter.</p></div><div class="setting-group"><div class="setting-label"><span>Modpack hinzufügen</span><small>MODRINTH ODER CURSEFORGE</small></div><input id="modpack-url" class="setting-control" type="url" placeholder="Modrinth-Link oder direkter Modpack-Link"/><div class="account-actions"><button class="folder-button" id="import-pack-link">Link importieren</button><button class="folder-button" id="import-pack-file">Datei öffnen</button></div><p class="setting-help">Modrinth-Projektlinks und .mrpack-Dateien funktionieren direkt. CurseForge-Exporte kannst du als .zip-Datei wählen oder direkten .zip-Link einfügen. Manche CurseForge-Dateien benötigen einen genehmigten API-Schlüssel.</p>${appState.settings.modpackName?`<p class="setting-help">Aktives Modpack: <b>${escapeHtml(appState.settings.modpackName)}</b></p>`:''}</div>`);
  if(settingsTab==='game'){
    $('#setting-loader').value=appState.settings.loader;
    $('#setting-minecraft-version').value=appState.settings.gameVersion;
    const refreshLoaderVersions=async()=>{
      const version=appState.settings.gameVersion;
      const loader=$('#setting-loader').value;
      const select=$('#setting-loader-version');
      const label=$('#loader-version-label');
      if(loader==='vanilla'){select.hidden=true;label.textContent='OHNE MOD-LOADER';return;}
      select.hidden=false;select.innerHTML='<option>Kompatible Versionen werden geladen …</option>';label.textContent='KOMPATIBLE VERSIONEN';
      try{
        const versions=bridge?await bridge.getLoaderVersions(version,loader):[loader==='forge'?`${version}-66.1.0`:loader==='quilt'?'0.20.0':'0.20.1'];
        if(!versions.length){select.innerHTML='<option value="">Keine passende Version gefunden</option>';return;}
        select.innerHTML=versions.map(v=>`<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('');
        select.value=versions.includes(appState.settings.loaderVersion)?appState.settings.loaderVersion:versions[0];
        appState.settings.loaderVersion=select.value;
      }catch(error){select.innerHTML='<option value="">Versionen nicht erreichbar</option>';label.textContent='VERBINDUNG PRÜFEN';}
    };
    $('#setting-minecraft-version').onchange=()=>{appState.settings.gameVersion=$('#setting-minecraft-version').value;appState.settings.loaderVersion='';appState.settings.instanceSlug='';appState.settings.modpackName='';refreshLoaderVersions();};
    $('#setting-loader').onchange=()=>{appState.settings.loader=$('#setting-loader').value;appState.settings.loaderVersion='';appState.settings.instanceSlug='';appState.settings.modpackName='';refreshLoaderVersions();};
    $('#setting-loader-version').onchange=()=>appState.settings.loaderVersion=$('#setting-loader-version').value;
    refreshLoaderVersions();
    const runImport=async url=>{
      if(!bridge){toast('Modpack-Import ist in der installierten Windows-App verfügbar.');return;}
      const result=await bridge.importModpack(url);
      if(result?.ok){appState={...appState,...result.state};renderHome();renderSettings();toast(`${result.pack.name} wurde importiert.`);}
      else if(!result?.canceled)toast(result?.error||'Das Modpack konnte nicht importiert werden.');
    };
    $('#import-pack-link').onclick=()=>runImport($('#modpack-url').value);
    $('#import-pack-file').onclick=()=>runImport('');
  }
  if(settingsTab==='memory')c.innerHTML=`<div class="setting-group"><div class="setting-label"><span>Arbeitsspeicher</span><small><b id="ram-label">${fmtRAM()}</b> GB zuweisen</small></div><input id="ram-slider" class="setting-range" type="range" min="2048" max="12288" step="512" value="${appState.settings.ramMB}"/><div class="range-values"><span>2 GB</span><span>12 GB</span></div><p class="setting-help">Nova lädt die passende Java-Laufzeit automatisch. Lass mindestens 2 GB für Windows und andere Programme frei.</p></div><div class="setting-group"><div class="setting-label"><span>Java verwalten</span><small>AUTOMATISCH</small></div><p class="setting-help">Beim ersten Spielstart lädt Nova eine passende Java-Laufzeit herunter und prüft sie vor jedem Start.</p></div>`;
  if(settingsTab==='account')c.innerHTML=`<div class="setting-group"><div class="setting-label"><span>Microsoft-Konto</span><small>${appState.loggedIn?'VERBUNDEN':'NICHT VERBUNDEN'}</small></div><p class="setting-help">${appState.loggedIn?`Angemeldet als ${escapeHtml(appState.username||'Minecraft-Spieler')}. Dein verschlüsseltes Konto liegt lokal auf diesem Windows-PC.`:'Melde dich mit deinem Microsoft-Konto an. Nova speichert die Anmeldedaten verschlüsselt im Windows-Benutzerkonto.'}</p><div class="account-actions"><button class="folder-button" id="account-action">${appState.loggedIn?'Abmelden':'Microsoft-Konto verbinden'}</button><button class="danger-button" id="clear-account">Lokale Anmeldung löschen</button></div></div><div class="setting-group"><div class="setting-label"><span>Datenschutz</span><small>LOKAL</small></div><p class="setting-help">Nova sendet keine Spielstände oder Mod-Einstellungen an einen Nova-Server. Mod-Dateien werden über die Modrinth-API bezogen.</p></div>`;
  if(settingsTab==='appearance')c.innerHTML=`<div class="setting-group"><label class="setting-label" for="text-size"><span>Schriftgröße</span><small>SOFORT SICHTBAR</small></label><select id="text-size" class="setting-control"><option value="normal">Groß · 16 px</option><option value="large">Extra groß · 18 px</option></select><p class="setting-help">Die gesamte Oberfläche passt sich deiner Auswahl an. Nova merkt sich die Schriftgröße auf diesem PC.</p></div><div class="setting-group"><div class="setting-label">Gut lesbar, klar bedienbar</div><p class="setting-help">Größere Schaltflächen, kontrastreiche Texte und sichtbare Tastaturmarkierungen helfen dir bei jeder Einstellung. Mit Strg + K öffnest du die Mod-Suche.</p></div>`;
  if(settingsTab==='updates')c.innerHTML=updateSettingsMarkup();
  $('#check-updates')?.addEventListener('click',async()=>{try{receiveUpdateState(await bridge.checkUpdates());}catch{receiveUpdateState({status:'error',errorCode:'unknown'});}});
  $('#install-update')?.addEventListener('click',async()=>{try{const result=await bridge.installUpdate();if(!result.ok)toast(result.error);}catch{toast('Die Installation konnte nicht gestartet werden.');}});
  const size=$('#text-size');if(size){size.value=document.documentElement.dataset.textSize;size.onchange=()=>{document.documentElement.dataset.textSize=size.value;localStorage.setItem('nova-text-size',size.value);toast('Schriftgröße gespeichert.');};}
  const profile=$('#setting-profile');if(profile)profile.onchange=()=>applyProfile(profile.value);
  const resolution=$('#setting-resolution');if(resolution){resolution.value=appState.settings.resolution;resolution.onchange=()=>appState.settings.resolution=resolution.value;}
  const slider=$('#ram-slider');if(slider)slider.oninput=()=>{appState.settings.ramMB=Number(slider.value);setText('#ram-label',fmtRAM());};
  $('#setting-folder')?.addEventListener('click',()=>bridge?.openGameFolder());
  $('#account-action')?.addEventListener('click',()=>appState.loggedIn?logout():login());
  $('#clear-account')?.addEventListener('click',()=>logout());
}
async function applyProfile(id){if(!appState.catalog.profiles[id])return;appState.settings.profile=id;appState.settings.selectedMods=[...appState.catalog.profiles[id].mods];renderSettings();renderHome();await persist();toast(`${appState.catalog.profiles[id].name} ausgewählt`);}

function setProgress(payload){
  if(!payload)return;const scrim=$('#progress-scrim');
  $('#progress-dismiss').hidden=payload.stage!=='error';
  if(['error','closed','launched'].includes(payload.stage)){
    if(payload.stage==='error'){scrim.classList.add('open');setText('#progress-title','Der Start braucht noch einen Schritt.');setText('#progress-detail',payload.detail||'Bitte prüfe deine Verbindung und Einstellungen.');$('#progress-fill').style.background='#f5a589';}
    else {scrim.classList.remove('open');toast(payload.detail||'');}
    setText('#launch-status',payload.detail||'BEREIT ZUM SPIELEN');appState.launchBusy=false;$('#play-button').disabled=false;return;
  }
  scrim.classList.add('open');appState.launchBusy=true;$('#play-button').disabled=true;
  const names={prepare:'NOVA BEREITET ALLES VOR.',mods:'MODS WERDEN EINGERICHTET.',download:'SPIELDATEIEN WERDEN GELADEN.',loader:`${String(appState.settings.loader||'fabric').toUpperCase()} WIRD EINGERICHTET.`,java:'JAVA WIRD GEPRÜFT.',launch:'MINECRAFT STARTET.',game:'MINECRAFT LÄUFT.'};
  setText('#progress-title',names[payload.stage]||'NOVA BEREITET ALLES VOR.');setText('#progress-detail',payload.detail||'Einen Moment bitte …');setText('#progress-stage',(payload.stage||'prepare').toUpperCase());
  if(typeof payload.percent==='number'){$('#progress-fill').classList.remove('indeterminate');const pct=Math.max(0,Math.min(100,payload.percent));$('#progress-fill').style.width=`${pct}%`;setText('#progress-percent',`${pct}%`);}
  else {$('#progress-fill').style.width='';$('#progress-fill').classList.add('indeterminate');setText('#progress-percent','…');}
}
async function login(){
  if(!bridge){toast('Die Microsoft-Anmeldung ist in der installierten Windows-App verfügbar.');return;}
  const result=await bridge.login();if(!result?.ok){toast(result?.error||'Anmeldung abgebrochen.');return;}
  appState={...appState,...result.state};renderHome();renderSettings();toast(`Willkommen${appState.username?`, ${appState.username}`:''}!`);
}
async function logout(){if(!bridge)return;appState=await bridge.logout();renderHome();renderSettings();toast('Lokale Anmeldung entfernt.');}
async function launch(){
  if(!bridge){toast('Der Spielstart funktioniert in der installierten Nova-App.');return;}
  await persist();
  if(!appState.loggedIn){await login();if(!appState.loggedIn)return;}
  $('#progress-fill').style.width='0%';$('#progress-fill').classList.remove('indeterminate');
  $('#progress-fill').style.background='';$('#progress-dismiss').hidden=true;
  $('#progress-scrim').classList.add('open');setText('#progress-title','Nova bereitet alles vor.');setText('#progress-detail',`${String(appState.settings.loader||'fabric').toUpperCase()}, Java und deine Mods werden eingerichtet.`);
  appState.launchBusy=true;$('#play-button').disabled=true;
  const result=await bridge.launch();if(!result?.ok){setProgress({stage:'error',detail:result?.error||'Der Start ist fehlgeschlagen.'});}
}

function bindEvents(){
  $('#update-status-button').addEventListener('click',()=>{settingsTab='updates';setPage('settings');});
  $$('.nav-item,[data-page]').forEach(button=>button.addEventListener('click',()=>setPage(button.dataset.page)));
  $('#profile-select').addEventListener('click',profileModal);$('#side-profile-btn').addEventListener('click',profileModal);
  $('#modal-x').addEventListener('click',closeModal);$('#modal-scrim').addEventListener('click',e=>{if(e.target.id==='modal-scrim')closeModal();});
  $$('.filter-tab').forEach(tab=>tab.addEventListener('click',()=>{$$('.filter-tab').forEach(t=>t.classList.toggle('active',t===tab));activeFilter=tab.dataset.filter;applyFilter();}));
  $$('.settings-tab').forEach(tab=>tab.addEventListener('click',()=>{settingsTab=tab.dataset.settings;renderSettings();}));
  $('#save-settings').addEventListener('click',async()=>{await persist();setText('#settings-saved','Einstellungen wurden auf diesem PC gespeichert.');toast('Einstellungen gespeichert.');});
  $('#play-button').addEventListener('click',launch);$('#about-play').addEventListener('click',launch);
  const openAccount=()=>{if(appState.loggedIn){settingsTab='account';setPage('settings');}else login();};
  $('#account-card').addEventListener('click',openAccount);$('#top-avatar').addEventListener('click',openAccount);
  $('.brand').addEventListener('click',e=>{e.preventDefault();setPage('home');});
  $('#open-game-folder').addEventListener('click',()=>bridge?.openGameFolder());
  $('#open-website').addEventListener('click',()=>bridge?.openWebsite?.());
  $('#mod-search').addEventListener('input',e=>{modQuery=e.target.value.trim().toLocaleLowerCase('de');applyFilter();});
  $('#only-enabled').addEventListener('change',e=>{onlyEnabled=e.target.checked;applyFilter();});
  $('#progress-dismiss').addEventListener('click',()=>$('#progress-scrim').classList.remove('open'));
  $('#side-profile-btn').title='Spielprofil auswählen';
  $$('[data-hud-mod]').forEach(input=>input.setAttribute('aria-label',input.closest('.hud-option').querySelector('b').textContent));
  $$('[data-hud-mod]').forEach(input=>input.addEventListener('change',()=>{
    const mods=selectedMods();if(input.checked)mods.add(input.dataset.hudMod);else mods.delete(input.dataset.hudMod);appState.settings.selectedMods=[...mods];renderHome();persist();toast(`${input.dataset.hudMod} ${input.checked?'aktiviert':'deaktiviert'}`);
  }));
  document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeModal();$('#progress-scrim').classList.remove('open');}});
  document.addEventListener('keydown',e=>{if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'){e.preventDefault();setPage('mods');$('#mod-search').focus();}});
}

async function init(){
  bindEvents();
  if(bridge){try{bridge.onUpdateState(receiveUpdateState);appState={...appState,...await bridge.getState()};minecraftVersionData=await bridge.getMinecraftVersions();bridge.onProgress(setProgress);receiveUpdateState(await bridge.getUpdateState());}catch(e){toast('Versionsliste nicht erreichbar. Eine erneute Prüfung ist unter Einstellungen möglich.');}}
  renderHome();renderMods();renderSettings();
  $$('#page-hud [data-hud-mod]').forEach(input=>input.checked=selectedMods().has(input.dataset.hudMod));
  if(PREVIEW)toast('Nova Client Vorschau · Demomodus');
}
init();
