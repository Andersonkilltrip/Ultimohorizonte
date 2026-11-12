'use strict';
// Pirate MMO — processo principal do Electron.
// O jogo (game/index.html) é o mesmo HTML independente; aqui só o servimos com segurança e janela de jogo.
const { app, BrowserWindow, Menu, protocol, net, session, shell, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const updater = require('./updater');

const GAME_DIR = path.join(__dirname, '..', 'game');
const SELFTEST = process.argv.includes('--selftest');
const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'janela.json');
const RES = [[1280, 720], [1600, 900], [1920, 1080], [2560, 1440]];

// app:// com origem fixa: o localStorage do jogo (saves e opções) fica sempre no mesmo lugar e sobrevive às atualizações
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

// Servidor multiplayer (Colyseus): variável PM_SERVER > %APPDATA%\Pirate MMO\servidor.json {"url":"..."} > "mpServer" do package.json.
// Vazio = jogo offline.
function mpServer() {
  if (process.env.PM_SERVER) return process.env.PM_SERVER.trim();
  try { const j = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'servidor.json'), 'utf8')); if (j && typeof j.url === 'string') return j.url.trim(); } catch {}
  try { return String(require('../package.json').mpServer || '').trim(); } catch { return ''; }
}

function loadSettings() { try { return JSON.parse(fs.readFileSync(SETTINGS_FILE(), 'utf8')); } catch { return { w: 1600, h: 900, full: false }; } }
function saveSettings(s) { try { fs.mkdirSync(path.dirname(SETTINGS_FILE()), { recursive: true }); fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(s)); } catch {} }

if (!app.requestSingleInstanceLock()) app.quit();
let win = null;

// CSP: o jogo é um HTML único com scripts embutidos, imagens/áudio em data: e conexão ao servidor multijogador (socket.io)
const CSP = [
  "default-src 'self' app:",
  "script-src 'self' app: 'unsafe-inline'",
  "style-src 'self' app: 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' app: data: https://fonts.gstatic.com",
  "img-src 'self' app: data: blob:",
  "media-src 'self' app: data: blob:",
  "connect-src 'self' app: data: blob: http: https: ws: wss:",
  "worker-src 'self' app: blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "frame-src 'none'"
].join('; ');

function registerAppProtocol() {
  protocol.handle('app', async (req) => {
    const u = new URL(req.url);
    let rel = decodeURIComponent(u.pathname).replace(/^\/+/, '') || 'index.html';
    const file = path.normalize(path.join(GAME_DIR, rel));
    if (!file.startsWith(GAME_DIR)) return new Response('Proibido', { status: 403 });
    if (!fs.existsSync(file)) return new Response('', { status: 404 });
    const res = await net.fetch(pathToFileURL(file).toString());
    const headers = new Headers(res.headers);
    if (file.endsWith('.html')) headers.set('Content-Security-Policy', CSP);
    return new Response(res.body, { status: res.status, headers });
  });
}

function hardenSession() {
  const allowed = new Set(['fullscreen', 'pointerLock', 'clipboard-sanitized-write']);
  session.defaultSession.setPermissionRequestHandler((_wc, perm, cb) => cb(allowed.has(perm)));
  session.defaultSession.setPermissionCheckHandler((_wc, perm) => allowed.has(perm));
}

function setRes(w, h) {
  if (!win) return;
  if (win.isFullScreen()) win.setFullScreen(false);
  win.setContentSize(w, h); win.center();
  const s = loadSettings(); s.w = w; s.h = h; s.full = false; saveSettings(s);
}
function toggleFull() { if (!win) return; const f = !win.isFullScreen(); win.setFullScreen(f); const s = loadSettings(); s.full = f; saveSettings(s); }

