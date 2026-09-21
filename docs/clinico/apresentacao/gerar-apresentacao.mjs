/**
 * Gera o PowerPoint da apresentação do fluxo clínico a partir de `apresentacao-modelo.mjs`.
 *
 * Este arquivo não decide nada sobre conteúdo nem sobre posição: ele só traduz as operações do
 * modelo para a API do pptxgenjs. Quem quiser mudar um texto ou um tamanho mexe no modelo, e a
 * prévia HTML — que lê exatamente as mesmas operações — mostra o resultado antes de o .pptx sair.
 *
 * Uso (pptxgenjs não é dependência do portal — este documento não faz parte do build):
 *
 *   mkdir -p /tmp/pptgen && cd /tmp/pptgen && npm init -y && npm install pptxgenjs
 *   cp <caminho>/{gerar-apresentacao.mjs,apresentacao-modelo.mjs} .
 *   node gerar-apresentacao.mjs <caminho>/Apresentacao-Fluxo-Clinico.pptx
 */

import PptxGenJS from 'pptxgenjs'
import { slides, C, FONTE, LARGURA, RODAPE } from './apresentacao-modelo.mjs'

const destino = process.argv[2] ?? 'Apresentacao-Fluxo-Clinico.pptx'

const pptx = new PptxGenJS()
pptx.layout = 'LAYOUT_16x9'
pptx.author = 'PetJourney'
pptx.company = 'PetJourney'
pptx.subject = 'Módulo clínico — fluxo completo'
pptx.title = 'Módulo Clínico — Fluxo completo'

const RECT = pptx.ShapeType.rect
const ROUND = pptx.ShapeType.roundRect
const ELIPSE = pptx.ShapeType.ellipse

/*
 * O cromo do slide de conteúdo — filete no topo, rodapé e número — vive no mestre. Repetido em
 * cada slide, ele viraria vinte cópias a manter alinhadas; no mestre é uma.
 */
pptx.defineSlideMaster({
  title: 'CONTEUDO',
  background: { color: C.branco },
  objects: [{ rect: { x: 0, y: 0, w: LARGURA, h: 0.14, fill: { color: C.verde } } }],
  slideNumber: {
    x: LARGURA - 0.62 - 0.6,
    y: 6.95,
    w: 0.6,
    h: 0.3,
    align: 'right',
    fontFace: FONTE,
    fontSize: 9,
    color: C.fraco,
  },
})

/** Um trecho do modelo vira um run do pptxgenjs. */
function run(trecho, base) {
  return {
    text: trecho.t,
    options: {
      bold: Boolean(trecho.forte),
      color: trecho.cor ?? base.cor,
      fontSize: trecho.tamanho ?? base.tamanho,
      /*
       * `lineSpacing` é propriedade de parágrafo, e o pptxgenjs a lê do primeiro run de cada
       * parágrafo. Como cada trecho do modelo que tem entrelinha própria também começa um
       * parágrafo, declará-la em todos é correto e barato.
       */
      lineSpacing: trecho.entrelinha ?? base.entrelinha,
      charSpacing: trecho.espacamento,
      breakLine: Boolean(trecho.quebra),
    },
  }
}

function desenhar(slide, op) {
  if (op.tipo === 'retangulo') {
    // Raio igual à metade do lado menor é um círculo; o PowerPoint tem forma própria para isso.
    const circulo = op.raio > 0 && op.raio >= Math.min(op.w, op.h) / 2 - 0.001
    slide.addShape(circulo ? ELIPSE : op.raio ? ROUND : RECT, {
      x: op.x,
      y: op.y,
      w: op.w,
      h: op.h,
      fill: { color: op.fill },
      line: op.line ? { color: op.line, width: 1 } : { type: 'none' },
      ...(op.raio && !circulo ? { rectRadius: op.raio } : {}),
    })
    return
  }

  if (op.tipo === 'texto') {
    const opcoes = {
      x: op.x,
      y: op.y,
      w: op.w,
      h: op.h,
      fontFace: FONTE,
      fontSize: op.tamanho,
      color: op.cor,
      lineSpacing: op.entrelinha,
      align: op.align,
      valign: op.valign,
      margin: op.margem,
      // Sem autoajuste: o tamanho é o que o modelo mediu, e encolher texto em silêncio
      // esconderia justamente o defeito que a prévia existe para acusar.
      fit: 'none',
      wrap: true,
    }

    if (op.fill) {
      opcoes.shape = op.raio ? ROUND : RECT
      opcoes.fill = { color: op.fill }
      if (op.raio) opcoes.rectRadius = op.raio
      if (op.line) opcoes.line = { color: op.line, width: 1 }
    }

    if (op.marcador) {
      opcoes.bullet = { code: '2022', indent: 13 }
      opcoes.paraSpaceAfter = op.espacoDepois
    }

    slide.addText(
      op.runs.map((trecho) => run(trecho, op)),
      opcoes,
    )
    return
  }

  if (op.tipo === 'tabela') {
    const cabecalho = op.cabecalho.map((celula) => ({
      text: celula,
      options: {
        bold: true,
        color: C.branco,
        fill: { color: C.verde },
        fontSize: 10.5,
        valign: 'middle',
        margin: [7, 9, 7, 9],
      },
    }))

    const corpo = op.linhas.map((linha, i) =>
      linha.map((celula, j) => ({
        text: celula,
        options: {
          color: C.tinta,
          bold: j === 0,
          fill: { color: i % 2 === 0 ? C.branco : C.verdeFundo },
          fontSize: 10.5,
          valign: 'middle',
          margin: [8, 9, 8, 9],
        },
      })),
    )

    slide.addTable([cabecalho, ...corpo], {
      x: op.x,
      y: op.y,
      w: op.w,
      colW: op.colW,
      rowH: op.alturaLinha,
      fontFace: FONTE,
      border: { type: 'solid', color: C.verdeLinha, pt: 1 },
      autoPage: false,
    })
  }
}

slides.forEach((modelo) => {
  const slide =
    modelo.tipo === 'conteudo' ? pptx.addSlide({ masterName: 'CONTEUDO' }) : pptx.addSlide()

  if (modelo.tipo === 'conteudo') {
    slide.addText(RODAPE, {
      x: 0.62,
      y: 6.95,
      w: 6,
      h: 0.3,
      fontFace: FONTE,
      fontSize: 9,
      color: C.fraco,
    })
  }

  modelo.ops.forEach((op) => desenhar(slide, op))
})

await pptx.writeFile({ fileName: destino })
console.log('Gerado: ' + destino + ' (' + slides.length + ' slides)')
