'use strict';
// PM_DIAG=casas (use PM_SERVER=" " para jogar offline): capturas de casas por fora e por dentro, de dia e de noite.
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const wait = ms => new Promise(r => setTimeout(r, ms));
module.exports = async function (win) {
  const out = path.join(app.getPath('userData'), 'diag'); fs.mkdirSync(out, { recursive: true });
  const wc = win.webContents, js = c => wc.executeJavaScript(c), R = { erros: [], passos: [] };
  wc.on('console-message', e => { if (e && e.level === 'error' && R.erros.length < 10) R.erros.push(String(e.message).slice(0, 200)); });
  const shot = async n => { try { fs.writeFileSync(path.join(out, 'casas_' + n + '.png'), (await wc.capturePage()).toPNG()); } catch (e) {} };
  setTimeout(() => { R.falha = 'tempo esgotado'; fs.writeFileSync(path.join(out, 'casas.json'), JSON.stringify(R, null, 2)); app.exit(1); }, 150000);
  try {
    await new Promise(r => wc.once('did-finish-load', r));
    await js(`new Promise(r=>{(function w(){if(typeof ready!='undefined'&&ready)r();else setTimeout(w,200)})()})`); await wait(1200);
    await js(`(()=>{const o=mk();o.name='Casas';start(o);const t=document.getElementById('title');if(t)t.style.display='none';return 1})()`); await wait(1800);
    const hora = h => js(`(()=>{if(typeof setHour=='function')setHour(${h});else if(typeof CLK!='undefined'){const d=Math.floor(CLK/1440);CLK=d*1440+${h}*60}return 1})()`);
    R.doors = await js(`doorList().map(d=>d.kind+'@'+Math.round(d.x)+','+Math.round(d.y)).slice(0,30)`);
    // exterior: casa 0
    const goDoor = i => js(`(()=>{const D=doorList()[${i}];P.x=D.x;P.y=D.y+30;camSnap&&camSnap();return D.kind})()`);
    await hora(11); await goDoor(0); await wait(900); await shot('ext_dia');
    await hora(22); await wait(900); await shot('ext_noite');
    await hora(11);
    for (const [i, n] of [[0, 'casa'], [1, 'casa2']]) {
      const k = await js(`(()=>{const D=doorList()[${i}];enterInt(D.kind,D.key,[D.x,D.y+10]);return D.kind})()`); await wait(1200);
      R.passos.push(n + ':' + k); await shot('int_' + n + '_dia');
      await hora(22); await wait(900); await shot('int_' + n + '_noite'); await hora(11);
      await js(`leaveInt();1`); await wait(600);
    }
    for (const kd of ['house','forge','tavern2','tavern','shop']) { await hora(11); await js(`(()=>{const L=doorList();const D=L.find(d=>d.kind=='${kd}')||L[0];enterInt('${kd}',D.key+'x${kd}',[D.x,D.y+10]);return 1})()`); await wait(1200); await shot('k_' + kd); await hora(22); await wait(900); await shot('k_' + kd + '_noite'); await js(`leaveInt();1`); await wait(400); }
    const tv = await js(`(()=>{const L=doorList();const i=L.findIndex(d=>d.kind.startsWith('tavern'));if(i<0)return null;const D=L[i];enterInt(D.kind,D.key,[D.x,D.y+10]);return D.kind})()`); await wait(1200); await shot('int_taverna'); if (tv) await js(`leaveInt();1`);
    await js(`(()=>{travel('eb_syrup');return 1})()`).catch(() => 0); await wait(2500);
    await js(`(()=>{const D=doorList()[2]||doorList()[0];if(D){P.x=D.x;P.y=D.y+30}return 1})()`); await wait(900); await shot('ilha');
  } catch (e) { R.falha = String(e && e.stack || e); }
  fs.writeFileSync(path.join(out, 'casas.json'), JSON.stringify(R, null, 2)); app.exit(0);
};
