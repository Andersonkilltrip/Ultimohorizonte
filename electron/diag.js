'use strict';
// Diagnóstico de janela, tela cheia, HUD/menus e GPU (só roda com PM_DIAG=1; não faz parte do jogo normal).
// Usa teclas reais (sendInputEvent), mede quadros e movimento em cada modo e salva capturas em %APPDATA%\Pirate MMO\diag.
const { app, screen } = require('electron');
const path = require('path');
const fs = require('fs');

const wait = ms => new Promise(r => setTimeout(r, ms));

async function perfil(wc, ms) {
  const dbg = wc.debugger;
  try { dbg.attach('1.3'); } catch (e) {}
  await dbg.sendCommand('Profiler.enable');
  await dbg.sendCommand('Profiler.setSamplingInterval', { interval: 200 });
  await dbg.sendCommand('Profiler.start');
  await wait(ms);
  const { profile } = await dbg.sendCommand('Profiler.stop');
  try { dbg.detach(); } catch (e) {}
  const dt = profile.timeDeltas || [], byId = {}, self = {};
  for (const n of profile.nodes) byId[n.id] = n;
  (profile.samples || []).forEach((s, i) => { const cf = byId[s].callFrame; const k = (cf.functionName || '(anônima)') + ':' + (cf.lineNumber + 1); self[k] = (self[k] || 0) + (dt[i] || 0) / 1000; });
  const total = Object.values(self).reduce((a, b) => a + b, 0);
  return Object.entries(self).sort((a, b) => b[1] - a[1]).slice(0, 12).map(([k, v]) => k + ' ' + (100 * v / total).toFixed(1) + '%');
}

