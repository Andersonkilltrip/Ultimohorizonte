'use strict';
// Diagnóstico visual do mar (PM_DIAG=mar). Mede, quadro a quadro, o deslocamento aplicado às texturas da água
// (A = fundo, B = ondas/espuma) em px de mundo por segundo, nos cenários pedidos. Funciona no v67 (fórmula antiga
// tm*sp) e no v68 (SEAVIS). Salva capturas em %APPDATA%\Pirate MMO\diag\mar_*.png e o resultado em mar.json.
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const wait = ms => new Promise(r => setTimeout(r, ms));

const MEDIR = `window.__medir=function(ms){return new Promise(res=>{
 const novo=typeof SEAVIS!='undefined';
 const off=()=>{if(novo)return{A:[SEAVIS.offA[0],SEAVIS.offA[1]],B:[SEAVIS.offB[0],SEAVIS.offB[1]]};
   const wa=WX.wa||0,sp=6+(WX.ws||0)*14;return{A:[Math.cos(wa)*tm*sp*.5,Math.sin(wa)*tm*sp*.5],B:[Math.cos(wa)*tm*sp*1.2+Math.sin(tm*.4)*4,Math.sin(wa)*tm*sp*1.2]}};
 let p=off(),pa=0,pb=0,pmax=0,n=0;const p0=off(),t0=performance.now(),x0=PS.x,y0=PS.y,c0={x:SEACAM.x,y:SEACAM.y};
 (function f(){const q=off(),db=Math.hypot(q.B[0]-p.B[0],q.B[1]-p.B[1]);pa+=Math.hypot(q.A[0]-p.A[0],q.A[1]-p.A[1]);pb+=db;pmax=Math.max(pmax,db);p=q;n++;
  if(performance.now()-t0<ms)requestAnimationFrame(f);else{const s=(performance.now()-t0)/1000;
   res({texturaFundo:+(pa/s).toFixed(1),texturaOndas:+(pb/s).toFixed(1),maiorSaltoPorQuadro:+pmax.toFixed(2),
     ondasSpriteQuadrosPorS:+(8*.7*(novo?SEAVIS.ondulacao:1)).toFixed(2),navio:+(Math.hypot(PS.x-x0,PS.y-y0)/s).toFixed(1),camera:+(Math.hypot(SEACAM.x-c0.x,SEACAM.y-c0.y)/s).toFixed(1),
     fps:Math.round(n/s),vento:+WX.ws.toFixed(2),clima:WXS[WX.st].n,tm:Math.round(tm)})}})()})};1`;

module.exports = async function diagMar(win) {
  const out = path.join(app.getPath('userData'), 'diag');
  fs.mkdirSync(out, { recursive: true });
  const wc = win.webContents, js = c => wc.executeJavaScript(c);
  const R = { versao: null, casos: [] };
  const shot = async n => { try { fs.writeFileSync(path.join(out, 'mar_' + R.versao + '_' + n + '.png'), (await wc.capturePage()).toPNG()); } catch (e) {} };
  try {
    await new Promise(r => wc.once('did-finish-load', r));
    await js(`new Promise(r=>{(function w(){if(typeof ready!='undefined'&&ready&&window.UHUI&&typeof start=='function'&&start.toString().length)r();else setTimeout(w,200)})()})`);
    await wait(1500);
    R.versao = await js(`typeof SEAVIS!='undefined'?'v68':'v67'`);
    await js(MEDIR);
    await js(`(()=>{const o=mk();o.name='Mar';start(o);const t=document.getElementById('title');if(t)t.style.display='none';OWN.owned=[0];OWN.cur=0;OWN.cust[0]={hc:null,sc:null,flag:0,name:'Teste',up:{}};OWN.hp[0]=shipStats(0,{}).res;enterSea('foosha');return 1})()`);
    await wait(2500);
    await js(`(()=>{PS.x+=420;PS.y+=260;PS.v=0;PS.auto=null;tm=3600;return 1})()`); await wait(1000);
    const clima = (ws, st) => `(()=>{WX.st=${st};WX.tr=WXS[${st}].r;WX.tws=${ws};WX.ws=${ws};WX.slot=Math.floor(CLK/240);return 1})()`;
    const caso = async (nome, setup, tecla, ms) => {
      await js(setup); await wait(1200);
      let kd = null; if (tecla) { kd = setInterval(() => wc.sendInputEvent({ type: 'keyDown', keyCode: tecla }), 80); await wait(ms || 2500); }
      const m = await js(`__medir(2000)`);
      if (kd) { clearInterval(kd); wc.sendInputEvent({ type: 'keyUp', keyCode: tecla }); }
      R.casos.push({ nome, ...m }); await shot(nome); await js(`PS.v=0;PS.boost=0;1`); await wait(600);
    };
    await caso('1_parado_mar_calmo', clima(.15, 0));
    await caso('2_devagar', clima(.3, 0), 'W', 900);
    await caso('3_velocidade_maxima', clima(.3, 0) + `;PS.boost=4`, 'W', 3500);
    await caso('4_vento_fraco', clima(.2, 0));
    await caso('5_vento_forte', clima(.95, 1));
    await caso('6_mar_calmo_com_vento_mudando', `(()=>{WX.st=0;WX.tr=0;clearInterval(window.__wv);window.__wv=setInterval(()=>{WX.tws=.35+.25*Math.sin(performance.now()/1800)},100);return 1})()`);
    await js(`clearInterval(window.__wv);1`);
    await caso('7_tempestade', clima(1, 3));
    // 8: câmera acompanhando o navio em velocidade alta: a água não pode andar junto com o navio
    await caso('8_camera_acompanhando', clima(.3, 0) + `;PS.boost=4`, 'D', 3500);
    // FPS: mesma medida com limite de 30 FPS
    await js(`OPT.fps=30;1`); await caso('9_parado_30fps', clima(.3, 0)); await js(`OPT.fps=60;1`);
  } catch (e) { R.falha = String(e && e.stack || e); }
  fs.writeFileSync(path.join(out, 'mar_' + (R.versao || 'x') + '.json'), JSON.stringify(R, null, 2));
  app.exit(0);
};
