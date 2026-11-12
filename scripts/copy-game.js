// Copia o HTML independente do jogo para game/index.html (o original não é alterado).
// Fonte: campo "gameSource" do package.json ou variável GAME_HTML. Se a fonte não existir (ex.: GitHub Actions),
// usa o game/index.html que já está no repositório.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const src = path.resolve(root, process.env.GAME_HTML || pkg.gameSource || '');
const dst = path.join(root, 'game', 'index.html');
fs.mkdirSync(path.dirname(dst), { recursive: true });
if (src && fs.existsSync(src) && fs.statSync(src).isFile()) {
  const a = fs.statSync(src);
  const same = fs.existsSync(dst) && fs.statSync(dst).size === a.size && fs.statSync(dst).mtimeMs >= a.mtimeMs;
  if (!same) { fs.copyFileSync(src, dst); console.log('[jogo] copiado:', path.basename(src), '→ game/index.html', (a.size / 1048576).toFixed(1) + ' MB'); }
  else console.log('[jogo] game/index.html já está atualizado');
} else if (fs.existsSync(dst)) {
  console.log('[jogo] fonte não encontrada; usando game/index.html do repositório');
} else {
  console.error('[jogo] ERRO: não achei o HTML do jogo. Ajuste "gameSource" no package.json ou defina GAME_HTML.');
  process.exit(1);
}