module.exports = async function diag(win) {
  const out = path.join(app.getPath('userData'), 'diag');
  fs.mkdirSync(out, { recursive: true });
  const wc = win.webContents;
  const R = { inicio: new Date().toISOString(), passos: [], errosConsole: [] };
  wc.on('console-message', e => { if (e && e.level === 'error' && R.errosConsole.length < 30) R.errosConsole.push(String(e.message).slice(0, 300)); });
  const js = (code, gesture) => wc.executeJavaScript(code, !!gesture);
  let nShot = 0;
  const shot = async name => { try { const im = await wc.capturePage(); fs.writeFileSync(path.join(out, String(++nShot).padStart(2, '0') + '_' + name + '.png'), im.toPNG()); } catch (e) {} };
  const press = async (kc, ms) => {
    wc.sendInputEvent({ type: 'keyDown', keyCode: kc });
    const t0 = Date.now(); while (Date.now() - t0 < ms) { wc.sendInputEvent({ type: 'keyDown', keyCode: kc }); await wait(100); }
    wc.sendInputEvent({ type: 'keyUp', keyCode: kc });
  };
  const fps = () => js(`new Promise(r=>{let n=0,t0=performance.now();(function f(){n++;if(performance.now()-t0<2000)requestAnimationFrame(f);else r(Math.round(n/((performance.now()-t0)/1000)))})()})`);
  async function medir(nome, emMar) {
    win.focus(); wc.focus(); await wait(800);
    const a = await js(`(()=>{const p=${emMar ? 'PS' : 'P'};return{x:p.x,y:p.y}})()`);
    const f = await fps();
    await press(emMar ? 'W' : (R.passos.length % 2 ? 'A' : 'D'), 1200); await wait(300);
    const b = await js(`(()=>{const p=${emMar ? 'PS' : 'P'};const cv=document.getElementById('g'),r=cv.getBoundingClientRect(),o=document.getElementById('ov');return{x:p.x,y:p.y,UIOPEN,fsEl:document.fullscreenElement?(document.fullscreenElement.id||document.fullscreenElement.tagName):null,menuVisivel:o&&o.style.display!='none'?(!document.fullscreenElement||document.fullscreenElement.contains(o)):null,janelaCss:[innerWidth,innerHeight],canvasNaTela:[Math.round(r.width),Math.round(r.height)],canvasPx:[cv.width,cv.height],GS,hudErr:window.__hudErr||null,mem:performance.memory?Math.round(performance.memory.usedJSHeapSize/1048576):null}})()`);
    const p = { nome, fps: f, moveu: Math.round(Math.hypot(b.x - a.x, b.y - a.y)), modo: win.isFullScreen() ? 'tela' : win.isMaximized() ? 'maximizada' : 'janela', janela: win.getContentSize(), ...b };
    delete p.x; delete p.y; R.passos.push(p); await shot(nome); return p;
  }
  try {
    await new Promise(r => wc.once('did-finish-load', r));
    await js(`new Promise(r=>{(function w(){if(typeof ready!='undefined'&&ready&&window.UHUI&&window.NET!==undefined)r();else setTimeout(w,200)})()})`);
    await wait(800);
    const d = screen.getDisplayMatching(win.getBounds());
    R.tela = { bounds: d.bounds, workArea: d.workArea, escala: d.scaleFactor };
    R.janelaInicial = { conteudo: win.getContentSize(), bounds: win.getBounds() };
    R.gpu = app.getGPUFeatureStatus();
    R.webgl = await js(`(()=>{const o={};for(const k of ['webgl2','webgl']){const c=document.createElement('canvas').getContext(k);if(c){const e=c.getExtension('WEBGL_debug_renderer_info');o[k]=e?c.getParameter(e.UNMASKED_RENDERER_WEBGL):c.getParameter(c.RENDERER)}else o[k]=null}o.webgpu=!!navigator.gpu;return o})()`);
    await shot('tela_inicial');
    // personagem de teste com save conhecido
    await js(`(()=>{const o=mk();o.name='Diag';start(o);P.lv=9;P.berries=4321;const t=document.getElementById('title');if(t)t.style.display='none';saveGame(true);return 1})()`);
    R.saveAntes = await js(`(()=>{const s=readSave();return{nome:s.ch&&s.ch.name||null,lv:s.P.lv,berries:s.P.berries,seed:s.seed}})()`);
    await wait(2000);
    await medir('janela');
    R.camadas = { comHUDnova: await fps() };
    await js(`window.__u=uniHUD;uniHUD=()=>true;1`); await wait(400); R.camadas.semHUD = await fps();
    await js(`uniHUD=__u;OPT.hud='simples';1`); await wait(400); R.camadas.hudAntigaSimples = await fps();
    await js(`OPT.hud='v3';1`); await wait(400);
    R.perfil = await perfil(wc, 3000);
    // menus
    wc.sendInputEvent({ type: 'keyDown', keyCode: 'I' }); wc.sendInputEvent({ type: 'keyUp', keyCode: 'I' }); await wait(900); R.inventarioAberto = await js('UIOPEN'); await shot('inventario');
    await js(`closeUI();1`); await wait(300);
    await js(`openOptions();1`); await wait(700); await shot('configuracoes');
    // tela cheia pelo botão do jogo (Configurações > Exibição > Tela cheia)
    await js(`document.querySelector('[data-o=mode][data-v=tela]').click();1`, true); await wait(1800);
    R.opcoesAbertasEmTelaCheia = await js(`({UIOPEN,visivel:document.getElementById('ov').style.display!='none'})`);
    await shot('configuracoes_tela_cheia');
    await js(`closeUI();1`); await wait(400);
    await medir('tela_cheia_pelo_jogo');
    await js(`openOptions();document.querySelector('[data-o=mode][data-v=janela]').click();1`, true); await wait(1500); await js(`closeUI();1`);
    await medir('volta_janela');
    await js(`openOptions();document.querySelector('[data-o=mode][data-v=maximizada]').click();1`, true); await wait(1500); await js(`closeUI();1`);
    await medir('maximizada');
    await js(`PMNative.setMode('janela');1`); await wait(1200);
    await js(`PMNative.setRes(1366,768);1`); await wait(1200);
    R.resolucao1366 = win.getContentSize();
    await medir('janela_1366x768');
    win.setFullScreen(true); await wait(1500);           // F11 (menu nativo)
    await medir('tela_cheia_F11');
    await js(`(()=>{OWN.owned=[0];OWN.cur=0;OWN.cust[0]={hc:null,sc:null,flag:0,name:'Diag',up:{}};OWN.hp[0]=shipStats(0,{}).res;enterSea('foosha');return 1})()`); await wait(1500);
    await medir('mar_tela_cheia', true);
    R.marCamadas = { base: await fps() };
    await js(`window.__s={HDON};HDON=false;1`); await wait(400); R.marCamadas.semHD2D = await fps();
    await js(`HDON=__s.HDON;window.__u=uniHUD;uniHUD=()=>true;1`); await wait(400); R.marCamadas.semHUD = await fps();
    await js(`uniHUD=__u;window.__sl=seaLife;seaLife=()=>{};1`); await wait(400); R.marCamadas.semVidaMarinha = await fps();
    await js(`seaLife=__sl;1`); await wait(300);
    R.marPerfil = await perfil(wc, 3000);
    R.marEfeitos = await js(`({HDON,MODE,ondas:window.__seaN||0,vento:typeof WX!='undefined'?+WX.ws.toFixed(2):null})`);
    win.setFullScreen(false); await wait(1500);
    await medir('mar_janela', true);
    await js(`PMNative.setRes(1280,720);1`); await wait(1000);
    await medir('mar_1280x720', true);
    R.saveDepois = await js(`(()=>{saveGame(true);const s=readSave();return{nome:s.ch&&s.ch.name||null,lv:s.P.lv,berries:s.P.berries,seed:s.seed}})()`);
  } catch (e) { R.falha = String(e && e.stack || e); }
  fs.writeFileSync(path.join(out, 'diag.json'), JSON.stringify(R, null, 2));
  app.exit(0);
};
