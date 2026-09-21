# Apresentação do módulo clínico

Dois documentos para quem leva o produto a uma clínica, com públicos diferentes: um é o que se
**projeta na parede**, o outro é o que fica na **mão de quem fala**.

| Arquivo | Para quê |
|---|---|
| `Apresentacao-Fluxo-Clinico.pptx` | Os slides — 22 telas, 16:9, cobrindo o fluxo clínico inteiro |
| `apresentacao-modelo.mjs` | **A fonte dos slides**: conteúdo e geometria. É aqui que se edita |
| `gerar-apresentacao.mjs` | Traduz o modelo para PowerPoint. **O .pptx é gerado, não editado à mão** |
| `previa-html.mjs` | Traduz o mesmo modelo para HTML, para **olhar e medir** antes de gerar |
| `Roteiro-Apresentacao-Modulo-Clinico.docx` | O roteiro falado, com fala sugerida e plano B — editável |
| `Roteiro-Apresentacao-Modulo-Clinico.pdf` | O mesmo roteiro, para imprimir ou mandar por e-mail |
| `gerar-roteiro.mjs` | A fonte do roteiro. **O Word é gerado, não editado à mão** |

A paleta é a dos relatórios em [`../relatorio/`](../relatorio/) — de propósito: eles circulam
juntos, e duas identidades visuais para o mesmo assunto fazem quem recebe procurar a diferença
onde não há.

## Os slides

Quatro blocos, com divisória própria, mais capa e fecho:

1. **O dia começa** — navegação, os quatro blocos do menu, contadores de pendência, busca global
2. **O atendimento** — agenda, a falta que vira ligação, prontuário em cinco etapas, receituário, documentos e vacinas
3. **A internação** — mapa de leitos, o turno, o boletim ao responsável, a alta hospitalar
4. **Como isto foi construído** — os seis princípios, o estado real da entrega, o que vem a seguir

O slide **"O que é real, e o que ainda é protótipo"** não é opcional. O produto é protótipo
navegável, sem integração com servidor, e prometer o que não existe custa a próxima reunião.

## Por que o conteúdo é separado do gerador

A primeira versão desta apresentação saiu com o layout quebrado — tabela por cima de cartão,
texto vazando da moldura — e passou porque foi conferida por **estimativa de largura de
caractere** numa máquina sem PowerPoint. Estimativa não é verificação.

Agora `apresentacao-modelo.mjs` não produz PowerPoint: produz uma lista de operações de desenho
com posição e tamanho em polegadas. Dois renderizadores leem a mesma lista, e o HTML é o que
permite **olhar**, porque o navegador tem a mesma fonte e as mesmas margens internas.

Duas propriedades do modelo que vale conhecer antes de mexer nele:

- **Nenhum `y` de bloco é escrito à mão.** Cada slide declara seus blocos em ordem e `empilhar`
  os distribui. Foi a conta à mão que sobrepôs a tabela aos cartões.
- **A sobra vertical entra nos cartões, não no rodapé.** Os blocos são elásticos: crescem e
  passam a centrar o texto. Cartão alto com o texto no topo lê-se como buraco; o mesmo cartão com
  o texto no meio lê-se como folga deliberada.

## Fluxo de trabalho ao mudar um slide

```sh
# 1 · edite apresentacao-modelo.mjs

# 2 · gere a prévia e meça (não precisa instalar nada; usa o Edge que vem no Windows)
node previa-html.mjs previa.html
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" ^
  --headless=new --disable-gpu --virtual-time-budget=4000 --dump-dom previa.html
```

O `<title>` da página devolve o veredito: `OK 0 falhas`, ou a lista do que estourou a caixa e do
que passou do rodapé. Num elemento `#medidas` escondido vêm mais dois relatórios:

| Relatório | O que significa |
|---|---|
| **APERTOS** | Cartão com menos de ⅛" de sobra. É ele que arrisca ganhar uma linha no PowerPoint e vazar — a métrica do navegador não é idêntica à do Office |
| **FOLGAS** | Cartão alinhado ao topo que sobrou vazio, com a altura que o conteúdo de fato pede. É o número que se copia para `altura` na grade |

Para **olhar**, e não só medir:

```sh
node previa-html.mjs contato.html --contato     # os 22 slides numa folha de contato
node previa-html.mjs um.html --slides=17-17     # um slide em tamanho real
```

O recorte por intervalo existe porque uma captura de tela começa no topo da página: sem ele não
há como ver de perto o slide 20 — e é o de baixo que costuma quebrar.

Só depois de `OK 0 falhas` **e** de olhar a folha de contato é que se gera o PowerPoint:

```sh
mkdir -p /tmp/pptgen && cd /tmp/pptgen && npm init -y && npm install pptxgenjs
cp <caminho>/{gerar-apresentacao.mjs,apresentacao-modelo.mjs} .
node gerar-apresentacao.mjs <caminho>/Apresentacao-Fluxo-Clinico.pptx
```

A cópia para o diretório de instalação é necessária: a resolução de módulo do Node procura
`node_modules` a partir da pasta do próprio script, não do diretório corrente. O `pptxgenjs`
**não é dependência do portal** — este documento não faz parte do build.

## O que se conferiu no .pptx, e como

Com PowerPoint instalado, abrir e olhar resolve. Sem ele, o arquivo é um zip de XML e dá para
conferir o que importa:

```sh
unzip -p Apresentacao-Fluxo-Clinico.pptx ppt/slides/slide16.xml | grep -o '<a:lnSpc>...'
unzip -p Apresentacao-Fluxo-Clinico.pptx ppt/slides/slide19.xml | grep -o '<a:bodyPr[^>]*>'
```

Os dois pontos que decidem se o texto cabe:

- **`lnSpc` por parágrafo.** A entrelinha do PowerPoint é propriedade de parágrafo, não de
  trecho. Se ela não saísse por parágrafo, o título de 19 pt da caixa vermelha do slide 16
  herdaria a entrelinha de 14 pt do corpo e se sobreporia. Confira que ali saem `1150`, `2600` e
  `1600` — os mesmos valores do modelo.
- **`lIns`/`rIns` em `bodyPr`.** São as margens internas, e o padrão do PowerPoint (0,1") não é o
  que o modelo usa (8 pt = 0,111"). Declaradas erradas, cada cartão perde ou ganha caracteres por
  linha e a medição da prévia deixa de valer. `101600` EMU é o valor certo.

## Ao mudar uma tela do fluxo clínico

Revise os **três** documentos: os slides, o roteiro falado e o
[05](../05-roteiro-de-demonstracao.md), que é o levantamento técnico do mesmo percurso. Eles já
divergiram uma vez — o 05 listava vacinação e digitação por teclado como inexistentes depois de as
duas terem sido construídas.
