// Real electron-updater integration checks. The isolated adapter cannot install or relaunch.
const {app}=require('electron');
const {NsisUpdater}=require('electron-updater');
const {createUpdateService}=require('../electron/updates.cjs');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const http=require('node:http'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'nova-update-check-'));
app.setPath('userData',path.join(root,'app'));
app.whenReady().then(async()=>{
  const version=require('../package.json').version;
  const filename=`Nova-Client-Setup-${version}.exe`;
  const payload=process.argv.includes('--release')?fs.readFileSync(path.join(__dirname,'../release',filename)):Buffer.concat([Buffer.from('MZ'),Buffer.alloc(4096,7)]);
  const checksum=crypto.createHash('sha512').update(payload).digest('base64');
  let mode='valid';
  const server=http.createServer((request,response)=>{
    const pathname=new URL(request.url,'http://localhost').pathname;
    if(mode==='offline'){response.destroy();return;}
    if(mode==='missing'){response.writeHead(404).end('Not found');return;}
    if(pathname==='/latest.yml')response.end(`version: ${mode==='current'?'0.3.0':version}\nfiles:\n  - url: ${filename}\n    sha512: ${checksum}\n    size: ${payload.length}\npath: ${filename}\nsha512: ${checksum}\n`);
    else if(pathname===`/${filename}`){
      const bytes=Buffer.from(payload);if(mode==='corrupt')bytes[50]^=1;
      response.writeHead(200,{'Content-Length':bytes.length,'Content-Type':'application/octet-stream'});response.end(bytes);
    }else response.writeHead(404).end();
  });
  try{
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    for(const scenario of ['valid','corrupt','missing','offline','current','retry']){
      mode=scenario==='retry'?'missing':scenario;
      const config=path.join(root,`${scenario}.yml`);
      fs.writeFileSync(config,`updaterCacheDirName: ${scenario}\n`);
      const adapter={version:'0.3.0',name:'Nova Update Test',isPackaged:true,appUpdateConfigPath:config,userDataPath:root,baseCachePath:root,whenReady:()=>Promise.resolve(),onQuit:()=>{},quit:()=>{throw new Error('Test cannot install');},relaunch:()=>{throw new Error('Test cannot relaunch');}};
      const updater=new NsisUpdater(null,adapter);
      updater.httpExecutor=new (require('electron-updater/out/electronHttpExecutor').ElectronHttpExecutor)();
      updater.setFeedURL({provider:'generic',url:`http://127.0.0.1:${server.address().port}/`});
      updater.disableDifferentialDownload=true;updater.logger={info(){},warn(){},error(){},debug(){}};
      let finish;
      const service=createUpdateService({updater,enabled:true,version:'0.3.0',onState:state=>{if(['ready','error','current'].includes(state.status))finish?.(state);}});
      const attempt=()=>{
        const complete=new Promise((resolve,reject)=>{
          const timeout=setTimeout(()=>reject(new Error(`Timeout: ${scenario}`)),30000);
          finish=state=>{clearTimeout(timeout);resolve(state);};
        });
        return Promise.all([service.check(),complete]).then(([,state])=>state);
      };
      let state=await attempt();
      assert.ok(state.attemptedAt);
      if(scenario==='retry'){
        assert.equal(state.errorCode,'channel_unavailable');mode='valid';state=await attempt();assert.equal(state.status,'ready');assert.equal(state.errorCode,null);console.log('PASS real updater retries successfully after HTTP 404');
      }else if(scenario==='valid'){
        assert.equal(state.status,'ready');assert.equal(state.nextVersion,version);
        const saved=fs.readFileSync(path.join(root,scenario,'pending',filename));assert.equal(crypto.createHash('sha512').update(saved).digest('base64'),checksum);
        console.log(`PASS real updater 0.3.0 downloads and verifies ${version}${process.argv.includes('--release')?' Windows installer':''}`);
      }else if(scenario==='current'){
        assert.equal(state.status,'current');assert.equal(state.errorCode,null);console.log('PASS same version does not trigger a download');
      }else{
        assert.equal(state.status,'error');assert.equal(state.errorCode,{missing:'channel_unavailable',offline:'network',corrupt:'integrity'}[scenario]);assert.equal(service.install().ok,false);console.log(`PASS real updater classifies ${scenario} failure and prevents installation`);
      }
      service.stop();
    }
    server.close();app.exit(0);
  }catch(error){console.error(error);server.close();app.exit(1);}
});
