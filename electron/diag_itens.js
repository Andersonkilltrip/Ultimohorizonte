'use strict';
// Diagnóstico do sistema de itens (PM_DIAG=itens): sprites, coleta, pilha, equipar, comer/beber, loja, baús,
// fabricação, baú pessoal, salvar/carregar e duplicação. Resultado em %APPDATA%\Pirate MMO\diag\itens.json
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const wait = ms => new Promise(r => setTimeout(r, ms));

module.exports = async function diagItens(win) {
  const out = path.join(app.getPath('userData'), 'diag'); fs.mkdirSync(out, { recursive: true });
  const wc = win.webContents, js = c => wc.executeJavaScript(c);
  const R = { testes: [], errosConsole: [] };
  wc.on('console-message', e => { if (e && e.level === 'error' && R.errosConsole.length < 20) R.errosConsole.push(String(e.message).slice(0, 240)); });
  const shot = async n => { try { fs.writeFileSync(path.join(out, 'itens_' + n + '.png'), (await wc.capturePage()).toPNG()); } catch (e) {} };
  setTimeout(() => { R.falha = (R.falha || '') + ' tempo esgotado'; fs.writeFileSync(path.join(out, 'itens.json'), JSON.stringify(R, null, 2)); app.exit(1); }, 150000);
  const T = async (nome, code) => { let r; try { r = await js(code); } catch (e) { r = { ok: false, erro: String(e.message || e) }; } R.testes.push({ nome, ...r }); return r; };
  try {
    await new Promise(r => wc.once('did-finish-load', r));
    await js(`new Promise(r=>{(function w(){if(typeof ready!='undefined'&&ready&&window.UHITEMS_OK)r();else setTimeout(w,200)})()})`);
    await wait(1200);
    await js(`(()=>{const o=mk();o.name='Itens';start(o);const t=document.getElementById('title');if(t)t.style.display='none';P.berries=50000;P.lv=10;return 1})()`);
    await wait(1500);
    await T('1_sprites', `new Promise(r=>{const ids=Object.keys(UHITEMS.img);let ok=0,bad=[];let n=ids.length;ids.forEach(id=>{const i=new Image();i.onload=()=>{if(i.naturalWidth>4)ok++;else bad.push(id);if(!--n)fim()};i.onerror=()=>{bad.push(id);if(!--n)fim()};i.src=UHITEMS.img[id]});
      function fim(){const maos=Object.keys(UHITEMS.hand).length;r({ok:bad.length===0,carregados:ok,total:ids.length,falhas:bad.slice(0,10),spritesNaMao:maos,itensNovos:UHITEMS.catalog.filter(c=>!c.icone).length,armasNovas:WPN.filter(w=>w.uh).length})}})`);
    await T('2_coleta_pilha_peso', `(()=>{const a=addItem('coxa_assada',3),b=addItem('coxa_assada',20),c=addItem('lingote_ferro',5),d=addItem('perola',2);
      return{ok:a===3&&INV.coxa_assada===10&&c===5,coxa:INV.coxa_assada,limitePilha:UHI.cat.coxa_assada.stack,adicionadosAlem:b,ferro:INV.lingote_ferro,perola:INV.perola,peso:UHI.weight(),capacidade:UHI.cap()}})()`);
    await T('3_comer_beber_pocao', `(()=>{P.hp=20;P.fome=30;P.sta=10;const h0=P.hp;useItem('coxa_assada');const h1=P.hp,f1=P.fome;addItem('cafe',1);useItem('cafe');const s1=P.sta;addItem('pocao_vida',1);P.hp=10;useItem('pocao_vida');
      return{ok:h1>h0&&f1>30&&s1>10&&P.hp>=70||P.hp===P.mhp,vidaAntesDepois:[h0,h1],fome:f1,staminaDepoisCafe:s1,vidaDepoisPocao:P.hp,coxasRestantes:INV.coxa_assada}})()`);
    await T('4_equipar_desequipar', `(()=>{addItem('botas_marinheiro',1);addItem('mochila_lona',1);addItem('casaco_azul',1);const c0=UHI.cap(),mhp0=P.mhp;
      const e1=EQ.equipItem('botas',  'botas_marinheiro'),e2=EQ.equipItem('bolsa','mochila_lona'),e3=EQ.equipItem('capa','casaco_azul');const c1=UHI.cap(),mhp1=P.mhp,sum=EQ.sum(false);
      const u=EQ.unequipItem('capa');return{ok:e1&&e2&&e3&&c1===c0+40&&mhp1===mhp0+6&&u&&P.mhp===mhp0,capacidade:[c0,c1],vidaMax:[mhp0,mhp1,P.mhp],velocidade:sum.spd,slots:EQ.SL.map(s=>s[0]).join(',')}})()`);
    await T('5_arma_na_mao', `(()=>{addItem('machado_batalha',1);const i=WPN.findIndex(w=>w.uh==='machado_batalha');const ok=EQ.equipItem('arma','arma:'+i);P.doll.arma=i;
      const img=new Image();return{ok:ok&&P.doll.arma===i,arma:WPN[i].n,categoria:WPN[i].cat,ritmo:WPN[i].spd,guardaRoupa:P.wardrobe.filter(w=>w.startsWith('arma')).length}})()`);
    // ataque real com o machado (tecla de golpe) e captura
    await js(`(()=>{P.atk=0;P.ad=.3;basic();return{atk:P.atk,ad:P.ad}})()`).then(r => R.testes.push({ nome: '5b_golpe_machado', ok: r.ad > .3, duracaoGolpe: r.ad }));
    await wait(80); await shot('golpe_machado');
    await T('6_arco_sem_flecha', `(()=>{delete INV.flecha;addItem('arco_recurvo',1);const i=WPN.findIndex(w=>w.uh==='arco_recurvo');P.doll.arma=i;P.atk=0;const n0=pj.length;basic();const semFlecha=pj.length===n0;
      addItem('flecha',5);P.atk=0;P.lastA=-9;basic();const comFlecha=pj.length>n0;return{ok:semFlecha&&comFlecha&&INV.flecha===4,semFlechaNaoAtira:semFlecha,comFlechaAtira:comFlecha,flechasRestantes:INV.flecha}})()`);
    await T('7_sem_arma_de_fogo', `(()=>{P.doll.arma=-1;P.atk=0;P.lastA=-9;const n0=pj.length;basic();return{ok:pj.length===n0,projeteis:pj.length-n0}})()`);
    await T('8_loja_comprar_vender', `(()=>{const b0=P.berries;openShop('foosha');const btn=OV.querySelector('[data-b="queijo"][data-n="1"]');if(btn)btn.click();const comprou=INV.queijo===1,b1=P.berries;
      const sb=OV.querySelector('[data-s="perola"][data-n="1"]');if(sb)sb.click();const vendeu=INV.perola===1&&P.berries>b1;closeUI();return{ok:comprou&&vendeu,comprouQueijo:comprou,pagou:b0-b1,vendeuPerola:vendeu,recebeu:P.berries-b1}})()`);
    await T('9_bau_ilha_e_tesouro', `(()=>{const h={x:40,y:30,k:'b',n:50,o:0};const n0=Object.values(INV).reduce((a,b)=>a+b,0);openC(h);const n1=Object.values(INV).reduce((a,b)=>a+b,0);
      addItem('bau_dourado',1);const b0=P.berries;useItem('bau_dourado');addItem('saco_moedas',1);const b1=P.berries;useItem('saco_moedas');return{ok:n1>=n0&&P.berries-b1===300&&!INV.bau_dourado,itensNoBauDaIlha:n1-n0,bauDouradoDeu:b1-b0,sacoDeMoedas:P.berries-b1}})()`);
    await T('10_fabricacao', `(()=>{INV.lingote_ferro=4;INV.madeira=2;const r=CRAFT.find(x=>x.out==='machado_batalha');const L=CRAFT.filter(x=>UHI.cat[x.out]).length,LR=RECIPES.filter(x=>UHI.cat[x.out]).length;
      for(const k in r.in){INV[k]-=r.in[k]}const g=addItem(r.out,1);return{ok:!!r&&g===1&&INV.lingote_ferro===2&&INV.madeira===1,receitasOficina:L,receitasCozinha:LR,ferroRestante:INV.lingote_ferro}})()`);
    await T('11_ferraria_forjar', `new Promise(r=>{openTailor('armas','Ferraria de Foosha');setTimeout(()=>{const f=OV.querySelector('.uhforge'),n=f?f.querySelectorAll('[data-forge]').length:0;r({ok:n>0,receitasNaFerraria:n})},250)})`);
    await shot('ferraria'); await js(`closeUI();1`);
    await T('12_bau_pessoal', `(()=>{INT={kind:'house'};addItem('rubi',2);const g=uhBau.guardar('rubi',2);const noBau=P.bau.rubi;const r=uhBau.retirar('rubi',1);INT=null;return{ok:g===2&&noBau===2&&r===1&&INV.rubi===1&&P.bau.rubi===1,guardou:g,retirou:r,naBolsa:INV.rubi,noBau:P.bau.rubi}})()`);
    await T('13_salvar_carregar', `(()=>{const antes=JSON.stringify({INV,eqBag:P.eqBag,eq:P.eq,bau:P.bau,w:P.wardrobe});saveGame(true);const s=readSave();loadFrom(s);const depois=JSON.stringify({INV,eqBag:P.eqBag,eq:P.eq,bau:P.bau,w:P.wardrobe});
      const A=JSON.parse(antes),B=JSON.parse(depois);const dif=Object.keys(A.INV).filter(k=>A.INV[k]!==B.INV[k]);return{ok:dif.length===0&&JSON.stringify(A.bau)===JSON.stringify(B.bau)&&JSON.stringify(A.eq)===JSON.stringify(B.eq),diferencas:dif,bau:B.bau,equipado:B.eq}})()`);
    await T('14_sem_duplicar', `(()=>{const k='perola';const a=INV[k]||0;openShop('foosha');const sb=OV.querySelector('[data-s="'+k+'"][data-n="1"]');if(sb){sb.click();sb.click()}closeUI();const b=INV[k]||0;
      const dup=Object.keys(UHITEMS.catalog.reduce((m,c)=>{if(!c.icone){m[c.id]=(m[c.id]||0)+1}return m},{})).length===UHITEMS.catalog.filter(c=>!c.icone).length;return{ok:b===Math.max(0,a-1)&&dup,antes:a,depoisDeDuplaVenda:b,idsUnicos:dup}})()`);
    // inventário e equipamentos na tela
    await js(`dispatchEvent(new KeyboardEvent('keydown',{code:'KeyI',key:'i'}));1`); await wait(700); await shot('inventario');
    await js(`(()=>{const b=[...OV.querySelectorAll('.mnav .dot')].find(x=>/Equip/.test(x.textContent));if(b)b.click();return 1})()`); await wait(500); await shot('equipamentos');
    await js(`closeUI();1`);
    // navegação e combate continuam
    await T('15_mar_e_combate', `new Promise(r=>{OWN.owned=[0];OWN.cur=0;OWN.cust[0]={hc:null,sc:null,flag:0,name:'Teste',up:{}};OWN.hp[0]=shipStats(0,{}).res;addItem('canhao_ferro',1);enterSea('foosha');setTimeout(()=>{const d0=PS.st.dmg;useItem('canhao_ferro');const d1=PS.st.dmg;r({ok:MODE==='sea'&&d1>d0,modo:MODE,danoCanhao:[d0,d1]})},1200)})`);
  } catch (e) { R.falha = String(e && e.stack || e); }
  fs.writeFileSync(path.join(out, 'itens.json'), JSON.stringify(R, null, 2));
  app.exit(0);
};
