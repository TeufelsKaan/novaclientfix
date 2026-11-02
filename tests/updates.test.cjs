const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createUpdateService, classifyUpdateError } = require('../electron/updates.cjs');
function harness(options={}) {
  const updater=new EventEmitter();let checks=0,downloads=0,installs=0;
  updater.checkForUpdates=async()=>{checks++;updater.emit('update-not-available');};
  updater.downloadUpdate=async()=>{downloads++;};
  updater.quitAndInstall=()=>{installs++;};
  const service=createUpdateService({updater,enabled:true,version:'0.3.0',...options});
  return {updater,service,counts:()=>({checks,downloads,installs})};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('development mode never contacts the update server or installs',async()=>{
  const h=harness({enabled:false});await h.service.check();h.service.start();assert.equal(h.service.state().status,'disabled');assert.equal(h.service.install().ok,false);assert.deepEqual(h.counts(),{checks:0,downloads:0,installs:0});h.service.stop();
});
test('automatic startup and manual checks report current status',async()=>{
  const h=harness();h.service.start();h.service.start();await tick();assert.equal(h.counts().checks,1);assert.equal(h.service.state().status,'current');assert.ok(h.service.state().checkedAt);h.service.stop();
});
test('an available update downloads automatically and exposes progress',async()=>{
  const h=harness();h.updater.emit('update-available',{version:'0.4.0'});await tick();assert.equal(h.counts().downloads,1);assert.equal(h.service.state().status,'downloading');h.updater.emit('download-progress',{percent:42.5});assert.equal(h.service.state().percent,42.5);await h.service.check();assert.equal(h.counts().checks,0);h.updater.emit('update-downloaded',{version:'0.4.0'});assert.equal(h.service.state().status,'ready');assert.equal(h.service.state().percent,100);assert.equal(h.service.state().nextVersion,'0.4.0');h.service.stop();
});
test('installation is impossible before verification and waits for the game',()=>{
  let busy=true;const h=harness({canInstall:()=>!busy});assert.equal(h.service.install().ok,false);h.updater.emit('update-downloaded',{version:'0.4.0'});assert.equal(h.service.install().ok,false);h.service.prepareQuit();assert.equal(h.updater.autoInstallOnAppQuit,false);assert.equal(h.counts().installs,0);busy=false;h.service.prepareQuit();assert.equal(h.updater.autoInstallOnAppQuit,true);assert.equal(h.service.install().ok,true);assert.equal(h.counts().installs,1);assert.equal(h.service.install().ok,false);h.service.stop();
});
test('network failure leaves the launcher usable and manual retry succeeds',async()=>{
  const h=harness();h.updater.checkForUpdates=async()=>{throw new Error('offline');};await h.service.check();assert.equal(h.service.state().status,'error');h.updater.checkForUpdates=async()=>h.updater.emit('update-not-available');await h.service.check();assert.equal(h.service.state().status,'current');h.service.stop();
});
test('failed download never marks an update ready',async()=>{
  const h=harness();h.updater.downloadUpdate=async()=>{throw new Error('checksum mismatch');};h.updater.emit('update-available',{version:'0.4.0'});await tick();assert.equal(h.service.state().status,'error');assert.equal(h.service.install().ok,false);h.service.stop();
});
test('concurrent checks share one update request',async()=>{
  const h=harness();let count=0,done;h.updater.checkForUpdates=()=>{count++;return new Promise(resolve=>{done=resolve;});};const first=h.service.check();await h.service.check();assert.equal(count,1);done();await first;h.service.stop();
});
test('a stopped service removes listeners and prevents further checks',async()=>{
  const h=harness();h.service.stop();await h.service.check();assert.equal(h.updater.listenerCount('update-available'),0);assert.equal(h.counts().checks,0);
});
test('errors are classified without sending raw server details to the renderer',()=>{
  for(const error of [{statusCode:404},{code:'HTTP_ERROR_404'},{code:'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND'}])assert.equal(classifyUpdateError(error),'channel_unavailable');
  for(const error of [{code:'ERR_CHECKSUM_MISMATCH'},{code:'ERR_UPDATER_INVALID_SIGNATURE'},new Error('sha512 checksum mismatch')])assert.equal(classifyUpdateError(error),'integrity');
  for(const error of [{code:'ENOTFOUND'},{code:'ECONNREFUSED'},new Error('net::ERR_INTERNET_DISCONNECTED'),new Error('net::ERR_EMPTY_RESPONSE')])assert.equal(classifyUpdateError(error),'network');
  assert.equal(classifyUpdateError({statusCode:503}),'server');assert.equal(classifyUpdateError(null),'unknown');
});
test('a failed check records its attempt and does not invent a successful check',async()=>{
  const h=harness({now:()=> '2026-11-02T21:00:00.000Z'});
  h.updater.checkForUpdates=async()=>{throw Object.assign(new Error('private raw details'),{code:'ERR_UPDATER_CHANNEL_FILE_NOT_FOUND'});};
  await h.service.check();const state=h.service.state();assert.equal(state.attemptedAt,'2026-11-02T21:00:00.000Z');assert.equal(state.checkedAt,null);assert.equal(state.errorCode,'channel_unavailable');assert.ok(!JSON.stringify(state).includes('private raw details'));h.service.stop();
});
test('retry clears the last error and records a new attempt while preserving the last success',async()=>{
  let time='2026-11-02T21:00:00.000Z';const h=harness({now:()=>time});await h.service.check();const success=h.service.state().checkedAt;
  time='2026-11-02T21:01:00.000Z';h.updater.checkForUpdates=async()=>{throw Object.assign(new Error('offline'),{code:'ENOTFOUND'});};await h.service.check();assert.equal(h.service.state().errorCode,'network');assert.equal(h.service.state().checkedAt,success);assert.equal(h.service.state().attemptedAt,time);
  time='2026-11-02T21:02:00.000Z';h.updater.checkForUpdates=async()=>h.updater.emit('update-not-available');await h.service.check();assert.equal(h.service.state().errorCode,null);assert.equal(h.service.state().status,'current');assert.equal(h.service.state().attemptedAt,time);assert.equal(h.service.state().checkedAt,time);h.service.stop();
});
