'use strict';
// Pirate MMO â€” processo principal do Electron.
// O jogo (game/index.html) Ã© o mesmo HTML independente; aqui sÃ³ o servimos com seguranÃ§a e janela de jogo.
const { app, BrowserWindow, Menu, protocol, net, session, shell, dialog, ipcMain, screen } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const updater = require('./updater');

const GAME_DIR = path.join(__dirname, '..', 'game');
const SELFTEST = process.argv.includes('--selftest');
const SETTINGS_FILE = () => path.join(app.getPath('userData'), 'janela.json');
// resoluÃ§Ãµes de janela (Ã¡rea do jogo); sÃ³ aparecem as que cabem na Ã¡rea Ãºtil do monitor
const RES = [[1168, 720], [1280, 720], [1366, 768], [1536, 864], [1600, 900], [1920, 1080], [2560, 1440]];

// app:// com origem fixa: o localStorage do jogo (saves e opÃ§Ãµes) fica sempre no mesmo lugar e sobrevive Ã s atualizaÃ§Ãµes
// testes automáticos: não pausar o desenho quando a janela fica coberta por outras (oclusão nativa do Windows)
if (process.env.PM_DIAG) { app.commandLine.appendSwitch('disable-features', 'CalculateNativeWinOcclusion'); app.commandLine.appendSwitch('disable-renderer-backgrounding'); app.commandLine.appendSwitch('disable-background-timer-throttling'); }
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);

// Servidor multiplayer (Colyseus): variÃ¡vel PM_SERVER > %APPDATA%\Pirate MMO\servidor.json {"url":"..."} > "mpServer" do package.json.
// Vazio = jogo offline.
function mpServer() {
  if (process.env.PM_SERVER) return process.env.PM_SERVER.trim();
  try { const j = JSON.parse(fs.readFileSync(path.join(app.getPath('userData'), 'servidor.json'), 'utf8')); if (j && typeof j.url === 'string') return j.url.trim(); } catch {}
  try { return String(require('../package.json').mpServer || '').trim(); } catch { return ''; }
}

// janela.json v2: { v:2, w, h (Ã¡rea do jogo), mode: 'janela'|'maximizada'|'tela' }
function loadSettings() { try { const j = JSON.parse(fs.readFileSync(SETTINGS_FILE(), 'utf8')); if (j && j.v === 2) return j; } catch {} return null; }
function saveSettings(s) { try { fs.mkdirSync(path.dirname(SETTINGS_FILE()), { recursive: true }); fs.writeFileSync(SETTINGS_FILE(), JSON.stringify(Object.assign({ v: 2 }, s))); } catch {} }
// tamanho inicial: ~88% da Ã¡rea Ãºtil do monitor, nunca menor que 1280Ã—720 quando o monitor comporta
function defaultSize() {
  const wa = screen.getPrimaryDisplay().workArea;
  let w = Math.round(wa.width * 0.88), h = Math.round(wa.height * 0.88);
  if (wa.width >= 1320 && wa.height >= 780) { w = Math.max(w, 1280); h = Math.max(h, 720); }
  return { w: Math.min(w, wa.width - 40), h: Math.min(h, wa.height - 60) };
}
function fitsRes() { const wa = screen.getDisplayMatching(win ? win.getBounds() : screen.getPrimaryDisplay().bounds).workArea; return RES.filter(([w, h]) => w <= wa.width && h + 40 <= wa.height); }
function curMode() { return !win ? 'janela' : win.isFullScreen() ? 'tela' : win.isMaximized() ? 'maximizada' : 'janela'; }
function remember() { if (!win) return; const m = curMode(), s = loadSettings() || {}; s.mode = m; if (m === 'janela') { const [w, h] = win.getContentSize(); s.w = w; s.h = h; } saveSettings(s); }
function notifyMode() { if (win && !win.isDestroyed()) win.webContents.send('pm:win:mode', curMode()); remember(); }
function setMode(m) {
  if (!win) return;
  if (m === 'tela') { if (!win.isFullScreen()) win.setFullScreen(true); }
  else if (m === 'maximizada') { if (win.isFullScreen()) { win.once('leave-full-screen', () => win.maximize()); win.setFullScreen(false); } else win.maximize(); }
  else { if (win.isFullScreen()) win.setFullScreen(false); if (win.isMaximized()) win.unmaximize(); }
}
function setRes(w, h) {
  if (!win) return;
  const go = () => { if (win.isMaximized()) win.unmaximize(); win.setContentSize(w, h); win.center(); remember(); };
  if (win.isFullScreen()) { win.once('leave-full-screen', () => setTimeout(go, 50)); win.setFullScreen(false); } else go();
}
function toggleFull() { setMode(win && win.isFullScreen() ? 'janela' : 'tela'); }

if (!app.requestSingleInstanceLock()) app.quit();
let win = null;

