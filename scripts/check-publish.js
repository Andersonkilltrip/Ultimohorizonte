// Impede publicar com o dono do repositório ainda em branco e sem token.
const pkg = require('../package.json');
const pub = (pkg.build && pkg.build.publish && pkg.build.publish[0]) || {};
if (!pub.owner || /SEU_USUARIO/.test(pub.owner)) {
  console.error('[release] Defina "owner" (seu usuário ou organização do GitHub) em package.json > build > publish.');
  process.exit(1);
}
if (!process.env.GH_TOKEN && !process.env.GITHUB_TOKEN) {
  console.error('[release] Falta GH_TOKEN. Publique pelo GitHub Actions (recomendado) ou defina GH_TOKEN só na sua sessão do PowerShell.');
  process.exit(1);
}
console.log('[release] publicando v' + pkg.version + ' em ' + pub.owner + '/' + pub.repo);
