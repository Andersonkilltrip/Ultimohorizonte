@echo off
rem Publica a versao atual do jogo: copia o HTML, faz o commit e envia ao GitHub.
rem O GitHub Actions gera o instalador e os jogadores recebem a atualizacao ao abrir o jogo.
cd /d "%~dp0"
call npm.cmd run prepare-game || goto erro
git add -A || goto erro
git diff --cached --quiet && (echo Nada mudou desde a ultima publicacao. & goto fim)
git commit -q -m "Atualizacao %date% %time:~0,5%" || goto erro
git push -q || goto erro
echo.
echo Enviado. Em uns 10 minutos a versao nova aparece em:
echo https://github.com/Andersonkilltrip/Ultimohorizonte/releases
goto fim
:erro
echo.
echo ERRO ao publicar. Copie esta janela e mande para o Claude.
:fim
if "%1"=="" pause
