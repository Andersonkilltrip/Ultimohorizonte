'use strict';
// PM_DIAG=folk: homens-peixe em Cocoyasi e Reis do Mar com sprites. Capturas + folk.json em %APPDATA%\Pirate MMO\diag
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const wait = ms => new Promise(r => setTimeout(r, ms));
module.exports = async function (win) {
  const out = path.join(app.getPath('userData'), 'diag'); fs.mkdirSync(out, { recursive: true });
  const wc = win.webContents, js = c => wc.executeJavaScript(c), R = { erros: [] };
  wc.on('console-message', e => { if (e && e.level === 'error' && R.erros.length < 10) R.erros.push(String(e.message).slice(0, 200)); });
  const shot = async n => { try { fs.writeFileSync(path.join(out, 'folk_' + n + '.png'), (await wc.capturePage()).toPNG()); } catch (e) {} };
  setTimeout(() => { R.falha = 'tempo esgotado'; fs.writeFileSync(path.join(out, 'folk.json'), JSON.stringify(R, null, 2)); app.exit(1); }, 120000);
  try {
    await new Promise(r => wc.once('did-finish-load', r));
    await js(`new Promise(r=>{(function w(){if(typeof ready!='undefined'&&ready&&window.UHFOLKNPC)r();else setTimeout(w,200)})()})`); await wait(1200);
    await js(`(()=>{const o=mk();o.name='Folk';start(o);const t=document.getElementById('title');if(t)t.style.display='none';return 1})()`); await wait(1500);
    R.gpd = await js(`Object.keys(GPD).filter(k=>k.startsWith('uh_'))`);
    await js(`(()=>{try{travel('eb_cocoyasi')}catch(e){return String(e)}return 1})()`); await wait(2500);
    R.cocoyasi = await js(`({CUR,npcs:UHFOLKNPC.map(f=>({nm:f.nm,gp:f.gp,x:Math.round(f.x),y:Math.round(f.y)}))})`);
    // herÃ³i ao lado do primeiro NPC e conversa
    await js(`(()=>{const f=UHFOLKNPC[0];if(!f)return 0;P.x=f.x+22;P.y=f.y;f.wait=8;UHFOLKNPC.forEach((g,i)=>{g.x=P.x+40+i*30;g.y=P.y+4;g.wait=8;g.dir=2});return 1})()`); await wait(900);
    await shot('cocoyasi');
    // Reis do Mar
    await js(`(()=>{OWN.owned=[0];OWN.cur=0;OWN.cust[0]={hc:null,sc:null,flag:0,name:'T',up:{}};OWN.hp[0]=shipStats(0,{}).res;enterSea('eb_cocoyasi');return 1})()`); await wait(1500);
    R.sk = await js(`(()=>{SK.length=0;const base={dg:1,hp:60,mhp:60,cd:99,t:0,dive:0,bt:0};const mk=(dx,dy,sp,st,ex)=>{const k=Object.assign({},base,{x:PS.x+dx,y:PS.y+dy,a:dx>0?Math.PI:0,st,ph:1,sp},ex||{});SK.push(k);return k};
      mk(-140,-40,'serpente','hunt');mk(130,-50,'serpente_azul','hunt');mk(0,90,'polvo','hunt');mk(-120,90,'serpente','bite',{bt:.4,hp:30});mk(140,80,'polvo','dead',{dt:.6});
      const old=skUpdate;window.__sku=old;skUpdate=function(){};return{n:SK.length,carregados:Object.fromEntries(Object.entries(UHSKI).map(([k,v])=>[k,Object.fromEntries(Object.entries(v).map(([a,b])=>[a,b.filter(i=>i.complete&&i.naturalWidth).length+'/'+b.length]))]))}})()`);
    await wait(1200); await shot('reis_do_mar');
  } catch (e) { R.falha = String(e && e.stack || e); }
  fs.writeFileSync(path.join(out, 'folk.json'), JSON.stringify(R, null, 2)); app.exit(0);
};
