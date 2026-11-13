// Prepara o jogo para o app: lê o HTML independente (o original não é alterado) e grava game/index.html
// SEM as imagens/sons embutidos: cada "data:...;base64,..." grande vira um arquivo em game/a/<hash>.<ext>
// e o texto passa a apontar para "a/<hash>.<ext>". O app carrega tudo por app://game/ (mesma origem),
// então recolorir/medir imagens com canvas continua funcionando. Arquivos que deixaram de ser usados são apagados.
// Fonte: campo "gameSource" do package.json ou variável GAME_HTML. Se a fonte não existir (ex.: GitHub Actions),
// usa o game/ que já está no repositório.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const src = path.resolve(root, process.env.GAME_HTML || pkg.gameSource || '');
const gdir = path.join(root, 'game'), adir = path.join(gdir, 'a'), dst = path.join(gdir, 'index.html'), stamp = path.join(gdir, '.fonte.json');
const EXT = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/svg+xml': 'svg', 'audio/mpeg': 'mp3', 'audio/wav': 'wav', 'audio/ogg': 'ogg', 'video/mp4': 'mp4', 'font/woff2': 'woff2', 'font/ttf': 'ttf' };
const MIN = 2048; // data URIs menores ficam embutidos (ícones minúsculos)
fs.mkdirSync(adir, { recursive: true });
if (!(src && fs.existsSync(src) && fs.statSync(src).isFile())) {
  if (fs.existsSync(dst)) { console.log('[jogo] fonte não encontrada; usando game/ do repositório'); process.exit(0); }
  console.error('[jogo] ERRO: não achei o HTML do jogo. Ajuste "gameSource" no package.json ou defina GAME_HTML.'); process.exit(1);
}
const st = fs.statSync(src), marca = { nome: path.basename(src), size: st.size, mtime: st.mtimeMs, v: 2 };
try { const old = JSON.parse(fs.readFileSync(stamp, 'utf8')); if (fs.existsSync(dst) && old.size === marca.size && old.mtime === marca.mtime && old.v === 2) { console.log('[jogo] game/ já está atualizado'); process.exit(0); } } catch (e) {}
let html = fs.readFileSync(src, 'utf8');
const usados = new Set(); let n = 0, bytes = 0;
html = html.replace(/data:([a-z]+\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)/g, (all, mime, b64) => {
  const ext = EXT[mime]; if (!ext || all.length < MIN) return all;
  const buf = Buffer.from(b64, 'base64'), h = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16), nome = h + '.' + ext;
  if (!usados.has(nome)) { usados.add(nome); const f = path.join(adir, nome); if (!fs.existsSync(f) || fs.statSync(f).size !== buf.length) fs.writeFileSync(f, buf); n++; bytes += buf.length; }
  return 'a/' + nome;
});
for (const f of fs.readdirSync(adir)) if (!usados.has(f)) fs.unlinkSync(path.join(adir, f));
fs.writeFileSync(dst, html);
fs.writeFileSync(stamp, JSON.stringify(marca));
console.log('[jogo] ' + marca.nome + ' (' + (st.size / 1048576).toFixed(1) + ' MB) → game/index.html ' + (Buffer.byteLength(html) / 1048576).toFixed(1) + ' MB + ' + n + ' arquivos em game/a (' + (bytes / 1048576).toFixed(1) + ' MB)');