// CSP: o jogo Ã© um HTML Ãºnico com scripts embutidos, imagens/Ã¡udio em data: e conexÃ£o ao servidor multijogador (socket.io)
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
      { label: 'Maximizar', click: () => setMode('maximizada') },
      { label: 'Janela', click: () => setMode('janela') },
      { label: 'ResoluÃ§Ã£o', submenu: RES.map(([w, h]) => ({ label: `${w} Ã— ${h}`, click: () => setRes(w, h) })) },
      { type: 'separator' },
      { label: 'Recarregar o jogo', accelerator: 'Ctrl+R', click: () => win && win.reload() },
      { type: 'separator' },
      { label: 'Sair', role: 'quit' }
    ] },
    { label: 'Ajuda', submenu: [
      { label: 'Procurar atualizaÃ§Ãµes', click: () => updater.check(true) },
      { label: 'Servidor online', click: () => dialog.showMessageBox(win, { type: 'info', title: 'Pirate MMO', message: mpServer() ? 'Servidor: ' + mpServer() : 'Sem servidor configurado (jogo offline).', detail: 'Para trocar, crie ' + path.join(app.getPath('userData'), 'servidor.json') + ' com {"url":"https://seu-servidor"} e reabra o jogo.' }) },
      { label: 'Sobre o Pirate MMO', click: () => dialog.showMessageBox(win, { type: 'info', title: 'Pirate MMO', message: 'Pirate MMO', detail: 'VersÃ£o ' + app.getVersion() }) }
    ] }
  ];
  if (!app.isPackaged) tpl.push({ label: 'Dev', submenu: [{ role: 'toggleDevTools' }] });
  Menu.setApplicationMenu(Menu.buildFromTemplate(tpl));
}

function createWindow() {
  const s = loadSettings() || Object.assign({ mode: 'janela' }, defaultSize());
  const wa = screen.getPrimaryDisplay().workArea;
  win = new BrowserWindow({
    title: 'Pirate MMO', width: Math.min(s.w, wa.width), height: Math.min(s.h, wa.height - 30), useContentSize: true, minWidth: 960, minHeight: 600, center: true,
    backgroundColor: '#0b0f18', show: false, autoHideMenuBar: true,
    icon: path.join(__dirname, '..', 'build', 'icon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      additionalArguments: mpServer() ? ['--pm-server=' + encodeURIComponent(mpServer())] : [],
      contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true,
      spellcheck: false, backgroundThrottling: false
    }
  });
  win.once('ready-to-show', () => { if (SELFTEST) return; if (s.mode === 'maximizada') win.maximize(); win.show(); if (s.mode === 'tela') win.setFullScreen(true); });
  // nada de navegar para fora do jogo nem abrir janelas novas; links http(s) abrem no navegador
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('app://')) e.preventDefault(); });
  for (const ev of ['enter-full-screen', 'leave-full-screen', 'maximize', 'unmaximize']) win.on(ev, notifyMode);
  let rt = 0; win.on('resize', () => { clearTimeout(rt); rt = setTimeout(remember, 400); });
  win.loadURL('app://game/index.html');
  return win;
}

ipcMain.handle('pm:version', () => app.getVersion());
ipcMain.on('pm:install-now', () => updater.installNow());
// janela nativa pedida pelo jogo (ConfiguraÃ§Ãµes > ExibiÃ§Ã£o)
ipcMain.handle('pm:win:get', () => curMode());
ipcMain.handle('pm:win:list-res', () => fitsRes());
ipcMain.on('pm:win:set-mode', (_e, m) => { if (['janela', 'maximizada', 'tela'].includes(m)) setMode(m); });
ipcMain.on('pm:win:set-res', (_e, w, h) => { if (RES.some(([a, b]) => a === w && b === h)) setRes(w, h); });

// Teste automÃ¡tico: abre o jogo escondido, espera carregar e grava o resultado
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
  // PM_SELFTEST_MP=1: comeÃ§a um jogo e confere a conexÃ£o com o servidor Colyseus (PM_SERVER)
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
  if (process.env.PM_DIAG === '1') { require('./diag')(w); return; }
  if (process.env.PM_DIAG === 'mar') { require('./diag_mar')(w); return; }
  if (process.env.PM_DIAG === 'itens') { require('./diag_itens')(w); return; }
  if (process.env.PM_DIAG === 'velas') { require('./diag_velas')(w); return; }
  if (process.env.PM_DIAG === 'folk') { require('./diag_folk')(w); return; }
  if (process.env.PM_DIAG === 'hostil') { require('./diag_hostil')(w); return; }
  if (process.env.PM_DIAG === 'casas') { require('./diag_casas')(w); return; }
  if (process.env.PM_DIAG === 'navalnpc') { require('./diag_navalnpc')(w); return; }
  if (process.env.PM_DIAG === 'js') { require('./diag_js')(w); return; }
  if (process.env.PM_DIAG === 'social') { require('./diag_social')(w); return; }
  updater.init(w);
});
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.on('window-all-closed', () => app.quit());
