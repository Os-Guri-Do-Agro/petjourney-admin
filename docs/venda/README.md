# Folha de venda para clínicas

Uma página A4 para entregar ou mandar a clínicas veterinárias e profissionais: quem é a
PetJourney, o que ela faz, o que a clínica já tem hoje e como ajuda a clínica e o responsável
pelo pet. A oferta é gratuita para a clínica.

| Arquivo | Para quê |
|---|---|
| `PetJourney-para-clinicas.pdf` | A folha pronta para enviar |
| `PetJourney-para-clinicas.html` | **A fonte.** O PDF é gerado dela, nunca editado |
| `imagens/app-inicio.webp` | O app no celular, a mesma imagem do site (`petjourney-web/src/assets/app-telas/pt/aparelho-home.webp`) |
| `phosphor/` | Só os ícones Phosphor que a folha usa (gerados de `@phosphor-icons/web`) |
| `fontes/` | Readex Pro em pesos **fixos** (400 e 600), de `@fontsource/readex-pro` (OFL) |
| `imagens/qr-cadastro.svg` | QR code do rodapé, para `https://petjourney.health/parcerias` (vetor, sem transparência) |

O QR sai da biblioteca `qrcode`, que o portal já usa. Para gerar de novo (da raiz do repositório):

```bash
node -e "require('qrcode').toString('https://petjourney.health/parcerias',{type:'svg',margin:0,errorCorrectionLevel:'M',color:{dark:'#285e4eff',light:'#ffffffff'}},(e,s)=>require('fs').writeFileSync('docs/venda/imagens/qr-cadastro.svg',s))"
```

Logo, faixa e a tela da Clínica vêm de `../apresentacao/` (a captura `telas/10-clinica-hoje.png`,
recortada pelo CSS para não mostrar o Hotel, que está pausado).

**Nunca use a fonte variável** (a `readex-pro-*-wght-normal.woff2` da apresentação): o Edge a
embute como fonte Type 3, e o leitor de PDF do iPhone e do Mac a desenha quebrada. Depois de gerar,
confira que o PDF não tem `/Type3`:

```bash
node -e "const b=require('fs').readFileSync('PetJourney-para-clinicas.pdf','latin1');console.log((b.match(/\/Subtype\s*\/Type3/g)||[]).length)"
```

Precisa dar 0.

**Nada de sombra desfocada** (`box-shadow` com desfoque, `filter: drop-shadow`, `blur`) nem fundo
semitransparente: o Edge transforma isso em camada transparente, e o iPhone pinta a camada como
uma caixa escura por cima do que está atrás. Contorno e fundo, sempre em cor sólida.

## O que a folha promete

Cada linha foi conferida no portal e no site em 17/11/2026: telas da Clínica ligadas à API
(`src/navegacao/rotas-dos-modulos.ts`), textos do portal (`src/locales/pt.json`) e do site
(`petjourney-web/messages/pt.json`). Ficou de fora o que ainda não funciona de ponta a ponta, como o
lembrete de vacina disparado pela clínica (a rota da API ainda não existe). Antes de acrescentar
uma promessa, confira que ela já funciona.

Ao mexer no texto: português escrito por extenso, sem contrações informais ("num", "numa", "pra",
"pro", "tá", "a gente"), e nunca dizer que os dados das imagens são de teste ou de exemplo.

## Regenerar o PDF

```powershell
$edge = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
$dir  = "<caminho>\docs\venda"

& $edge --headless=new --disable-gpu --no-pdf-header-footer --virtual-time-budget=5000 `
  --print-to-pdf="$dir\PetJourney-para-clinicas.pdf" `
  "file:///$($dir -replace '\\','/')/PetJourney-para-clinicas.html"
```

Precisa sair **uma página só**. Uma linha a mais em qualquer bloco empurra o rodapé para a
segunda; olhe o PDF antes de mandar.
