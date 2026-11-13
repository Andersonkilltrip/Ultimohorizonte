'use strict';
// PM_DIAG=social (com PM_SERVER apontando para o servidor): conta pela janela do jogo, chat, duelo, save na nuvem e
// combate naval contra um "robô" (cliente Colyseus no processo principal). Resultado: %APPDATA%\Pirate MMO\diag\social.json
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const wait = ms => new Promise(r => setTimeout(r, ms));
module.exports = async function (win) {
  const out = path.join(app.getPath('userData'), 'diag'); fs.mkdirSync(out, { recursive: true });
  const wc = win.webContents, js = c => wc.executeJavaScript(c), R = { passos: [], erros: [] };
  wc.on('console-message', e => { if (e && e.level === 'error' && R.erros.length < 10) R.erros.push(String(e.message).slice(0, 200)); });
  const shot = async n => { try { fs.writeFileSync(path.join(out, 'social_' + n + '.png'), (await wc.capturePage()).toPNG()); } catch (e) {} };
  const ok = (nome, cond, extra) => R.passos.push(Object.assign({ nome, ok: !!cond }, extra || {}));
  setTimeout(() => { R.falha = 'tempo esgotado'; fs.writeFileSync(path.join(out, 'social.json'), JSON.stringify(R, null, 2)); app.exit(1); }, 170000);
  const URL = process.env.PM_SERVER.trim();
  const { Client } = require(path.join(__dirname, '..', '..', 'uh-server', 'node_modules', '@colyseus', 'sdk'));
  const post = (p, body, tok) => fetch(URL + '/api/conta' + p, { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json' }, tok ? { Authorization: 'Bearer ' + tok } : {}), body: JSON.stringify(body) }).then(r => r.json());
  try {
    await new Promise(r => wc.once('did-finish-load', r));
    await js(`new Promise(r=>{(function w(){if(typeof ready!='undefined'&&ready&&window.UHACC)r();else setTimeout(w,200)})()})`); await wait(1200);
    await js(`localStorage.removeItem('uh_conta');UHACC.u=null;UHACC.tok=null;UHACC.pedir();1`); await wait(400);
    ok('janela de login aparece', await js(`!!document.getElementById('uhLogin')`)); await shot('login');
    const user = 'heroi' + Math.floor(Math.random() * 1e5);
    await js(`(()=>{document.getElementById('uhU').value='${user}';document.getElementById('uhS').value='senha123';document.getElementById('uhReg').click();return 1})()`); await wait(1500);
    const acc = await js(`({u:UHACC.u,tok:!!UHACC.tok,janela:!!document.getElementById('uhLogin')})`); ok('criar conta pela janela', acc.u === user && acc.tok && !acc.janela, acc);
    await js(`(()=>{const o=mk();o.name='Heroi';start(o);const t=document.getElementById('title');if(t)t.style.display='none';P.lv=6;return 1})()`); await wait(3500);
    const st = await js(`({status:NET.status,kind:NET.kind,sid:NET.room&&NET.room.sessionId,x:P.x,y:P.y,seed:WSEED})`); ok('entra online com a conta', st.status === 'online', st);
    // robô
    const bt = await post('/registrar', { usuario: 'robo' + Math.floor(Math.random() * 1e5), senha: 'senha123' });
    const bot = await new Client(URL).joinOrCreate('ilha', { token: bt.token, island: 'foosha', name: 'Robô', x: st.x + 20, y: st.y });
    const botMsg = []; bot.onMessage('chat', m => botMsg.push(m)); for (const k of ['aviso', 'duelo:hp', 'duelo:inicio', 'duelo:fim', 'duelo:convite']) bot.onMessage(k, m => botMsg.push(Object.assign({ k }, m)));
    await wait(800);
    bot.send('chat', { texto: 'Olá do robô!' }); await wait(600);
    ok('chat: robô → jogo', await js(`document.getElementById('uhChat').textContent.includes('Olá do robô!')`));
    await js(`NET.room.send('chat',{texto:'Olá, robô!'});1`); await wait(600);
    ok('chat: jogo → robô', botMsg.some(m => m.texto === 'Olá, robô!'), { de: (botMsg.find(m => m.texto === 'Olá, robô!') || {}).conta });
    await shot('chat');
    // duelo: robô desafia; jogador aceita com G real
    bot.send('duelo:pedir', { alvo: st.sid }); await wait(600);
    wc.sendInputEvent({ type: 'keyDown', keyCode: 'G' }); wc.sendInputEvent({ type: 'keyUp', keyCode: 'G' }); await wait(600);
    ok('duelo começa (aceite com G)', botMsg.some(m => m.k === 'duelo:inicio'));
    for (let i = 0; i < 6; i++) { await js(`(()=>{P.atk=0;P.lastA=-9;basic();return 1})()`); await wait(450); }
    const hits = botMsg.filter(m => m.k === 'duelo:hp').length; ok('golpes do jogador contados pelo servidor', hits >= 3, { golpes: hits });
    await shot('duelo');
    // save na nuvem
    await js(`(()=>{P.lv=11;saveGame(true);return 1})()`); await wait(2000);
    const tok = await js(`UHACC.tok`); const sv = await fetch(URL + '/api/conta/save', { headers: { Authorization: 'Bearer ' + tok } }).then(r => r.json());
    let lv = null; try { lv = JSON.parse(sv.save).P.lv; } catch (e) {} ok('save enviado para a nuvem', lv === 11, { nivelNaNuvem: lv });
    await bot.leave();
    // combate naval
    await js(`(()=>{OWN.owned=[0];OWN.cur=0;OWN.cust[0]={hc:null,sc:null,flag:0,name:'T',up:{}};OWN.hp[0]=shipStats(0,{}).res;enterSea('foosha');window.UHSEGURO=()=>false;return 1})()`); await wait(2500);
    const ps = await js(`({x:PS.x,y:PS.y,a:PS.a,hp:PS.hp,kind:NET.kind,status:NET.status})`);
    const ang = ps.a + Math.PI / 2, bx = ps.x + Math.cos(ang) * 120, by = ps.y + Math.sin(ang) * 120;
    const bot2 = await new Client(URL).joinOrCreate('mar', { token: bt.token, seed: st.seed, name: 'Robô', x: bx, y: by, a: ps.a, hp: 60, mhp: 60 });
    const dmg = []; bot2.onMessage('dano', m => dmg.push(m)); for (const k of ['acerto', 'disparo', 'chat', 'afundou']) bot2.onMessage(k, () => {});
    bot2.send('nav', { x: bx, y: by, a: ps.a, v: 0, z: 0 }); await wait(800);
    await js(`(()=>{PS.cd=0;fire(PS,1);return 1})()`); await wait(800);
    ok('jogo acerta o navio do robô', dmg.length >= 1, { dano: dmg[0] && dmg[0].dano });
    // robô atira de volta (o jogador está a bombordo dele: lado -1)
    const hp0 = await js(`PS.hp`); bot2.send('tiro', { lado: -1 }); await wait(900);
    const hp1 = await js(`PS.hp`); ok('robô acerta o jogador', hp1 < hp0, { casco: [hp0, hp1] });
    await shot('naval');
    await bot2.leave();
  } catch (e) { R.falha = String(e && e.stack || e); }
  fs.writeFileSync(path.join(out, 'social.json'), JSON.stringify(R, null, 2)); app.exit(0);
};
