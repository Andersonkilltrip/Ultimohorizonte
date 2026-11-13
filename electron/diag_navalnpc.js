'use strict';
// PM_DIAG=navalnpc (PM_SERVER=" "): munições, enfiada, fogo, avarias, rendição e saque contra um navio pirata NPC.
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const wait = ms => new Promise(r => setTimeout(r, ms));
module.exports = async function (win) {
  const out = path.join(app.getPath('userData'), 'diag'); fs.mkdirSync(out, { recursive: true });
  const wc = win.webContents, js = c => wc.executeJavaScript(c), R = { erros: [], passos: [] };
  wc.on('console-message', e => { if (e && e.level === 'error' && R.erros.length < 10) R.erros.push(String(e.message).slice(0, 200)); });
  const shot = async n => { try { fs.writeFileSync(path.join(out, 'naval_' + n + '.png'), (await wc.capturePage()).toPNG()); } catch (e) {} };
  const ok = (nome, cond, extra) => R.passos.push(Object.assign({ nome, ok: !!cond }, extra || {}));
  const key = async k => { wc.sendInputEvent({ type: 'keyDown', keyCode: k }); await wait(60); wc.sendInputEvent({ type: 'keyUp', keyCode: k }); };
  setTimeout(() => { R.falha = 'tempo esgotado'; fs.writeFileSync(path.join(out, 'navalnpc.json'), JSON.stringify(R, null, 2)); app.exit(1); }, 150000);
  try {
    await new Promise(r => wc.once('did-finish-load', r));
    await js(`new Promise(r=>{(function w(){if(typeof ready!='undefined'&&ready&&window.NAVAL)r();else setTimeout(w,200)})()})`); await wait(1200);
    await js(`(()=>{const o=mk();o.name='Naval';start(o);const t=document.getElementById('title');if(t)t.style.display='none';P.lv=8;return 1})()`); await wait(1500);
    await js(`(()=>{OWN.owned=[1];OWN.cur=1;OWN.cust[1]={hc:null,sc:null,flag:0,name:'T',up:{}};OWN.hp[1]=shipStats(1,{}).res;enterSea('foosha');INV.minerio=4;INV.polvora=3;INV.kit=2;CLK=Math.floor(CLK/1440)*1440+11*60;return 1})()`); await wait(2500);
    // inimigo a estibordo, mesma proa (alvo do costado)
    const mkFoe = `(()=>{NS=[];const a=PS.a,ang=a+Math.PI/2;const s=addShip({key:'teste'+Math.random(),role:'patrol',c:{x:PS.x+Math.cos(ang)*120,y:PS.y+Math.sin(ang)*120},r:40,type:1,fac:'pirata',name:'Tubarão Cinzento',dg:1});if(!s)return null;s.x=PS.x+Math.cos(ang)*120;s.y=PS.y+Math.sin(ang)*120;s.a=a;s.v=0;engage(s,'P');s.warn=99;s.cd=99;window.__S=s;return{hp:s.hp,mhp:s.mhp}})()`;
    const f0 = await js(mkFoe); ok('navio pirata criado', !!f0, f0);
    // trocar munição com Q real
    await key('Q'); await wait(300); const am1 = await js(`NAVAL.AM[NAVAL.am].k`); ok('Q troca para corrente', am1 === 'corrente', { am: am1 });
    await js(`(()=>{NS=NS.filter(x=>x===__S);const s=__S,a=PS.a+Math.PI/2;s.x=PS.x+Math.cos(a)*110;s.y=PS.y+Math.sin(a)*110;s.v=0;PS.v=0;PS.cd=0;fire(PS,1);return 1})()`); await wait(900);
    const c1 = await js(`({slow:+(__S.slow||0).toFixed(2),hp:__S.hp,min:INV.minerio||0})`); ok('corrente acerta e deixa lento', c1.slow > 0 && c1.min === 3, c1);
    await key('Q'); await wait(200);
    await js(`(()=>{NS=NS.filter(x=>x===__S);const s=__S,a=PS.a+Math.PI/2;s.x=PS.x+Math.cos(a)*110;s.y=PS.y+Math.sin(a)*110;PS.cd=0;fire(PS,1);return 1})()`); await wait(700);
    const c2 = await js(`({burn:+(__S.burn||0).toFixed(2),hp:__S.hp,pol:INV.polvora||0})`); ok('incendiária põe fogo', c2.burn > 0 && c2.pol === 2, c2);
    await wait(2200); const c3 = await js(`__S.hp`); ok('fogo causa dano com o tempo', c3 < c2.hp, { hp: [c2.hp, c3] }); await shot('fogo');
    // enfiada: o inimigo de proa para o costado do jogador
    await js(`(()=>{NS=NS.filter(x=>x===__S);NAVAL.am=0;const s=__S,a=PS.a+Math.PI/2;s.burn=0;s.x=PS.x+Math.cos(a)*110;s.y=PS.y+Math.sin(a)*110;s.a=a;PS.cd=0;window.__h0=s.hp;fl.length=0;fire(PS,1);return 1})()`); await wait(800);
    const c4 = await js(`({dano:__h0-__S.hp,txt:fl.map(f=>f.s).join('|')})`); ok('tiro de enfiada (+50%)', /Enfiada/.test(c4.txt), c4);
    // metralha: leque de 5 balas
    await js(`(()=>{NAVAL.am=3;PS.cd=0;window.__n0=CB.length;fire(PS,1);window.__n1=CB.length;return 1})()`); const c5 = await js(`__n1-__n0`); ok('metralha dispara em leque', c5 >= 5, { balas: c5 }); await wait(600);
    // avaria e rendição
    await js(`(()=>{NAVAL.forceRend=true;const s=__S;s.hp=Math.round(s.mhp*.2);s.st='fight';s.tgt='P';return 1})()`); await wait(600);
    const c6 = await js(`({rend:!!__S.rend,st:__S.st})`); ok('pirata avariado se rende', c6.rend, c6);
    await js(`(()=>{NS=NS.filter(x=>x===__S);const s=__S,a=PS.a+Math.PI/2;s.x=PS.x+Math.cos(a)*70;s.y=PS.y+Math.sin(a)*70;PS.v=0;return 1})()`); await wait(800); await shot('rendido');
    const nr = await js(`(seaNear()||{}).k`); ok('E perto oferece saquear', nr === 'rend', { k: nr });
    const b0 = await js(`P.berries`); await key('E'); await wait(700);
    const c7 = await js(`({b:P.berries,looted:!!__S.looted,hostil:hostileP(__S)})`); ok('saque dá recompensa e o navio fica pacífico', c7.b > b0 && c7.looted && !c7.hostil, Object.assign({ antes: b0 }, c7));
    // jogador pegando fogo: kit apaga
    await js(`(()=>{PS.burn=4;PS.slow=3;return 1})()`); await wait(1300); await shot('jogador_fogo');
    const h1 = await js(`PS.hp`); await key('R'); await wait(300); const c8 = await js(`({burn:PS.burn,slow:PS.slow,kit:INV.kit||0})`); ok('kit (R) apaga o fogo e remenda as velas', !c8.burn && !c8.slow && c8.kit === 1, Object.assign({ casco: h1 }, c8));
    // marinha recua
    await js(`(()=>{NS=[];const a=PS.a+Math.PI/2;const s=addShip({key:'mar'+Math.random(),role:'patrol',c:{x:PS.x+Math.cos(a)*140,y:PS.y+Math.sin(a)*140},r:40,type:5,fac:'marinha',name:'Patrulha Azul',dg:0});s.x=PS.x+Math.cos(a)*140;s.y=PS.y+Math.sin(a)*140;engage(s,'P');s.hp=Math.round(s.mhp*.2);window.__M=s;return 1})()`); await wait(600);
    const c9 = await js(`__M.st`); ok('Marinha avariada recua', c9 === 'flee', { st: c9 });
  } catch (e) { R.falha = String(e && e.stack || e); }
  fs.writeFileSync(path.join(out, 'navalnpc.json'), JSON.stringify(R, null, 2)); app.exit(0);
};
