'use strict';
// Preload isolado: só mostra a versão e o progresso da atualização por cima do jogo (sem tocar no HUD nem no código do jogo).
const { ipcRenderer, contextBridge } = require('electron');

// Endereço do servidor multiplayer (Colyseus), decidido pelo processo principal.
// O jogo lê window.MP_SERVER; sem endereço, joga offline como sempre.
const arg = process.argv.find(a => a.startsWith('--pm-server='));
const MP_SERVER = arg ? decodeURIComponent(arg.slice('--pm-server='.length)) : '';
if (MP_SERVER) contextBridge.exposeInMainWorld('MP_SERVER', MP_SERVER);

// Janela nativa (modos e resolução) para Configurações > Exibição. Só estas quatro operações, nada além.
const modeCbs = [];
ipcRenderer.on('pm:win:mode', (_e, m) => { for (const f of modeCbs) try { f(m); } catch (e) {} });
contextBridge.exposeInMainWorld('PMNative', {
  setMode: m => ipcRenderer.send('pm:win:set-mode', String(m)),
  getMode: () => ipcRenderer.invoke('pm:win:get'),
  listRes: () => ipcRenderer.invoke('pm:win:list-res'),
  setRes: (w, h) => ipcRenderer.send('pm:win:set-res', w | 0, h | 0),
  onMode: f => { if (typeof f === 'function') modeCbs.push(f); }
});

function ui() {
  if (document.getElementById('pmVersion')) return;
  const st = document.createElement('style');
  st.textContent = '#pmVersion{position:fixed;right:6px;bottom:4px;z-index:2147483000;font:11px/1 "Pixelify Sans",monospace;color:#e9d7a8;opacity:.55;pointer-events:none;text-shadow:0 1px 2px #000}' +
    '#pmUpd{position:fixed;left:50%;top:10px;transform:translateX(-50%);z-index:2147483001;min-width:260px;padding:8px 12px;border-radius:8px;background:rgba(12,18,28,.9);border:1px solid #c9a45c;color:#f3e6c8;font:13px "Pixelify Sans",monospace;display:none;pointer-events:none;text-align:center;box-shadow:0 6px 20px rgba(0,0,0,.5)}' +
    '#pmUpd i{display:block;height:6px;margin-top:6px;border-radius:3px;background:#2a3446;overflow:hidden}#pmUpd i b{display:block;height:100%;width:0;background:linear-gradient(#ffd86a,#c9922a)}';
  document.head.appendChild(st);
  const v = document.createElement('div'); v.id = 'pmVersion'; document.body.appendChild(v);
  ipcRenderer.invoke('pm:version').then(ver => { v.textContent = 'Pirate MMO v' + ver; });
  const u = document.createElement('div'); u.id = 'pmUpd'; u.innerHTML = '<span></span><i><b></b></i>'; document.body.appendChild(u);
}

let hideT = 0;
ipcRenderer.on('pm:update', (_e, d) => {
  ui();
  const u = document.getElementById('pmUpd'), s = u.querySelector('span'), bar = u.querySelector('i'), fill = u.querySelector('b');
  const show = (txt, pct, ms) => { s.textContent = txt; bar.style.display = pct == null ? 'none' : 'block'; if (pct != null) fill.style.width = pct.toFixed(1) + '%'; u.style.display = 'block'; clearTimeout(hideT); if (ms) hideT = setTimeout(() => { u.style.display = 'none'; }, ms); };
  if (d.state === 'available') show('Nova versão ' + d.version + ' disponível', null, 6000);
  else if (d.state === 'downloading') show('Baixando atualização… ' + Math.round(d.percent) + '%' + (d.mbps ? ' · ' + d.mbps.toFixed(1) + ' MB/s' : ''), d.percent);
  else if (d.state === 'ready') show('Atualização ' + d.version + ' pronta — instala ao reiniciar', 100, 8000);
  else if (d.state === 'error') show('Não foi possível atualizar agora (o jogo segue normal)', null, 4000);
});

window.addEventListener('DOMContentLoaded', ui);
