const {app,BrowserWindow}=require('electron');
const fs=require('node:fs');const path=require('node:path');const os=require('node:os');
app.setPath('userData',fs.mkdtempSync(path.join(os.tmpdir(),'nova-site-')));
app.whenReady().then(async()=>{
  try{
    const win=new BrowserWindow({width:1440,height:1000,show:false});
    await win.loadURL('http://127.0.0.1:4175');
    const output=path.join(__dirname,'../release/previews');fs.mkdirSync(output,{recursive:true});
    for(const [width,height] of [[1440,1000],[390,844]]){
      win.setContentSize(width,height);await new Promise(resolve=>setTimeout(resolve,350));
      const state=await win.webContents.executeJavaScript(`({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,paragraph:parseFloat(getComputedStyle(document.querySelector('.hero-content>p')).fontSize)})`);
      if(state.scroll>state.width+1||state.paragraph<16)throw new Error(JSON.stringify(state));
      const contained=await win.webContents.executeJavaScript(`(()=>{const bg=document.querySelector('.mod-showcase-bg').getBoundingClientRect();const card=document.querySelector('.mod-showcase-card').getBoundingClientRect();return bg.top>=card.top&&bg.bottom<=card.bottom&&bg.left>=card.left&&bg.right<=card.right})()`);
      if(!contained)throw new Error('Decorative background escapes its preview card');
      console.log(`PASS website fits ${width}px, hero text ${state.paragraph}px`);
      fs.writeFileSync(path.join(output,`website-${width}.png`),(await win.webContents.capturePage()).toPNG());
    }
    app.exit(0);
  }catch(error){console.error(error);app.exit(1);}
});
