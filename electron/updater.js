'use strict';
// Atualização automática pelo GitHub Releases (electron-updater lê o app-update.yml gerado pelo electron-builder).
// Sem tokens no app: o repositório de releases precisa ser público.
const { app, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
let autoUpdater = null;
let win = null, busy = false, downloaded = false, manual = false;
// PM_UPDATE_TEST=1: teste automático (aceita baixar, não instala; grava o resultado e fecha)
const TEST = process.env.PM_UPDATE_TEST === '1';

function log(...a) {
  try { fs.appendFileSync(path.join(app.getPath('userData'), 'atualizacao.log'), new Date().toISOString() + ' ' + a.join(' ') + '\n'); } catch {}
}
function send(ch, data) { try { if (win && !win.isDestroyed()) win.webContents.send(ch, data); } catch {} }

function init(w) {
  win = w;
  // em desenvolvimento (npm start) não há app-update.yml: não procura atualização
  const testFeed = process.env.PM_UPDATE_URL;   // teste local: servidor genérico com os arquivos do dist
  if (!app.isPackaged && !testFeed) { log('modo desenvolvimento: atualização desligada'); return; }
  // instalador de teste (não publicado): não troca a si mesmo pela versão do GitHub
  try { if (require('../package.json').pmNoUpdate) { log('instalador de teste: atualização desligada'); return; } } catch {}
  try { ({ autoUpdater } = require('electron-updater')); } catch (e) { log('electron-updater ausente', e.message); return; }
  autoUpdater.autoDownload = false;            // pergunta antes de baixar
  autoUpdater.autoInstallOnAppQuit = !TEST;    // se baixou e o jogador não reiniciou, instala ao fechar (nunca no modo de teste)
  autoUpdater.allowPrerelease = false;
  autoUpdater.logger = { info: m => log('info', m), warn: m => log('warn', m), error: m => log('erro', m), debug: () => {} };
  if (testFeed) { autoUpdater.setFeedURL({ provider: 'generic', url: testFeed }); if (!app.isPackaged) autoUpdater.forceDevUpdateConfig = true; }

  autoUpdater.on('checking-for-update', () => { send('pm:update', { state: 'checking' }); });
  autoUpdater.on('update-not-available', () => {
    busy = false; send('pm:update', { state: 'none' });
    if (manual) dialog.showMessageBox(win, { type: 'info', title: 'Pirate MMO', message: 'Você já está na versão mais recente (' + app.getVersion() + ').' });
    manual = false;
  });
  autoUpdater.on('update-available', async (info) => {
    send('pm:update', { state: 'available', version: info.version });
    log('disponível', info.version);
    const r = TEST ? { response: 0 } : await dialog.showMessageBox(win, {
      type: 'info', title: 'Atualização disponível', buttons: ['Baixar agora', 'Depois'], defaultId: 0, cancelId: 1,
      message: 'Nova versão do Pirate MMO: ' + info.version, detail: 'Você está na versão ' + app.getVersion() + '. O jogo continua funcionando durante o download.'
    });
    if (r.response === 0) { autoUpdater.downloadUpdate().catch(e => { log('download falhou', e.message); busy = false; send('pm:update', { state: 'error' }); }); }
    else { busy = false; send('pm:update', { state: 'later' }); }
  });
  autoUpdater.on('download-progress', (p) => {
    const pct = Math.max(0, Math.min(100, p.percent || 0));
    if (win && !win.isDestroyed()) win.setProgressBar(pct / 100);
    send('pm:update', { state: 'downloading', percent: pct, mbps: (p.bytesPerSecond || 0) / 1048576 });
  });
  autoUpdater.on('update-downloaded', async (info) => {
    downloaded = true; busy = false;
    if (win && !win.isDestroyed()) win.setProgressBar(-1);
    send('pm:update', { state: 'ready', version: info.version });
    log('baixada', info.version, info.downloadedFile || '');
    if (TEST) { try { fs.writeFileSync(path.join(app.getPath('userData'), 'teste-atualizacao.json'), JSON.stringify({ de: app.getVersion(), para: info.version, arquivo: info.downloadedFile || null, quando: new Date().toISOString() }, null, 2)); } catch {} setTimeout(() => app.exit(0), 1500); return; }
    const r = await dialog.showMessageBox(win, {
      type: 'question', title: 'Atualização pronta', buttons: ['Reiniciar e instalar', 'Instalar ao fechar o jogo'], defaultId: 0, cancelId: 1,
      message: 'A versão ' + info.version + ' foi baixada.', detail: 'Seus saves e configurações são mantidos.'
    });
    if (r.response === 0) installNow();
  });
  autoUpdater.on('error', (e) => {
    // sem internet, repositório inexistente ou sem release: o jogo segue normalmente
    log('erro', e && e.message); busy = false; if (win && !win.isDestroyed()) win.setProgressBar(-1);
    if (TEST) { try { fs.writeFileSync(path.join(app.getPath('userData'), 'teste-atualizacao.json'), JSON.stringify({ erro: String(e && e.message || e) }, null, 2)); } catch {} setTimeout(() => app.exit(1), 500); }
    send('pm:update', { state: 'error' });
    if (manual) dialog.showMessageBox(win, { type: 'warning', title: 'Pirate MMO', message: 'Não foi possível procurar atualizações agora.', detail: String(e && e.message || e).slice(0, 300) });
    manual = false;
  });
  setTimeout(() => check(false), 4000);   // ao abrir o jogo
}

function check(isManual) {
  if (!autoUpdater) { if (isManual) dialog.showMessageBox(win, { type: 'info', title: 'Pirate MMO', message: 'Atualização automática só funciona no jogo instalado.' }); return; }
  if (busy || downloaded) { if (downloaded && isManual) installNow(); return; }
  busy = true; manual = !!isManual;
  autoUpdater.checkForUpdates().catch(e => { log('check falhou', e.message); busy = false; });
}
function installNow() { if (autoUpdater && downloaded) { log('instalando e reiniciando'); setImmediate(() => autoUpdater.quitAndInstall(false, true)); } }

module.exports = { init, check, installNow };
