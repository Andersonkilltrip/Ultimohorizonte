'use strict';
// PM_DIAG=hostil: ilha hostil x ilha com vila (inimigos), homens-peixe inimigos e curva de nível.
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const wait = ms => new Promise(r => setTimeout(r, ms));
module.exports = async function (win) {
  const out = path.join(app.getPath('userData'), 'diag'); fs.mkdirSync(out, { recursive: true });
  const wc = win.webContents, js = c => wc.executeJavaScript(c), R = { erros: [] };
  wc.on('console-message', e => { if (e && e.level === 'error' && R.erros.length < 10) R.erros.push(String(e.message).slice(0, 200)); });
  const shot = async n => { try { fs.writeFileSync(path.join(out, 'hostil_' + n + '.png'), (await wc.capturePage()).toPNG()); } catch (e) {} };
  setTimeout(() => { R.falha = 'tempo esgotado'; fs.writeFileSync(path.join(out, 'hostil.json'), JSON.stringify(R, null, 2)); app.exit(1); }, 150000);
  try {
    await new Promise(r => wc.once('did-finish-load', r));
    await js(`new Promise(r=>{(function w(){if(typeof ready!='undefined'&&ready&&window.UHHOSTILE)r();else setTimeout(w,200)})()})`); await wait(1200);
    await js(`(()=>{const o=mk();o.name='Hostil';start(o);const t=document.getElementById('title');if(t)t.style.display='none';return 1})()`); await wait(1500);
    R.ilhas = await js(`(()=>{const L=[];for(let cx=-6;cx<=12;cx++)for(let cy=-6;cy<=6;cy++)for(const o of WORLD.chunk(cx,cy).isl)if(o.id>1e6)L.push({id:o.id,kind:o.kind});
      const h=L.find(o=>UHHOSTILE('isl:'+o.id)),v=L.find(o=>o.kind==='town'&&!UHHOSTILE('isl:'+o.id));const cont={};L.forEach(o=>{const k=o.kind+(UHHOSTILE('isl:'+o.id)?'_hostil':'');cont[k]=(cont[k]||0)+1});window.__H=h;window.__V=v;return{hostil:h,vila:v,contagem:cont}})()`);
    const ilha = async (q, nome) => {
      await js(`(()=>{travel('isl:'+${q}.id);return 1})()`); await wait(2500);
      const r = await js(`(()=>{purgeCityEnemies();const S=IS[CUR];return{CUR,hostil:!!S.hostile,lvl:S.lvl,predios:HO.length,inimigos:en.filter(e=>e.st!=='dead').length,homensPeixe:en.filter(e=>e.gp).map(e=>e.nm).slice(0,6),chefe:en.filter(e=>e.boss).length}})()`);
      R[nome] = r;
      // herói perto de um inimigo para a captura
      await js(`(()=>{const e=en.find(x=>x.gp)||en.find(x=>!x.boss);if(e){P.x=e.x-60;P.y=e.y+10;e.x=P.x+40;e.y=P.y;e.st='idle'}return 1})()`); await wait(900); await shot(nome);
    };
    await ilha('__H', 'ilha_hostil');
    await ilha('__V', 'ilha_com_vila');
    R.nivel = await js(`(()=>{const L=[];for(const l of [1,2,5,10,20,30,50,60,99])L.push(l+':'+xpNeed(l));P.lv=1;P.xp=0;const mhp0=P.mhp,sp0=P.sp||0;gain(xpNeed(1)+xpNeed(2)+xpNeed(3)+xpNeed(4)+2,'teste');
      return{curva:L.join(' '),nivelDepois:P.lv,vidaMax:[mhp0,P.mhp],pontos:[sp0,P.sp],xpBarra:+UHXPV().toFixed(2)}})()`);
  } catch (e) { R.falha = String(e && e.stack || e); }
  fs.writeFileSync(path.join(out, 'hostil.json'), JSON.stringify(R, null, 2)); app.exit(0);
};
