/**
 * Renderiza o modelo da apresentação como página HTML, para conferir o layout **olhando**.
 *
 * O PowerPoint não existe em toda máquina, e um .pptx não se lê em diff nem em captura de tela.
 * Esta prévia usa a mesma lista de operações do `gerar-apresentacao.mjs` e a mesma geometria em
 * polegadas (1" = 96 px), com a mesma fonte e as mesmas margens internas — então o que se vê
 * aqui é o que o PowerPoint vai mostrar, a menos de diferenças finas de quebra de linha.
 *
 * Além de servir para olhar, a página **se mede**: um script no fim compara, para cada caixa de
 * texto, a altura que o conteúdo ocupa com a altura que a caixa tem, e escreve o resultado em
 * `document.title`. É medição com a fonte de verdade — não estimativa por média de caractere,
 * que foi o erro que deixou passar o layout quebrado da primeira versão.
 *
 *   node previa-html.mjs previa.html
 *   start previa.html          # ou: msedge --headless --screenshot=... previa.html
 */

import fs from 'node:fs'
import { slides, C, FONTE, LARGURA, ALTURA, LIMITE, RODAPE } from './apresentacao-modelo.mjs'

const destino = process.argv[2] ?? 'previa.html'

/**
 * `--contato` encolhe os slides numa folha de contato, para julgar o conjunto de uma vez:
 * equilíbrio entre os slides, densidade parecida, nenhum vazio gritante. A medição continua
 * valendo — ela roda antes da escala, sobre o tamanho real.
 */
const contato = process.argv.includes('--contato')

/** Três por fileira: pequeno o bastante para caber numa tela, grande o bastante para julgar. */
const ESCALA = 0.42

/**
 * `--slides=9-12` limita a prévia a um intervalo. Uma captura de tela começa no topo da página,
 * então sem recorte não há como olhar de perto o slide 20 — e é o de baixo que costuma quebrar.
 */
const recorte = (process.argv.find((a) => a.startsWith('--slides=')) ?? '').slice(9)
const [de, ate] = recorte ? recorte.split('-').map(Number) : [1, Infinity]

const PX = 96 // 1 polegada
const PT = 96 / 72 // 1 ponto

const pol = (v) => `${(v * PX).toFixed(2)}px`
const pt = (v) => `${(v * PT).toFixed(2)}px`
const cor = (hex) => `#${hex}`

