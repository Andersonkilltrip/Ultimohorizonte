'use strict';
// PM_DIAG=velas: prancha com todos os navios em 4 variações de vela/casco (para conferir a personalização).
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const wait = ms => new Promise(r => setTimeout(r, ms));
module.exports = async function (win) {
  const out = path.join(app.getPath('userData'), 'diag'); fs.mkdirSync(out, { recursive: true });
  const wc = win.webContents, js = c => wc.executeJavaScript(c);
  try {
    await new Promise(r => wc.once('did-finish-load', r));
    await js(`new Promise(r=>{(function w(){if(typeof ready!='undefined'&&ready)r();else setTimeout(w,200)})()})`); await wait(1500);
    await js(`(()=>{const o=mk();o.name='V';start(o);return 1})()`); await wait(1500);
    const url = await js(`(()=>{const V=[[null,null],['#c02020',null],['#202020',null],['#e0e0e0','#2040c0'],['#3070d0',null]],cell=150,ids=[...Array(14).keys()];
      const cv=document.createElement('canvas');cv.width=V.length*cell+120;cv.height=ids.length*120;const g=cv.getContext('2d');g.fillStyle='#1b3a55';g.fillRect(0,0,cv.width,cv.height);g.font='14px sans-serif';g.fillStyle='#fff';
      ids.forEach((id,r)=>{g.fillText('navio '+id,6,r*120+60);V.forEach(([sc,hc],k)=>{const S={id,hc,sc,a:-Math.PI/2+.35,turn:0,ph:0,up:{},al:1,flag:1};try{g.save();g.translate(130+k*cell,r*120+80);g.scale(.3,.3);drawShip(g,S,0,0,1);g.restore()}catch(e){g.fillText('erro',130+k*cell,r*120+60)}})});
      V.forEach(([sc,hc],k)=>{g.fillText((sc||'padrão')+(hc?' casco '+hc:''),90+k*cell,14)});return cv.toDataURL()})()`);
    fs.writeFileSync(path.join(out, 'velas.png'), Buffer.from(url.split(',')[1], 'base64'));
  } catch (e) { fs.writeFileSync(path.join(out, 'velas_erro.txt'), String(e.stack || e)); }
  app.exit(0);
};
