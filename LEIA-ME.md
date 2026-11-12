# Pirate MMO — app Windows com atualização automática

O jogo continua sendo o mesmo HTML independente (`../onepiece_hd2d__67_navegacao_corrigida.html`).
Este projeto só o embala no Electron, gera o instalador `.exe` e publica as atualizações no GitHub Releases.
O servidor multijogador (`../opmp`, socket.io) continua separado e não é incluído no app.

## Estrutura
- `electron/main.js`: janela do jogo (tela cheia com F11, menu *Jogo > Resolução*, tamanho lembrado), segurança (contextIsolation, sandbox, sem nodeIntegration, CSP, bloqueio de navegação e de janelas novas), protocolo `app://` (os saves e opções do jogo ficam no mesmo lugar entre versões).
- `electron/updater.js`: procura atualização ao abrir e pergunta antes de baixar. Mostra o progresso no jogo e na barra de tarefas. Instala ao confirmar ou ao fechar o jogo. Sem internet ou sem release, o jogo segue normal. Registro: `%APPDATA%\Pirate MMO\atualizacao.log`.
- `electron/preload.js`: mostra "Pirate MMO vX.Y.Z" no canto e a faixa de progresso da atualização.
- `scripts/copy-game.js`: copia o HTML do jogo para `game/index.html` (campo `gameSource` do package.json).
- `build/icon.ico`: ícone (leme da folha de UI).
- `.github/workflows/release.yml`: publicação manual pela aba Actions.

## Antes da primeira publicação
1. Crie um repositório no GitHub chamado `pirate-mmo`. **Ele precisa ser público** para os amigos receberem as atualizações sem senha. Atenção: num repositório público, qualquer pessoa consegue baixar o jogo.
2. No `package.json`, em `build > publish`, troque `SEU_USUARIO_GITHUB` pelo seu usuário (ou organização).
3. No GitHub: *Settings > Actions > General > Workflow permissions*: deixe **Read and write permissions**.

## Comandos (PowerShell, usando npm.cmd)
Na pasta `pirate-mmo`:

```powershell
npm.cmd install                       # instalar dependências
node node_modules\electron\install.js # só se o Electron não baixou o executável (npm 11 bloqueia scripts)
npm.cmd start                         # abrir o jogo no Electron (desenvolvimento)
npm.cmd run selftest                  # teste automático: grava %APPDATA%\Pirate MMO\selftest.json
npm.cmd run build                     # gerar dist\Pirate-MMO-Setup-<versão>.exe (não publica)
```

Subir para o GitHub (primeira vez):
```powershell
git init
git add .
git commit -m "Pirate MMO 0.1.0"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO_GITHUB/pirate-mmo.git
git push -u origin main
```
O `game/index.html` tem cerca de 49 MB. O GitHub aceita, mas avisa acima de 50 MB por arquivo.

## Publicar uma versão
Dê dois cliques em **Publicar Pirate MMO** (área de trabalho) ou rode `publicar.cmd`. Ele copia o HTML mais novo, faz o commit e o push.
O GitHub Actions publica sozinho a cada push que mude o jogo ou o app, com a versão `0.1.<número da execução>` (sempre maior; não precisa mexer no package.json). O release traz `Pirate-MMO-Setup-<versão>.exe`, `.blockmap` e `latest.yml`.

Publicar do seu PC (opcional, em vez do Actions): crie um token clássico com escopo `repo` e use-o **só na sessão**:
```powershell
$env:GH_TOKEN = "seu_token"   # nunca coloque o token em arquivos
npm.cmd run release
Remove-Item Env:GH_TOKEN
```

## Instalar no PC de um amigo e atualizar
1. Publique a **0.1.0** (passos acima) e mande o link do release para o amigo, ou o próprio `Pirate-MMO-Setup-0.1.0.exe`.
2. Ele instala. Sem certificado de assinatura, o Windows SmartScreen mostra "O Windows protegeu o computador": clique em *Mais informações > Executar assim mesmo*. O instalador cria o atalho na área de trabalho.
3. Publique a **0.1.1**.
4. O amigo abre o jogo. Em cerca de 4 s aparece "Nova versão 0.1.1"; ele clica em *Baixar agora*, vê o progresso, e depois em *Reiniciar e instalar* (ou fecha o jogo, que a instalação acontece ao sair). Ao abrir de novo, o canto mostra "Pirate MMO v0.1.1". Saves e opções continuam.

## Teste local da atualização (sem GitHub)
```powershell
npm.cmd run build                                                   # dist\ = 0.1.0
npm.cmd version 0.1.1 --no-git-tag-version
npx.cmd electron-builder --win nsis --publish never '--config.directories.output=dist-0.1.1'
npm.cmd version 0.1.0 --no-git-tag-version
python -m http.server 8790 --directory dist-0.1.1                   # em outro terminal
$env:PM_UPDATE_URL = "http://localhost:8790/"; $env:PM_UPDATE_TEST = "1"
& ".\dist\win-unpacked\Pirate MMO.exe"                              # baixa a 0.1.1 e grava teste-atualizacao.json
```
`PM_UPDATE_TEST=1` aceita o download sozinho e **não instala**. Sem ele, o fluxo é o normal, com as perguntas.