function escapar(t) {
  return String(t)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

/** Um trecho de texto. `quebra` fecha o parágrafo — o mesmo contrato do PowerPoint. */
function runHtml(run, base) {
  const estilo = [
    run.forte ? 'font-weight:700' : '',
    run.cor ? `color:${cor(run.cor)}` : '',
    run.tamanho ? `font-size:${pt(run.tamanho)}` : '',
    run.entrelinha ? `line-height:${pt(run.entrelinha)}` : '',
    run.espacamento ? `letter-spacing:${pt(run.espacamento)}` : '',
  ]
    .filter(Boolean)
    .join(';')

  // A quebra explícita dentro do texto vira quebra de linha, como no PowerPoint.
  const conteudo = escapar(run.t).replace(/\n/g, '<br>')
  return `<span style="${estilo}">${conteudo}</span>`
}

/**
 * Agrupa os trechos em parágrafos: `quebra: true` fecha o parágrafo corrente.
 * É o que o pptxgenjs faz com `breakLine`, e precisa ser igual aqui para as alturas baterem.
 */
function paragrafos(runs, base) {
  const saida = []
  let corrente = []
  runs.forEach((run) => {
    corrente.push(runHtml(run, base))
    if (run.quebra) {
      saida.push(corrente)
      corrente = []
    }
  })
  if (corrente.length) saida.push(corrente)
  return saida
}

function opHtml(op) {
  if (op.tipo === 'retangulo') {
    const estilo = [
      'position:absolute',
      `left:${pol(op.x)}`,
      `top:${pol(op.y)}`,
      `width:${pol(op.w)}`,
      `height:${pol(op.h)}`,
      `background:${cor(op.fill)}`,
      op.line ? `border:1px solid ${cor(op.line)};box-sizing:border-box` : '',
      op.raio ? `border-radius:${pol(op.raio)}` : '',
    ]
      .filter(Boolean)
      .join(';')
    return `<div style="${estilo}"></div>`
  }

  if (op.tipo === 'texto') {
    const alinhamentoVertical = { top: 'flex-start', middle: 'center', bottom: 'flex-end' }[op.valign]
    const caixa = [
      'position:absolute',
      `left:${pol(op.x)}`,
      `top:${pol(op.y)}`,
      `width:${pol(op.w)}`,
      `height:${pol(op.h)}`,
      'box-sizing:border-box',
      'display:flex',
      'flex-direction:column',
      `justify-content:${alinhamentoVertical}`,
      `padding:${pt(op.margem)}`,
      `font-size:${pt(op.tamanho)}`,
      `line-height:${pt(op.entrelinha)}`,
      `color:${cor(op.cor)}`,
      `text-align:${op.align}`,
      op.fill ? `background:${cor(op.fill)}` : '',
      op.line ? `border:1px solid ${cor(op.line)}` : '',
      op.raio ? `border-radius:${pol(op.raio)}` : '',
    ]
      .filter(Boolean)
      .join(';')

    const marcador = op.marcador
      ? `padding-left:${pt(13)};text-indent:${pt(-13)}`
      : ''
    const espaco = op.espacoDepois ? `margin-bottom:${pt(op.espacoDepois)}` : ''

    const corpo = paragrafos(op.runs, op)
      .map((p, i, todos) => {
        const ultimo = i === todos.length - 1
        const estilo = [marcador, ultimo ? '' : espaco].filter(Boolean).join(';')
        const prefixo = op.marcador ? '• ' : ''
        return `<p style="margin:0;${estilo}">${prefixo}${p.join('')}</p>`
      })
      .join('')

    return `<div class="medir" style="${caixa}"><div style="width:100%">${corpo}</div></div>`
  }

  if (op.tipo === 'tabela') {
    const colunas = op.colW.map((c) => `<col style="width:${pol(c)}">`).join('')
    const cabecalho = op.cabecalho
      .map(
        (c) =>
          `<th style="background:${cor(C.verde)};color:${cor(C.branco)};font-weight:700;padding:${pt(7)} ${pt(9)};text-align:left;vertical-align:middle;border:1px solid ${cor(C.verdeLinha)}">${escapar(c)}</th>`,
      )
      .join('')
    const corpo = op.linhas
      .map((linha, i) => {
        const fundo = i % 2 === 0 ? C.branco : C.verdeFundo
        const celulas = linha
          .map(
            (celula, j) =>
              `<td style="background:${cor(fundo)};color:${cor(C.tinta)};${j === 0 ? 'font-weight:700;' : ''}padding:${pt(8)} ${pt(9)};vertical-align:middle;border:1px solid ${cor(C.verdeLinha)}">${escapar(celula)}</td>`,
          )
          .join('')
        return `<tr style="height:${pol(op.alturaLinha)}">${celulas}</tr>`
      })
      .join('')

    return `<table class="tabela" style="position:absolute;left:${pol(op.x)};top:${pol(op.y)};width:${pol(op.w)};border-collapse:collapse;table-layout:fixed;font-size:${pt(10.5)};line-height:${pt(13.5)}"><colgroup>${colunas}</colgroup><thead><tr style="height:${pol(op.alturaLinha)}">${cabecalho}</tr></thead><tbody>${corpo}</tbody></table>`
  }

  return ''
}

const paginas = slides
  .map((slide, i) => ({ slide, numero: i + 1 }))
  .filter(({ numero }) => numero >= de && numero <= (ate || de))
  .map(({ slide, numero }) => {
    const cromo =
      slide.tipo === 'conteudo'
        ? [
            `<div style="position:absolute;left:0;top:0;width:${pol(LARGURA)};height:${pol(0.14)};background:${cor(C.verde)}"></div>`,
            `<div style="position:absolute;left:${pol(0.62)};top:${pol(6.95)};font-size:${pt(9)};color:${cor(C.fraco)}">${RODAPE}</div>`,
            `<div style="position:absolute;right:${pol(0.62)};top:${pol(6.95)};font-size:${pt(9)};color:${cor(C.fraco)}">${numero}</div>`,
            `<div class="limite" style="position:absolute;left:0;top:${pol(LIMITE)};width:${pol(LARGURA)};height:1px"></div>`,
          ].join('')
        : ''

    const secao = `<section class="slide" data-n="${numero}" style="width:${pol(LARGURA)};height:${pol(ALTURA)}">${cromo}${slide.ops.map(opHtml).join('')}</section>`
    return contato ? `<div class="quadro" data-n="${numero}">${secao}</div>` : secao
  })
  .join('\n')

const html = `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>medindo…</title>
<style>
  * { margin: 0; padding: 0; }
  body { background: #7c8a86; font-family: '${FONTE}', 'Segoe UI', sans-serif; }
  .slide { position: relative; background: #fff; overflow: hidden; }
  /* Sem espaço entre slides: a captura inteira vira uma tira em que cada
     ${ALTURA * PX} px é um slide, e recortar fica trivial. */
  .estourou { outline: 3px solid #d33 !important; outline-offset: -3px; }
  .passou { outline: 3px dashed #d33 !important; }
${
  contato
    ? `  /* O slide mantém o tamanho real — só o invólucro encolhe. Mudar a largura do slide
     quebraria a posição absoluta de tudo que está dentro dele. */
  body { display: flex; flex-wrap: wrap; gap: 12px; padding: 12px;
         width: ${Math.round(3 * LARGURA * PX * ESCALA + 4 * 12)}px; }
  .quadro { position: relative; overflow: hidden; outline: 1px solid #46534f;
            width: ${Math.round(LARGURA * PX * ESCALA)}px;
            height: ${Math.round(ALTURA * PX * ESCALA)}px; }
  .quadro .slide { transform: scale(${ESCALA}); transform-origin: top left; }
  .quadro::after { content: attr(data-n); position: absolute; right: 4px; bottom: 2px;
                   font-size: 11px; color: #fff; background: #46534f; padding: 0 5px; }`
    : ''
}
</style>
</head>
<body>
${paginas}
<script>
  // Mede com a fonte de verdade: conteúdo maior que a caixa é estouro.
  const achados = []
  const folgas = []
  const apertos = []
  document.querySelectorAll('.slide').forEach((slide) => {
    const n = slide.dataset.n
    slide.querySelectorAll('.medir').forEach((caixa) => {
      const interno = caixa.firstElementChild
      const respiro = parseFloat(getComputedStyle(caixa).paddingTop) * 2
      const disponivel = caixa.clientHeight - respiro
      if (interno.scrollHeight > disponivel + 1) {
        caixa.classList.add('estourou')
        achados.push(n + ':estouro:' + Math.round(interno.scrollHeight - disponivel) + 'px:' + interno.textContent.slice(0, 40))
      }
      /*
       * Folga é o defeito oposto, e não aparece em nenhuma medida de estouro: o cartão coube,
       * mas ficou metade vazio — que é o que faz uma grade parecer desmontada. O número que
       * interessa é a altura que o conteúdo pede, em polegadas, para alimentar a grade.
       */
      /*
       * Cartão centrado na vertical é cartão que o empilhamento já mandou crescer de propósito:
       * ali a sobra é respiro, não defeito. Só o cartão alinhado ao topo delata folga.
       */
      const centrado = getComputedStyle(caixa).justifyContent === 'center'
      if (caixa.style.background && !centrado && disponivel - interno.scrollHeight > 26) {
        const pede = (interno.scrollHeight + respiro) / 96
        folgas.push(n + ':' + pede.toFixed(2) + '":' + interno.textContent.slice(0, 26))
      }
      /*
       * O aperto é o que sobra dentro do cartão, e é ele que absorve a diferença de métrica
       * entre o navegador que mede aqui e o PowerPoint que desenha depois. Cartão com menos de
       * um oitavo de polegada de sobra é o que arrisca ganhar uma linha lá e vazar.
       */
      if (caixa.style.background) {
        const sobra = (disponivel - interno.scrollHeight) / 96
        if (sobra < 0.125) {
          apertos.push(n + ':' + sobra.toFixed(3) + '":' + interno.textContent.slice(0, 30))
        }
      }
    })
    const limite = slide.querySelector('.limite')
    if (!limite) return
    const base = limite.offsetTop
    slide.querySelectorAll('.medir, .tabela').forEach((el) => {
      const fim = el.offsetTop + el.offsetHeight
      if (fim > base + 1) {
        el.classList.add('passou')
        achados.push(n + ':rodape:' + Math.round(fim - base) + 'px:' + el.textContent.slice(0, 40))
      }
    })
  })
  document.title = achados.length ? 'FALHAS ' + achados.length + ' || ' + achados.join(' || ') : 'OK 0 falhas'

  const relatorio = document.createElement('pre')
  relatorio.id = 'medidas'
  relatorio.style.display = 'none'
  relatorio.textContent =
    'APERTOS (sobra dentro do cartao)\\n' + (apertos.join('\\n') || 'nenhum') +
    '\\n\\nFOLGAS (altura que o conteudo pede)\\n' + folgas.join('\\n')
  document.body.appendChild(relatorio)
</script>
</body>
</html>`

fs.writeFileSync(destino, html, 'utf8')
console.log('Prévia: ' + destino + ' (' + slides.length + ' slides)')
