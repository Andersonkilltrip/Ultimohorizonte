'use strict';
// PM_DIAG=js PM_DIAG_JS=<arquivo.js>: roda um roteiro de teste genérico. O arquivo exporta async ({js,shot,key,wait,ok,R}) => {...}
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const wait = ms => new Promise(r => setTimeout(r, ms));
module.exports = async function (win) {
  const out = path.join(app.getPath('userData'), 'diag'); fs.mkdirSync(out, { recursive: true });
  const nome = path.basename(process.env.PM_DIAG_JS || 'js', '.js');
  const wc = win.webContents, js = c => wc.executeJavaScript(c), R = { erros: [], passos: [] };
  wc.on('console-message', e => { if (e && e.level === 'error' && R.erros.length < 15) R.erros.push(String(e.message).slice(0, 240)); });
  const shot = async n => { try { fs.writeFileSync(path.join(out, nome + '_' + n + '.png'), (await wc.capturePage()).toPNG()); } catch (e) {} };
  const ok = (n, cond, extra) => R.passos.push(Object.assign({ nome: n, ok: !!cond }, extra || {}));
  const key = async k => { wc.sendInputEvent({ type: 'keyDown', keyCode: k }); await wait(60); wc.sendInputEvent({ type: 'keyUp', keyCode: k }); };
  const save = () => fs.writeFileSync(path.join(out, nome + '.json'), JSON.stringify(R, null, 2));
  setTimeout(() => { R.falha = 'tempo esgotado'; save(); app.exit(1); }, +(process.env.PM_DIAG_T || 240000));
  try {
    await new Promise(r => wc.once('did-finish-load', r));
    await js(`new Promise(r=>{(function w(){if(typeof ready!='undefined'&&ready)r();else setTimeout(w,200)})()})`); await wait(1200);
    await require(path.resolve(process.env.PM_DIAG_JS))({ js, shot, key, wait, ok, R, wc });
  } catch (e) { R.falha = String(e && e.stack || e); }
  save(); app.exit(0);
};
