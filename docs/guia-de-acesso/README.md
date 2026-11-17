# Guia de acesso ao portal

Uma página A4 que ensina a equipe da empresa parceira a entrar no portal de produção
(`https://portal.petjourney.health`), passo a passo, com o que fazer se esquecer a senha, se
recebeu convite da equipe, se ainda não tem conta ou se o login der erro. No rodapé, o contato
e o QR code da marca (baixar o app e saber mais).

| Arquivo | Para quê |
|---|---|
| `Como-entrar-no-portal.pdf` | O guia pronto para enviar |
| `Como-entrar-no-portal.html` | **A fonte.** O PDF é gerado dela, nunca editado |
| `imagens/entrada-producao.png` | A tela de entrada **de produção** (versão 0.2.0, 17/11/2026), sem o painel verde da direita |
| `phosphor/` | Só os ícones Phosphor que o guia usa |

Fontes e QR code vêm de `../venda/` (Readex Pro em pesos fixos e `imagens/qr-petjourney.png`);
logo e faixa, de `../apresentacao/`.

## O que o guia descreve

Tudo conferido no código do `main` (o que roda em produção) em 17/11/2026: `auth/login.vue`
("Olá de novo", "Esqueceu a senha?", "Manter conectado neste computador", "Entrar no painel",
"Ainda não tem conta? Criar conta"), `auth/forgot-password.vue` (e-mail, código de 6 dígitos,
nova senha), o convite da equipe (entrar ou criar conta, depois "Aceitar convite") e a troca de
empresa pelo nome dela no alto da barra. Se a tela de entrada mudar em produção, refaça a
captura e confira os textos entre aspas.

## Refazer a captura de produção

```bash
msedge --headless=new --disable-gpu --hide-scrollbars --window-size=1440,900 \
  --virtual-time-budget=15000 --screenshot=entrada.png https://portal.petjourney.health/auth/login
```

O recorte usado é x 110 a 680, y 115 a 720. O painel verde da direita invade esse recorte; ele é
apagado com `pngjs` (pixels esverdeados, `g - r >= 6`, acima de x 540, fora do texto de apoio e dos
campos):

```bash
node -e "
const {PNG}=require('pngjs');const fs=require('fs');const p=PNG.sync.read(fs.readFileSync('entrada.png'));
for(let y=0;y<760;y++)for(let x=540;x<760;x++){
  if(y<390&&x<585)continue; if(y>=390&&x<=672)continue;
  const i=(y*p.width+x)*4; if(p.data[i+1]-p.data[i]>=6){p.data[i]=250;p.data[i+1]=249;p.data[i+2]=245}}
fs.writeFileSync('docs/guia-de-acesso/imagens/entrada-producao.png',PNG.sync.write(p))"
```

Se a tela mudar de posição, recalcule o recorte e o topo dos números (a conta está no comentário
do `.janela`, no HTML).

## Gerar o PDF

```powershell
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$dir  = "<caminho>\docs\guia-de-acesso"

& $edge --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=5000 `
  --print-to-pdf="$dir\Como-entrar-no-portal.pdf" `
  "file:///$($dir -replace '\\','/')/Como-entrar-no-portal.html"
```

Precisa sair **uma página só** e sem fonte Type 3 (o iPhone a desenha quebrada). Nada de sombra
desfocada nem fundo semitransparente (viram caixa escura no iPhone). Texto em português por
extenso, sem ", e" ligando orações.