function buildMenu() {
  const tpl = [
    { label: 'Jogo', submenu: [
      { label: 'Tela cheia', accelerator: 'F11', click: toggleFull },
      { label: 'Resolução', submenu: RES.map(([w, h]) => ({ label: `${w} × ${h}`, click: () => setRes(w, h) })) },
      { type: 'separator' },
      { label: 'Recarregar o jogo', accelerator: 'Ctrl+R', click: () => win && win.reload() },
      { type: 'separator' },
      { label: 'Sair', role: 'quit' }
    ] },
    { label: 'Ajuda', submenu: [
      { label: 'Procurar atualizações', click: () => updater.check(true) },
      { label: 'Servidor online', click: () => dialog.showMessageBox(win, { type: 'info', title: 'Pirate MMO', message: mpServer() ? 'Servidor: ' + mpServer() : 'Sem servidor configurado (jogo offline).', detail: 'Para trocar, crie ' + path.join(app.getPath('userData'), 'servidor.json') + ' com {"url":"https://seu-servidor"} e reabra o jogo.' }) },
      { label: 'Sobre o Pirate MMO', click: () => dialog.showMessageBox(win, { type: 'info', title: 'Pirate MMO', message: 'Pirate MMO', detail: 'Versão ' + app.getVersion() }) }
    ] }
  ];
  if (!app.isPackaged) tpl.push({ label: 'Dev', submenu: [{ role: 'toggleDevTools' }] });
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

function createWindow() {
  const s = loadSettings();
  win = new BrowserWindow({
    title: 'Pirate MMO', width: s.w || 1600, height: s.h || 900, useContentSize: true, minWidth: 960, minHeight: 600,
    backgroundColor: '#0b0f18', show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      additionalArguments: mpServer() ? ['--pm-server=' + encodeURIComponent(mpServer())] : [],
      contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true,
      spellcheck: false, backgroundThrottling: false
    }
  });
  if (s.full) win.setFullScreen(true);
  win.once('ready-to-show', () => { if (!SELFTEST) win.show(); });
  // nada de navegar para fora do jogo nem abrir janelas novas; links http(s) abrem no navegador
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) e.preventDefault(); });
  win.on('enter-full-screen', () => { const t = loadSettings(); t.full = true; saveSettings(t); });
  win.on('leave-full-screen', () => { const t = loadSettings(); t.full = false; saveSettings(t); });
  win.loadURL('app://game/index.html');
  return win;
}

ipcMain.handle('pm:version', () => app.getVersion());
ipcMain.on('pm:install-now', () => updater.installNow());

// Teste automático: abre o jogo escondido, espera carregar e grava o resultado
async function selfTest(w) {
  const out = path.join(app.getPath('userData'), 'selftest.json');
  const errors = [];
  w.webContents.on('console-message', (e) => { if (e && e.level === 'error') errors.push(e.message); });
  w.webContents.on('render-process-gone', (_e, d) => errors.push('render-process-gone ' + d.reason));
  await new Promise(r => w.webContents.once('did-finish-load', r));
  await new Promise(r => setTimeout(r, 6000));
  let info = {};
  try {
    info = await w.webContents.executeJavaScript(`(()=>{const q=s=>!!document.querySelector(s);return{title:document.title,menu:q('#title'),canvas:document.querySelectorAll('canvas').length,webgl:!!document.createElement('canvas').getContext('webgl'),ls:(()=>{try{localStorage.setItem('pm_t','1');return localStorage.getItem('pm_t')==='1'}catch(e){return false}})(),versao:(document.getElementById('pmVersion')||{}).textContent||null}})()`);
  } catch (e) { errors.push('exec ' + e.message); }
  // PM_SELFTEST_MP=1: começa um jogo e confere a conexão com o servidor Colyseus (PM_SERVER)
  if (process.env.PM_SELFTEST_MP === '1') {
    try {
      info.online = await w.webContents.executeJavaScript(`(async()=>{for(let i=0;i<80&&!(typeof ready!='undefined'&&ready);i++)await new Promise(r=>setTimeout(r,250));const o=mk();o.name='Electron';start(o);for(let i=0;i<40&&!(window.NET&&NET.status==='online');i++)await new Promise(r=>setTimeout(r,250));await new Promise(r=>setTimeout(r,1500));return{servidor:window.MP_SERVER||null,status:NET.status,erro:NET.err,sessao:NET.room&&NET.room.sessionId,outros:[...NET.others.values()].map(r=>r.p.name),enviados:NET.sent}})()`);
      if (!info.online || info.online.status !== 'online') errors.push('online: ' + JSON.stringify(info.online));
    } catch (e) { errors.push('online ' + e.message); }
  }
  fs.writeFileSync(out, JSON.stringify({ ok: errors.length === 0 && info.menu && info.ls, version: app.getVersion(), info, errors }, null, 2));
  app.exit(0);
}

app.whenReady().then(() => {
  registerAppProtocol(); hardenSession(); buildMenu();
  const w = createWindow();
  if (SELFTEST) { selfTest(w); return; }
  updater.init(w);
});
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
