# Novidades do dia

Resumo de uma página A4 do que entrou na PetJourney em um dia, para a equipe e para quem acompanha
o produto. Cada linha sai dos commits do dia nos quatro repositórios (portal, app, site e CMS), em
português escrito por extenso e sem termos de código.

| Arquivo | Para quê |
|---|---|
| `Novidades-2026-11-17.pdf` | O resumo de 17/11/2026, pronto para enviar |
| `Novidades-2026-11-17.html` | **A fonte.** O PDF é gerado dela, nunca editado |
| `imagens/mapa-saude-publica.png` | Captura do mapa do painel da Saúde pública (protótipo), recortada pelo CSS |
| `phosphor/` | Só os ícones Phosphor que a folha usa (de `@phosphor-icons/web`) |
| `fontes/` | Readex Pro em pesos **fixos** (400 e 600), de `@fontsource/readex-pro` (OFL) |

Logo e faixa vêm de `../apresentacao/`. O molde é o da folha de venda (`../venda`): fonte em peso
fixo, nada de sombra desfocada nem fundo semitransparente, para o PDF abrir certo no iPhone.

## Regenerar o PDF

```powershell
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$dir  = "<caminho>\docs\novidades"

& $edge --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=5000 `
  --print-to-pdf="$dir\Novidades-2026-11-17.pdf" `
  "file:///$($dir -replace '\\','/')/Novidades-2026-11-17.html"
```

Precisa sair **uma página só**: a folha corta o que passar de 297 mm, então olhe se o rodapé
aparece inteiro. Confira também que o PDF não tem `/Type3`:

```bash
node -e "const b=require('fs').readFileSync('Novidades-2026-11-17.pdf','latin1');console.log((b.match(/\/Subtype\s*\/Type3/g)||[]).length)"
```

Precisa dar 0.
