/**
 * O modelo da apresentação do fluxo clínico: conteúdo e geometria, sem depender de nada.
 *
 * ## Por que o modelo é separado dos geradores
 *
 * Um `.pptx` não se lê numa máquina sem PowerPoint, e a primeira versão desta apresentação saiu
 * com o layout quebrado justamente por ter sido conferida por estimativa em vez de olhada. Aqui
 * o conteúdo vira uma lista de **operações de desenho** — retângulo, texto, tabela — com posição
 * e tamanho em polegadas. Dois renderizadores consomem a mesma lista:
 *
 * - `gerar-apresentacao.mjs` produz o PowerPoint;
 * - `previa-html.mjs` produz uma página que o navegador abre, com a **mesma** geometria, mede
 *   cada caixa com a fonte de verdade e acusa tanto o texto que estoura quanto o cartão que
 *   sobrou vazio.
 *
 * ## Como o slide se compõe
 *
 * Nenhum `y` de bloco é escrito à mão. Cada slide declara seus blocos em ordem e `empilhar` os
 * distribui entre o fim do cabeçalho e a base útil, repartindo a sobra nos vãos. Foi a conta à
 * mão que, na primeira versão, sobrepôs uma tabela a três cartões e empurrou outra para fora da
 * página.
 *
 * As alturas de cartão vêm da medição da prévia (`FOLGAS`), não de palpite: é o conteúdo que
 * define o tamanho da moldura. Ao mudar um texto, rode a prévia de novo e ajuste.
 *
 * ## Convenções
 *
 * - Distâncias em **polegadas**; o slide é 13,333 × 7,5 (16:9).
 * - Tamanho de fonte, entrelinha e margem em **pontos**.
 * - A margem interna do texto é sempre declarada — o padrão do PowerPoint não é o do navegador.
 */

// ------------------------------------------------------------------------ paleta

export const C = {
  verde: '456A60',
  verdeEscuro: '2C443E',
  verdeFundo: 'EEF4F2',
  verdeLinha: 'D6E9E2',
  tinta: '1F2F2B',
  cinza: '5F716B',
  fraco: '8A9A94',
  ambar: '8A6D1F',
  ambarFundo: 'FBF3E2',
  ambarLinha: 'E6D4A8',
  risco: 'A2503F',
  riscoFundo: 'FBEEE8',
  riscoLinha: 'EBCFC6',
  branco: 'FFFFFF',
  linha: 'E3EBE8',
}

export const FONTE = 'Segoe UI'
export const LARGURA = 13.333
export const ALTURA = 7.5

const M = 0.62
const W = LARGURA - M * 2

/** Base útil do slide de conteúdo: abaixo daqui é rodapé. */
export const LIMITE = 6.86

/** Altura única da faixa de destaque, e o topo dela. Igual em todo slide que a tem. */
const BANDA_H = 0.78
const BANDA_Y = LIMITE - BANDA_H

/** Margem interna padrão do texto dentro de uma caixa, em pontos. */
const MI = 8

// --------------------------------------------------------------- escala tipográfica

const T = {
  tituloSlide: { tamanho: 25, entrelinha: 30 },
  etiqueta: { tamanho: 9.5, entrelinha: 12 },
  contexto: { tamanho: 12.5, entrelinha: 17 },
  cartaoEtiqueta: { tamanho: 8.5, entrelinha: 11.5 },
  cartaoTitulo: { tamanho: 12.5, entrelinha: 16 },
  cartaoCorpo: { tamanho: 10.5, entrelinha: 14 },
  lista: { tamanho: 11.5, entrelinha: 16 },
  destaque: { tamanho: 12, entrelinha: 16.5 },
}

// -------------------------------------------------------------------- operações

const ops = []
let slideCorrente = null

function novoSlide(tipo) {
  slideCorrente = { tipo, ops: [] }
  ops.push(slideCorrente)
  return slideCorrente
}

function retangulo(props) {
  slideCorrente.ops.push({ tipo: 'retangulo', raio: 0, ...props })
}

/**
 * Caixa de texto. `runs` é uma lista de trechos; `quebra` fecha o parágrafo.
 * Com `fill`, a moldura e o texto são um objeto só — o texto não tem como aparecer deslocado
 * dela, e a prévia sabe que aquilo é um cartão a medir.
 */
function texto(props) {
  slideCorrente.ops.push({
    tipo: 'texto',
    margem: MI,
    valign: 'top',
    align: 'left',
    cor: C.tinta,
    ...props,
  })
}

function tabela(props) {
  slideCorrente.ops.push({ tipo: 'tabela', ...props })
}

// ------------------------------------------------------------------- composição

/**
 * Distribui os blocos entre `y0` e `fim`.
 *
 * A sobra é repartida em três etapas, nesta ordem:
 *
 * 1. **Nos vãos**, até o teto. Vão tem piso, senão dois blocos encostam; e teto, senão um slide
 *    curto espalha os blocos pelos cantos e parece desmontado.
 * 2. **Dentro dos cartões**, que crescem e passam a centrar o texto na vertical. É o que
 *    transforma sobra em respiro: um cartão alto com o texto no topo lê-se como buraco; o mesmo
 *    cartão com o texto no meio lê-se como folga deliberada.
 * 3. O que ainda restar fica em branco no pé — que é onde o branco não atrapalha.
 */
function empilhar(y0, blocos, { fim = LIMITE, vaoMin = 0.24, vaoMax = 0.5 } = {}) {
  const vaos = blocos.length - 1
  const disponivel = fim - y0

  const somar = () => blocos.reduce((total, b) => total + b.h, 0)
  const calcularVao = () =>
    vaos > 0 ? Math.min(Math.max((disponivel - somar()) / vaos, vaoMin), vaoMax) : 0

  let vao = calcularVao()
  const sobra = disponivel - somar() - vao * vaos
  const elasticos = blocos.filter((b) => b.crescer)

  if (sobra > 0.1 && elasticos.length) {
    const cota = sobra / elasticos.length
    elasticos.forEach((b) => b.crescer(cota))
    vao = calcularVao()
  }

  let y = y0
  blocos.forEach((bloco) => {
    bloco.desenhar(y)
    y += bloco.h + vao
  })
}

// ----------------------------------------------------------------------- blocos

/** Cabeçalho: etiqueta, título, filete e a linha de contexto. Devolve o y onde o corpo começa. */
function cabecalho(etiqueta, titulo, contexto) {
  texto({
    x: M,
    y: 0.42,
    w: W,
    h: 0.26,
    margem: 0,
    ...T.etiqueta,
    cor: C.verde,
    espacamento: 1.6,
    runs: [{ t: etiqueta.toUpperCase(), forte: true }],
  })
  texto({
    x: M,
    y: 0.68,
    w: W,
    h: 0.5,
    margem: 0,
    ...T.tituloSlide,
    runs: [{ t: titulo, forte: true }],
  })
  retangulo({ x: M, y: 1.26, w: W, h: 0.014, fill: C.verdeLinha })

  if (!contexto) return 1.5

  texto({
    x: M,
    y: 1.36,
    w: W,
    h: 0.5,
    margem: 0,
    ...T.contexto,
    cor: C.cinza,
    runs: [{ t: contexto }],
  })
  return 1.92
}

const TONS = {
  neutro: { fill: C.verdeFundo, line: C.verdeLinha, titulo: C.verde },
  atencao: { fill: C.ambarFundo, line: C.ambarLinha, titulo: C.ambar },
  risco: { fill: C.riscoFundo, line: C.riscoLinha, titulo: C.risco },
}

/**
 * Grade de cartões, como bloco empilhável. `altura` é o que a prévia mediu para o conteúdo,
 * não palpite — e é o **piso**: `empilhar` pode aumentá-la para repartir a sobra do slide.
 */
function grade(itens, { colunas, altura, gap = 0.24, x = M, w = W, crescimentoMax = 0.5 }) {
  const linhas = Math.ceil(itens.length / colunas)
  const lc = (w - gap * (colunas - 1)) / colunas

  let alt = altura
  let centrado = false

  return {
    get h() {
      return linhas * alt + (linhas - 1) * gap
    },
    crescer(extra) {
      const porLinha = Math.min(extra / linhas, crescimentoMax)
      if (porLinha < 0.04) return
      alt += porLinha
      centrado = true
    },
    desenhar(y) {
      itens.forEach((item, i) => {
        const cx = x + (i % colunas) * (lc + gap)
        const cy = y + Math.floor(i / colunas) * (alt + gap)
        const tom = TONS[item.tom ?? 'neutro']

        const runs = []
        if (item.etiqueta) {
          runs.push({
            t: item.etiqueta.toUpperCase(),
            forte: true,
            cor: C.fraco,
            ...T.cartaoEtiqueta,
            espacamento: 1.1,
            quebra: true,
          })
        }
        runs.push({
          t: item.titulo,
          forte: true,
          cor: tom.titulo,
          ...T.cartaoTitulo,
          quebra: Boolean(item.texto),
        })
        if (item.texto) runs.push({ t: item.texto, ...T.cartaoCorpo })

        texto({
          x: cx,
          y: cy,
          w: lc,
          h: alt,
          fill: tom.fill,
          line: tom.line,
          raio: 0.07,
          valign: centrado ? 'middle' : 'top',
          ...T.cartaoCorpo,
          runs,
        })
      })
    },
  }
}

/** Lista com marcador. */
function lista(itens, { x = M, y: yFixo, w = W, h }) {
  const runs = []
  itens.forEach((item, i) => {
    runs.push({ t: item.forte, forte: true })
    if (item.texto) runs.push({ t: ' ' + item.texto })
    if (i < itens.length - 1) runs[runs.length - 1].quebra = true
  })

  return {
    h,
    desenhar(y) {
      texto({
        x,
        y: yFixo ?? y,
        w,
        h,
        margem: 0,
        ...T.lista,
        marcador: true,
        espacoDepois: 7,
        runs,
      })
    },
  }
}

/** Caixa de argumento: uma moldura larga com etiqueta, frase forte e explicação. */
function caixa(runs, { altura, tom, crescimentoMax = 0.4 }) {
  const t = TONS[tom]
  let alt = altura
  let centrado = false

  return {
    get h() {
      return alt
    },
    crescer(extra) {
      const ganho = Math.min(extra, crescimentoMax)
      if (ganho < 0.04) return
      alt += ganho
      centrado = true
    },
    desenhar(y) {
      texto({
        x: M,
        y,
        w: W,
        h: alt,
        fill: t.fill,
        line: t.line,
        raio: 0.08,
        margem: 16,
        valign: centrado ? 'middle' : 'top',
        ...T.cartaoCorpo,
        runs,
      })
    },
  }
}

/** Fileira de números. */
function numeros(itens, { altura = 1.02 }) {
  const gap = 0.24
  const lc = (W - gap * (itens.length - 1)) / itens.length

  return {
    h: altura,
    desenhar(y) {
      itens.forEach((item, i) => {
        const cx = M + i * (lc + gap)
        retangulo({ x: cx, y, w: lc, h: altura, fill: C.branco, line: C.verdeLinha, raio: 0.07 })
        texto({
          x: cx,
          y: y + 0.09,
          w: lc,
          h: 0.48,
          margem: 0,
          tamanho: 26,
          entrelinha: 31,
          cor: C.verde,
          align: 'center',
          runs: [{ t: item.valor, forte: true }],
        })
        texto({
          x: cx,
          y: y + 0.56,
          w: lc,
          h: altura - 0.62,
          margem: 5,
          tamanho: 10,
          entrelinha: 13,
          cor: C.cinza,
          align: 'center',
          runs: [{ t: item.rotulo }],
        })
      })
    },
  }
}

/**
 * Tabela como bloco. `alturaLinha` é o mínimo por linha — a célula cresce se o texto pedir, e a
 * prévia acusa quando o crescimento empurra a tabela para fora da página.
 */
function tabelaBloco({ colW, alturaLinha, cabecalho: cab, linhas, crescimentoMax = 0.12 }) {
  let altura = alturaLinha

  return {
    get h() {
      return altura * (linhas.length + 1)
    },
    crescer(extra) {
      const porLinha = Math.min(extra / (linhas.length + 1), crescimentoMax)
      if (porLinha < 0.02) return
      altura += porLinha
    },
    desenhar(y) {
      tabela({ x: M, y, w: W, colW, alturaLinha: altura, cabecalho: cab, linhas })
    },
  }
}

/**
 * Faixa de destaque, ancorada sempre na mesma altura. Ela é o lugar fixo da frase que a plateia
 * leva embora: banda que muda de altura de slide para slide faz o olho procurá-la toda vez.
 */
function destaque(frase, { tom = 'neutro' } = {}) {
  const cores = {
    neutro: { fill: C.verdeFundo, barra: C.verde },
    atencao: { fill: C.ambarFundo, barra: C.ambar },
    risco: { fill: C.riscoFundo, barra: C.risco },
  }[tom]

  retangulo({ x: M, y: BANDA_Y, w: W, h: BANDA_H, fill: cores.fill })
  retangulo({ x: M, y: BANDA_Y, w: 0.055, h: BANDA_H, fill: cores.barra })
  texto({
    x: M + 0.055,
    y: BANDA_Y,
    w: W - 0.055,
    h: BANDA_H,
    margem: 11,
    valign: 'middle',
    ...T.destaque,
    runs: [{ t: frase }],
  })
}

/** Onde o corpo termina num slide que tem faixa. */
const ATE_BANDA = { fim: BANDA_Y - 0.26 }

// ---------------------------------------------------------------- slides escuros

function slideEscuro() {
  novoSlide('escuro')
  retangulo({ x: 0, y: 0, w: LARGURA, h: ALTURA, fill: C.verde })
  retangulo({ x: 0, y: 0, w: 0.17, h: ALTURA, fill: C.verdeEscuro })
}

function divisoria(numero, titulo, frase) {
  slideEscuro()
  texto({
    x: 1.15,
    y: 2.62,
    w: 6,
    h: 0.3,
    margem: 0,
    ...T.etiqueta,
    cor: C.verdeLinha,
    espacamento: 2.4,
    runs: [{ t: numero, forte: true }],
  })
  texto({
    x: 1.15,
    y: 2.96,
    w: 10.5,
    h: 0.78,
    margem: 0,
    tamanho: 38,
    entrelinha: 44,
    cor: C.branco,
    runs: [{ t: titulo, forte: true }],
  })
  retangulo({ x: 1.15, y: 3.92, w: 1.5, h: 0.035, fill: C.verdeLinha })
  texto({
    x: 1.15,
    y: 4.14,
    w: 9.4,
    h: 0.7,
    margem: 0,
    tamanho: 14,
    entrelinha: 20,
    cor: C.verdeLinha,
    runs: [{ t: frase }],
  })
}

const conteudo = () => novoSlide('conteudo')

// ===================================================================== 1 · capa

slideEscuro()
texto({
  x: 1.15,
  y: 1.9,
  w: 10,
  h: 0.3,
  margem: 0,
  tamanho: 11,
  entrelinha: 14,
  cor: C.verdeLinha,
  espacamento: 3,
  runs: [{ t: 'PETJOURNEY · PORTAL DO PARCEIRO', forte: true }],
})
texto({
  x: 1.15,
  y: 2.3,
  w: 11,
  h: 1.05,
  margem: 0,
  tamanho: 52,
  entrelinha: 60,
  cor: C.branco,
  runs: [{ t: 'Módulo Clínico', forte: true }],
})
texto({
  x: 1.15,
  y: 3.45,
  w: 10.5,
  h: 0.45,
  margem: 0,
  tamanho: 17,
  entrelinha: 23,
  cor: C.verdeLinha,
  runs: [{ t: 'O fluxo completo da clínica veterinária — da agenda à alta hospitalar.' }],
})
retangulo({ x: 1.15, y: 4.2, w: 1.5, h: 0.04, fill: C.verdeLinha })
texto({
  x: 1.15,
  y: 4.45,
  w: 10,
  h: 0.34,
  margem: 0,
  tamanho: 12,
  entrelinha: 16,
  cor: C.verdeLinha,
  runs: [
    { t: 'Setembro de 2026', forte: true, cor: C.branco },
    { t: '        Protótipo navegável, pronto para ser aberto e usado' },
  ],
})

// ================================================================ 2 · em resumo

{
  conteudo()
  cabecalho('Em resumo', 'Um sistema para quem opera a clínica', null)

  texto({
    x: M,
    y: 1.36,
    w: W,
    h: 0.75,
    margem: 0,
    tamanho: 14,
    entrelinha: 20,
    cor: C.cinza,
    runs: [
      {
        t: 'A recepção vive na agenda, o veterinário no prontuário, a enfermagem no checklist da internação. O módulo cobre os três num percurso só — e o responsável acompanha pelo celular.',
      },
    ],
  })

  empilhar(
    2.3,
    [
      numeros([
        { valor: '15', rotulo: 'telas, de "Meu dia" à alta' },
        { valor: '15', rotulo: 'documentos emitidos' },
        { valor: '8', rotulo: 'leitos no mapa' },
        { valor: '4', rotulo: 'idiomas' },
        { valor: '506', rotulo: 'testes neste módulo' },
      ], {}),
      grade(
        [
          {
            etiqueta: 'Para a clínica',
            titulo: 'Um só lugar',
            texto: 'Agenda, prontuário, receita, documentos, vacinas e internação sem planilha paralela.',
          },
          {
            etiqueta: 'Para o veterinário',
            titulo: 'Dado, não texto solto',
            texto: 'Faixa por porte e idade, dose conferível, histórico filtrável.',
          },
          {
            etiqueta: 'Para o responsável',
            titulo: 'Notícia sem precisar ligar',
            texto: 'Receita, lembrete e boletim chegam no aplicativo — com trava para a notícia grave.',
          },
        ],
        { colunas: 3, altura: 1.17 },
      ),
    ],
    ATE_BANDA,
  )

  destaque(
    'Nenhuma tela saiu e nenhum caminho antigo deixou de funcionar. O que já existia continua igual, no mesmo lugar.',
  )
}

// ================================================================= 3 · o percurso

{
  conteudo()
  const y0 = cabecalho(
    'O percurso',
    'O dia inteiro da clínica, em duas faixas',
    'Um mesmo paciente atravessa as duas: o identificador é um só, e o peso, a data e a clínica acompanham.',
  )

  /**
   * Uma faixa do percurso: rótulo acima, e os passos ligados por seta. Elástica como a grade —
   * o passo cresce e centra o texto, em vez de deixar o vazio no pé do slide.
   */
  const faixa = (rotulo, itens, cor, fundo) => {
    const RECUO_ROTULO = 0.3
    let alturaPasso = 0.96

    return {
      get h() {
        return alturaPasso + RECUO_ROTULO
      },
      crescer(extra) {
        alturaPasso += Math.min(extra, 0.45)
      },
      desenhar(y) {
        texto({
          x: M,
          y,
          w: 4,
          h: 0.24,
          margem: 0,
          ...T.etiqueta,
          cor,
          espacamento: 1.6,
          runs: [{ t: rotulo.toUpperCase(), forte: true }],
        })

        const gap = 0.3
        const lc = (W - gap * (itens.length - 1)) / itens.length
        itens.forEach((item, i) => {
          const cx = M + i * (lc + gap)
          texto({
            x: cx,
            y: y + RECUO_ROTULO,
            w: lc,
            h: alturaPasso,
            fill: fundo,
            line: cor,
            raio: 0.07,
            align: 'center',
            valign: 'middle',
            margem: 7,
            ...T.cartaoCorpo,
            runs: [
              { t: item.titulo, forte: true, cor, tamanho: 12, entrelinha: 15, quebra: true },
              { t: item.texto, tamanho: 9.5, entrelinha: 12.5 },
            ],
          })
          if (i < itens.length - 1) {
            texto({
              x: cx + lc,
              y: y + RECUO_ROTULO + alturaPasso / 2 - 0.18,
              w: gap,
              h: 0.36,
              margem: 0,
              tamanho: 15,
              entrelinha: 18,
              cor,
              align: 'center',
              runs: [{ t: '▸', forte: true }],
            })
          }
        })
      },
    }
  }

  empilhar(
    y0,
    [
      faixa(
        'Atendimento',
        [
          { titulo: 'Meu dia', texto: 'quem espera e o que vem a seguir' },
          { titulo: 'Agenda', texto: 'marcar, encaixar, remarcar arrastando' },
          { titulo: 'Fila de espera', texto: 'posição, oferta de vaga e prazo' },
          { titulo: 'Prontuário', texto: 'cinco etapas, da anamnese ao fecho' },
          { titulo: 'Receita e documentos', texto: 'assinados e entregues' },
          { titulo: 'Retorno', texto: 'cai na agenda e fecha o ciclo' },
        ],
        C.verde,
        C.verdeFundo,
      ),
      faixa(
        'Internação',
        [
          { titulo: 'Mapa de leitos', texto: 'onde há vaga e o que cobra ação' },
          { titulo: 'Prescrição', texto: 'horários já materializados' },
          { titulo: 'Checklist', texto: 'quem deu e a que horas' },
          { titulo: 'Evolução', texto: 'passagem com pendência congelada' },
          { titulo: 'Boletim', texto: 'o responsável acompanha pelo celular' },
          { titulo: 'Alta', texto: 'três desfechos, e o leito volta' },
        ],
        C.ambar,
        C.ambarFundo,
      ),
    ],
    ATE_BANDA,
  )

  destaque(
    'Fora das duas faixas, sempre à mão: pacientes, histórico, bulário, vacinas, faltas e o resumo — alcançáveis de qualquer tela por Ctrl + K.',
  )
}

// ================================================================== 4 · divisória

divisoria(
  'BLOCO 1',
  'O dia começa',
  'Onde está o trabalho, e como se chega a um paciente sem adivinhar em qual lista ele está.',
)

// ================================================================== 5 · navegação

{
  conteudo()
  const y0 = cabecalho(
    'Navegação',
    'O módulo diz onde está o trabalho',
    'Veio de uma reclamação direta: o fluxo estava confuso. Não faltava tela nem sobrava tela — faltava chave de leitura.',
  )

  empilhar(
    y0,
    [
      grade(
        [
          {
            etiqueta: 'Bloco 1',
            titulo: 'Agora',
            texto: 'Meu dia · Agenda · Fila\nO que acontece neste minuto, e onde cabe mais alguém.',
          },
          {
            etiqueta: 'Bloco 2',
            titulo: 'Em curso',
            texto: 'Prontuários · Internação\nO trabalho aberto que atravessa o dia.',
          },
          {
            etiqueta: 'Bloco 3',
            titulo: 'Pendências',
            texto: 'Atividades · Faltas · Vacinas\nO que ficou para trás e envelhece calado.',
          },
          {
            etiqueta: 'Bloco 4',
            titulo: 'Análise',
            texto: 'Resumo\nO que só faz sentido depois que o dia acabou.',
          },
        ],
        { colunas: 4, altura: 1.36 },
      ),
      grade(
        [
          {
            titulo: 'Contadores de pendência',
            texto: 'Só o que alguém precisa fazer: "38 atendimentos hoje" é rotina, "2 doses atrasadas" é pendência.',
          },
          {
            titulo: 'Busca em Ctrl + K',
            texto: 'Nome do animal, de quem responde por ele, telefone, ou o nome da tela. A resposta é o destino.',
          },
          {
            titulo: 'A internação saiu do canto dela',
            texto: '"Meu dia" traz os internados que cobram ação, e o boletim preso vira botão no topo.',
          },
        ],
        { colunas: 3, altura: 0.98 },
      ),
    ],
    ATE_BANDA,
  )

  destaque(
    'Nada saiu da lista: os destinos continuam os mesmos, com os mesmos nomes e as mesmas rotas. Ela só deixou de exigir leitura inteira.',
  )
}

// ===================================================================== 6 · agenda

{
  conteudo()
  const y0 = cabecalho(
    'Agenda',
    'A tela onde a recepção vive',
    'É ela que decide se a clínica troca de sistema. Se for pior que a atual, nada mais importa.',
  )

  /*
   * Lista e cartões lado a lado: um bloco só, porque as duas colunas começam juntas. Empilhá-los
   * como blocos irmãos os poria um embaixo do outro.
   */
  const colunaEsquerda = W * 0.56
  const colunaDireita = W * 0.4

  const itensLista = [
    { forte: 'Dia e semana,', texto: 'com colunas por profissional ou por sala.' },
    { forte: 'Encaixe, bloqueio e recorrência:', texto: 'almoço, reunião, férias, feriado.' },
    { forte: 'Remarcar arrastando,', texto: 'com confirmação que mostra de → para e o texto que sai.' },
    { forte: 'Desfazer em 8 segundos', texto: '— arrastar nunca salva sozinho.' },
    { forte: 'Legenda por tipo:', texto: 'cor, ícone e nome — e ela é o filtro da grade.' },
    { forte: 'Carga da semana', texto: 'por profissional e por período.' },
    { forte: 'Atalhos de teclado', texto: 'e o estado da visão na URL.' },
  ]

  const cartoes = grade(
    [
      {
        tom: 'atencao',
        etiqueta: 'A decisão que rege a tela',
        titulo: 'Nada bloqueia',
        texto:
          'Sobreposição, sala ocupada e dia fechado avisam, e seguem agendáveis. Regra que proíbe vira regra contornada no papel — e aí o sistema perde o registro do que aconteceu.',
      },
      {
        etiqueta: 'Conflitos detectados',
        titulo: 'Quatro, sempre por escrito',
        texto:
          'Sobreposição de profissional, sala ocupada, invasão de bloqueio e fora do expediente — durante o arraste e no diálogo.',
      },
    ],
    { colunas: 1, altura: 1.52, x: M + W - colunaDireita, w: colunaDireita },
  )

  empilhar(
    y0,
    [
      {
        get h() {
          return Math.max(2.9, cartoes.h)
        },
        crescer: (extra) => cartoes.crescer(extra),
        desenhar(y) {
          lista(itensLista, { x: M, w: colunaEsquerda, h: 2.9 }).desenhar(y)
          cartoes.desenhar(y)
        },
      },
    ],
    ATE_BANDA,
  )

  destaque(
    'Um dia de demonstração tem 40 atendimentos, 5 veterinários e 24 pacientes com histórico — sempre os mesmos, porque o conjunto de dados é determinístico.',
  )
}

// ====================================================================== 7 · falta

{
  conteudo()
  const y0 = cabecalho(
    'Agenda',
    'A falta vira uma ligação',
    'Marcar falta antes só mudava um status. Agora três coisas acontecem juntas, no mesmo gesto.',
  )

  empilhar(
    y0,
    [
      grade(
        [
          {
            etiqueta: 'Passo 1',
            titulo: 'Marcar falta no próprio card',
            texto: 'Um clique, e só para quem já devia ter chegado. O rótulo é comando, não substantivo.',
          },
          {
            etiqueta: 'Passo 2',
            titulo: 'O reagendamento abre junto',
            texto: 'Paciente, tipo e profissional preenchidos, horários já buscados e o telefone clicável.',
          },
          {
            etiqueta: 'Passo 3',
            titulo: 'A fila é consultada',
            texto: 'O horário que vagou é ofertado a quem espera, com posição, prazo e mensagem em prévia.',
          },
        ],
        { colunas: 3, altura: 1.17 },
      ),
      grade(
        [
          {
            titulo: 'Histórico de faltas do responsável',
            texto:
              'Cada falta com data, tipo, minutos perdidos e se houve retorno depois. Três faltas em três anos não é três faltas no mês — e quem já remarcou não recebe convite de novo.',
          },
          {
            titulo: 'Comprovante de tudo que saiu',
            texto:
              'Remarcação, cancelamento, reagendamento e oferta de vaga deixam registro com data. Numa tela onde errar liga para a pessoa errada, o comprovante é parte do fluxo.',
          },
        ],
        { colunas: 2, altura: 0.98 },
      ),
    ],
    ATE_BANDA,
  )

  destaque('"Falta é dinheiro perdido. Aqui ela vira uma ligação, não uma linha num relatório."')
}

// ================================================================== 8 · divisória

divisoria(
  'BLOCO 2',
  'O atendimento',
  'Onde o veterinário passa o tempo dele — e a decisão mais importante do produto.',
)

// ================================================================= 9 · prontuário

{
  conteudo()
  const y0 = cabecalho(
    'Prontuário',
    'Cinco etapas, uma consulta',
    'Campo estruturado hoje é o que permite score de risco e integração com laboratório amanhã. Texto livre é confortável de programar e inútil depois.',
  )

  const etapas = [
    { n: '1', titulo: 'Anamnese', texto: 'Queixa, duração, evolução e antecedentes. Trechos prontos por "/".' },
    { n: '2', titulo: 'Exame físico', texto: 'Oito sistemas, vitais com faixa, mucosas e hidratação.' },
    { n: '3', titulo: 'Diagnóstico', texto: 'Catálogo por código. Presuntivo, definitivo e diferencial.' },
    { n: '4', titulo: 'Conduta', texto: 'Orientações, prescrição pelo bulário, exames e retorno.' },
    { n: '5', titulo: 'Resumo', texto: 'Os documentos que este atendimento pede, e o fecho.' },
  ]

  let alturaEtapa = 1.17

  const blocoEtapas = {
    // A bolota do número sobe 0,2" acima do cartão; o bloco reserva esse espaço.
    get h() {
      return alturaEtapa + 0.2
    },
    crescer(extra) {
      alturaEtapa += Math.min(extra, 0.5)
    },
    desenhar(y) {
      const topo = y + 0.2
      const gap = 0.26
      const lc = (W - gap * (etapas.length - 1)) / etapas.length

      etapas.forEach((e, i) => {
        const cx = M + i * (lc + gap)
        texto({
          x: cx,
          y: topo,
          w: lc,
          h: alturaEtapa,
          fill: C.verdeFundo,
          line: C.verdeLinha,
          raio: 0.07,
          align: 'center',
          valign: 'middle',
          margem: 8,
          ...T.cartaoCorpo,
          runs: [
            { t: e.titulo, forte: true, cor: C.verde, ...T.cartaoTitulo, quebra: true },
            { t: e.texto },
          ],
        })
        retangulo({
          x: cx + lc / 2 - 0.2,
          y: topo - 0.2,
          w: 0.4,
          h: 0.4,
          fill: C.verde,
          line: C.branco,
          raio: 0.2,
        })
        texto({
          x: cx + lc / 2 - 0.2,
          y: topo - 0.145,
          w: 0.4,
          h: 0.3,
          margem: 0,
          tamanho: 12,
          entrelinha: 14,
          cor: C.branco,
          align: 'center',
          runs: [{ t: e.n, forte: true }],
        })
        if (i < etapas.length - 1) {
          texto({
            x: cx + lc,
            y: topo + alturaEtapa / 2 - 0.18,
            w: gap,
            h: 0.36,
            margem: 0,
            tamanho: 15,
            entrelinha: 18,
            cor: C.verde,
            align: 'center',
            runs: [{ t: '▸', forte: true }],
          })
        }
      })
    },
  }

  empilhar(y0, [
    blocoEtapas,
    grade(
      [
        {
          titulo: 'Autosave e rascunho local',
          texto: 'O atendimento interrompido volta como oferta de retomada, nunca como sobrescrita.',
        },
        {
          titulo: 'Um dispositivo edita por vez',
          texto: 'O segundo entra em leitura, e a transferência é explícita.',
        },
        {
          titulo: 'Finalizado não se edita',
          texto: 'A tela vira somente leitura e devolve à agenda. Registro fechado se lê.',
        },
      ],
      { colunas: 3, altura: 0.98 },
    ),
  ])
}

// ============================================================== 10 · diferenciais

{
  conteudo()
  const y0 = cabecalho(
    'Prontuário',
    'O que ele faz e um bloco de notas não faz',
    'Seis coisas que separam um registro consultável de um campo de texto com data.',
  )

  empilhar(
    y0,
    [
      grade(
        [
          {
            etiqueta: 'Julga certo',
            titulo: 'Faixa por espécie, porte e idade',
            texto:
              'Um cão de 3 kg tem frequência cardíaca acima de um de 60 kg. Faixa única marcaria como "fora" o que é normal — e ensinaria o vet a ignorar o destaque.',
          },
          {
            etiqueta: 'Nunca só cor',
            titulo: 'Fora da faixa em três canais',
            texto:
              'Seta de direção, a palavra ("acima", "abaixo") e a faixa esperada ao lado. Filete colorido não sobrevive à leitura por voz.',
          },
          {
            etiqueta: 'Silêncio é dado',
            titulo: '"Não aferido" não é vazio',
            texto:
              'Distingue quem decidiu não medir de ninguém ter preenchido. E faixa ausente não vira faixa inventada.',
          },
          {
            etiqueta: 'O elo com o aplicativo',
            titulo: 'A pré-consulta do responsável',
            texto:
              'O que a pessoa respondeu em casa entra como sugestão, só onde está vazio. Nada entra sozinho, e a procedência fica marcada.',
          },
          {
            etiqueta: 'Velocidade',
            titulo: 'A consulta inteira sem mouse',
            texto:
              'Enter avança campo e muda de etapa, número escolhe a opção, o foco vai sozinho ao primeiro campo. Com o mapa de teclas à vista.',
          },
          {
            etiqueta: 'Antes de entrar na sala',
            titulo: 'Linha do tempo com filtro',
            texto:
              'Consultas, vacinas, exames, cirurgias, prescrições, faltas e internações — filtráveis por tipo.',
          },
        ],
        { colunas: 3, altura: 1.36 },
      ),
    ],
    ATE_BANDA,
  )

  destaque(
    'A regra que atravessa tudo: estruturado primeiro, texto livre ao lado — nunca no lugar. Quem quer escrever solto continua escrevendo, e o dado continua consultável.',
  )
}

// =============================================================== 11 · receituário

{
  conteudo()
  const y0 = cabecalho(
    'Receituário digital',
    'A conta aberta, e a instrução em português',
    'A receita é o artefato que mais circula entre clínica, responsável e farmácia.',
  )

  const colunaLista = (W - 0.5) / 2

  empilhar(
    y0,
    [
      grade(
        [
          {
            etiqueta: 'Para o veterinário conferir',
            titulo: '12,4 kg × 10 mg/kg = 124 mg',
            texto: 'Três passos numerados. Número pronto num campo não se confere.',
          },
          {
            etiqueta: 'Para o responsável executar',
            titulo: '"Meio comprimido, de 12 em 12 h"',
            texto: 'Fração em palavra. Quando não cai numa fração partível, a tela avisa.',
          },
        ],
        { colunas: 2, altura: 0.98 },
      ),
      {
        h: 1.7,
        desenhar(y) {
          lista(
            [
              { forte: 'Bulário ao lado do campo,', texto: 'com classe, cuidados e dose por espécie.' },
              { forte: 'Alergia ao princípio ativo', texto: 'exige confirmação explícita. Avisa, não impede.' },
              { forte: 'Pet sem peso não calcula às cegas.' },
              { forte: 'Uso contínuo é a ausência de fim,', texto: 'não 365 dias.' },
            ],
            { x: M, w: colunaLista, h: 1.7 },
          ).desenhar(y)
          lista(
            [
              { forte: 'Assinar congela:', texto: 'a receita é cópia da conduta naquele instante.' },
              { forte: 'O código não usa "I" nem "O"', texto: '— ele é ditado ao telefone.' },
              { forte: 'Controle especial', texto: 'em folha separada, 1ª e 2ª via.' },
              { forte: 'Repetir a receita anterior', texto: 'em um toque.' },
            ],
            { x: M + colunaLista + 0.5, w: colunaLista, h: 1.7 },
          ).desenhar(y)
        },
      },
    ],
    ATE_BANDA,
  )

  destaque(
    'Enviar ao responsável fica registrado com data, e o painel mostra ao vet exatamente o que a pessoa vai ler — incluindo o lembrete que nasce da posologia.',
  )
}

// ================================================================ 12 · documentos

{
  conteudo()
  const y0 = cabecalho(
    'Documentos e vacinas',
    'O que sai da consulta em papel',
    'Quinze documentos, mas a tela só oferece os três ou quatro que este atendimento pede.',
  )

  empilhar(
    y0,
    [
      grade(
        [
          {
            etiqueta: 'Família 1',
            titulo: 'Recortes do prontuário',
            texto:
              'Prontuário, receituário, pedido de exame, orientações, encaminhamento, relatório de plano.\n\nNão afirmam nada novo: reorganizam o que já está registrado.',
          },
          {
            etiqueta: 'Família 2',
            titulo: 'Declarações do profissional',
            texto:
              'Atestado de saúde, de comparecimento e de viagem; declaração de óbito; comprovante de vacinação.\n\nAssinatura só do profissional.',
          },
          {
            etiqueta: 'Família 3',
            titulo: 'Termos do responsável',
            texto:
              'Consentimento, recusa e eutanásia — mais o orçamento, no administrativo.\n\nDuas assinaturas, e a do responsável é a que vale.',
          },
        ],
        { colunas: 3, altura: 1.76 },
      ),
      grade(
        [
          {
            titulo: 'Vacinação com o ciclo fechado',
            texto: 'O registro guarda lote, fabricante, validade e dose da série — e o comprovante sai preenchido.',
          },
          {
            titulo: 'Lista de chamada de reforço',
            texto: 'Quem está vencido ou a vencer tem tela própria, e o número sobe como pendência no menu.',
          },
        ],
        { colunas: 2, altura: 0.98 },
      ),
    ],
    ATE_BANDA,
  )

  destaque('Tudo sai em folha A4, impresso pelo navegador — sem depender de nada instalado na recepção.')
}

// ================================================================= 13 · divisória

divisoria(
  'BLOCO 3',
  'A internação',
  'O bloco inteiro que não existia — e o diferencial que nenhum concorrente entrega.',
)

// ====================================================================== 14 · mapa

{
  conteudo()
  const y0 = cabecalho(
    'Internação',
    'O mapa de leitos',
    'Oito leitos: três gerais, dois felinos, uma UTI e dois de isolamento — um deles parado para manutenção, com o motivo escrito.',
  )

  empilhar(
    y0,
    [
      grade(
        [
          {
            titulo: 'O leito vazio ocupa espaço',
            texto:
              '"Onde ponho o próximo" é metade da pergunta que a clínica faz o dia inteiro. Vaga que não aparece é vaga que a clínica não sabe que tem.',
          },
          {
            tom: 'atencao',
            titulo: 'Urgência, não gravidade',
            texto:
              'Um crítico com tudo em dia não precisa piscar; um estável com duas doses atrasadas precisa. Por gravidade, o mapa ficaria vermelho onde nada há para fazer.',
          },
          {
            tom: 'risco',
            titulo: 'O boletim preso tem dono',
            texto:
              'Selo no cartão do paciente, com ícone de telefone e não de alerta: o que se pede ali não é atenção, é uma ligação.',
          },
        ],
        { colunas: 3, altura: 1.36 },
      ),
      grade(
        [
          {
            etiqueta: 'Cadastro de leitos',
            titulo: 'Quantos leitos a clínica tem é resposta dela',
            texto:
              'Cadastra, renomeia, tira de operação com motivo e devolve. O número muda quando a clínica cresce — então leito é dado editável, não constante de código.',
          },
          {
            etiqueta: 'Duas recusas que a tela explica',
            titulo: 'Leito ocupado não sai de operação',
            texto:
              'E a tela diz por quê, em texto — não com um botão apagado, que se lê como defeito. Leito que já recebeu paciente nunca se apaga.',
          },
        ],
        { colunas: 2, altura: 1.17 },
      ),
    ],
    ATE_BANDA,
  )

  destaque(
    'Internação não é agendamento. Agendamento tem começo e fim na grade; internação tem entrada e uma alta que ninguém sabe quando será.',
  )
}

// ===================================================================== 15 · turno

{
  conteudo()
  const y0 = cabecalho(
    'Internação',
    'O turno, hora a hora',
    'Quatro abas de trabalho no paciente internado — e a passagem de plantão que entrega o que ficou.',
  )

  empilhar(
    y0,
    [
      grade(
        [
          {
            etiqueta: 'Aba 1',
            titulo: 'Prescrição por horário',
            texto: 'Horários já materializados: quem executou precisa de uma linha para morar.',
          },
          {
            etiqueta: 'Aba 2',
            titulo: 'Checklist de enfermagem',
            texto: 'Agrupado por hora, com a linha do "agora". Guarda quem deu e a que horas.',
          },
          {
            etiqueta: 'Aba 3',
            titulo: 'Evolução por plantão',
            texto: 'Uma por paciente e por turno, com os vitais do turno anterior à vista.',
          },
          {
            etiqueta: 'Aba 4',
            titulo: 'Boletim ao responsável',
            texto: 'A conversa do celular ao lado da tela, para ver o que a pessoa vai ler.',
          },
        ],
        { colunas: 4, altura: 1.36 },
      ),
      grade(
        [
          {
            titulo: '"Recusada" não é "pulada"',
            texto:
              'O gato que cospe o comprimido é informação clínica que faz o vet trocar a via — não um esquecimento da enfermagem.',
          },
          {
            titulo: 'Atraso é lido, nunca gravado',
            texto:
              'Uma dose marcada como atrasada às 14h continuaria atrasada depois de dada às 14h10. Tolerância de 30 minutos.',
          },
          {
            tom: 'atencao',
            titulo: 'A dose em cima da troca',
            texto:
              'É nomeada e trava a entrega do turno. Quem sai acha que quem entra vai dar, quem entra acha que já foi dada, e ela some.',
          },
        ],
        { colunas: 3, altura: 1.17 },
      ),
    ],
    ATE_BANDA,
  )

  destaque(
    'A passagem congela as pendências. Recalculada depois, a lista mostraria a pendência já resolvida pelo turno seguinte — e viraria uma página em branco.',
  )
}

// =================================================================== 16 · boletim

{
  conteudo()
  const y0 = cabecalho(
    'Internação',
    'O boletim — o diferencial da entrega',
    'A internação é o momento de maior angústia de quem deixou o animal na clínica, e hoje essa pessoa liga quatro vezes por dia.',
  )

  empilhar(
    y0,
    [
      grade(
        [
          {
            titulo: 'O texto é montado pelo sistema',
            texto: 'Estado, o que foi observado, doses do turno, temperatura. E congelado no envio.',
          },
          {
            titulo: 'Frequência de 1 h a 24 h',
            texto: 'Com o custo em mensagens por dia à vista antes de confirmar. Foto opcional.',
          },
          {
            titulo: 'O silêncio noturno junta, não pula',
            texto: 'O boletim das 3 da manhã sai às 7h. Pular deixaria nove horas sem notícia.',
          },
        ],
        { colunas: 3, altura: 0.98 },
      ),
      caixa(
        [
          {
            t: 'A REGRA QUE DÁ NOME AO MÓDULO',
            forte: true,
            cor: C.risco,
            ...T.cartaoEtiqueta,
            espacamento: 1.6,
            quebra: true,
          },
          { t: 'Piora não sai por aplicativo.', forte: true, tamanho: 19, entrelinha: 26, quebra: true },
          {
            t: 'Quando o quadro piora, o boletim nasce retido e não sai até alguém registrar a ligação. Ler no celular, sozinho, que o animal piorou transforma o diferencial na pior lembrança que a pessoa tem da clínica. A trava vive no servidor: nenhuma tela nova, nem uma integração futura, a contorna.',
            tamanho: 11.5,
            entrelinha: 16,
          },
        ],
        { altura: 1.68, tom: 'risco' },
      ),
    ],
    ATE_BANDA,
  )

  destaque(
    'Seguir crítico não cobra ligação nova a cada boletim — só a piora cobra. Exigi-la de hora em hora faria a clínica desligar os boletins de quem mais precisa deles.',
    { tom: 'atencao' },
  )
}

// ====================================================================== 17 · alta

{
  conteudo()
  const y0 = cabecalho(
    'Internação',
    'A alta hospitalar',
    'O ciclo começava e não terminava: o animal entrava no mapa de leitos e não tinha por onde sair.',
  )

  empilhar(y0, [
    tabelaBloco({
      colW: [1.6, 3.2, W - 4.8],
      alturaLinha: 0.74,
      cabecalho: ['Desfecho', 'O que o responsável recebe', 'Por quê'],
      linhas: [
        [
          'Alta',
          'Mensagem no aplicativo: o pet foi para casa',
          'Fecha a conversa que os boletins abriram. Sem ela, a última coisa lida continua sendo o boletim das 14h.',
        ],
        [
          'Transferido',
          'Nada. Comunica-se por telefone',
          'O animal saiu vivo e o caso continua em outro lugar. Somar à alta leria como sucesso um encaminhamento às três da manhã.',
        ],
        [
          'Óbito',
          'Nada. Comunica-se por telefone',
          'Quem recebe por notificação a notícia de que o animal morreu não volta a essa clínica — mesmo que tudo antes tenha sido impecável.',
        ],
      ],
    }),
    grade(
      [
        {
          titulo: 'O sistema recusa os dois graves',
          texto: 'Sem a ligação registrada, o encerramento não sai. A regra mora no servidor.',
        },
        {
          titulo: 'Conferência antes de confirmar',
          texto: 'Permanência, doses dadas, recusadas e puladas, boletins entregues.',
        },
        {
          tom: 'atencao',
          titulo: 'Avisos, e nunca travas',
          texto: 'Travar faria o animal sair pela porta com o sistema dizendo que ele está no leito R3.',
        },
        {
          titulo: 'Orientação obrigatória nos três',
          texto: 'No óbito e na transferência, é o registro do que foi dito ao telefone.',
        },
      ],
      { colunas: 4, altura: 1.17 },
    ),
  ])
}

// ================================================================= 18 · divisória

divisoria(
  'BLOCO 4',
  'Como isto foi construído',
  'As decisões que se repetem em toda tela, e o estado real da entrega.',
)

// ================================================================= 19 · princípios

{
  conteudo()
  const y0 = cabecalho(
    'Princípios',
    'Seis regras que atravessam o módulo inteiro',
    'Não são estilo. Cada uma existe porque a alternativa produz um dano concreto na operação.',
  )

  empilhar(
    y0,
    [
      grade(
        [
          {
            titulo: 'Cor nunca vem sozinha',
            texto:
              'O par mínimo é símbolo mais palavra; a cor é a terceira camada. Há um interruptor de escala de cinza no módulo para provar isso.',
          },
          {
            titulo: 'Nada bloqueia; tudo avisa',
            texto:
              'Regra que proíbe vira regra contornada no papel. As duas exceções são de segurança, e moram no servidor.',
          },
          {
            titulo: 'Estruturado primeiro, livre ao lado',
            texto:
              'Todo campo novo nasce estruturado; o texto livre convive, nunca substitui. É o que permite score de risco amanhã.',
          },
          {
            titulo: 'Status é recalculado, nunca guardado',
            texto:
              'Corrigir o peso não deixa uma leitura antiga marcada como "dentro da faixa". Vale igual para o atraso de uma dose.',
          },
          {
            titulo: 'A regra que protege mora no servidor',
            texto:
              'Boletim de piora e encerramento grave. Na tela, bastaria outra tela — ou uma rota de API — para a notícia grave escapar.',
          },
          {
            titulo: 'A procedência do dado importa',
            texto:
              'O que veio do responsável é distinguível do aferido pelo vet. Peso informado em casa não entra nos sinais vitais.',
          },
        ],
        { colunas: 3, altura: 1.17 },
      ),
    ],
    ATE_BANDA,
  )

  destaque(
    'A régua da clínica é deliberadamente mais densa que a do aplicativo do responsável: três níveis de densidade, escolhidos por quem opera. O app é emocional; o sistema da clínica é operacional.',
  )
}

// ===================================================================== 20 · estado

{
  conteudo()
  const y0 = cabecalho(
    'Estado da entrega',
    'O que é real, e o que ainda é protótipo',
    'A lista honesta, para ninguém prometer o que não há.',
  )

  empilhar(y0, [
    numeros(
      [
        { valor: '770', rotulo: 'testes passando' },
        { valor: '66', rotulo: 'arquivos de teste' },
        { valor: '4', rotulo: 'idiomas sem divergência' },
        { valor: '0', rotulo: 'erros de tipo ou de build' },
      ],
      {},
    ),
    tabelaBloco({
      colW: [3.6, W - 3.6],
      alturaLinha: 0.6,
      cabecalho: ['O que a tela mostra', 'O que ainda não acontece'],
      linhas: [
        [
          'Todo o módulo',
          'Não há integração com servidor: ele roda sobre dados de demonstração, no formato que a API vai ter. Recarregar recria o mundo.',
        ],
        [
          'Enviar receita e boletim',
          'O envio é registrado e a conversa aparece na prévia, mas quem entrega a mensagem é o aplicativo — outro projeto.',
        ],
        [
          'Assinatura com código verificador',
          'Hoje o código é um resumo simples; na API vira assinatura criptográfica.',
        ],
        [
          'Orçamento, plano de saúde, microchip',
          'O orçamento sai sem valores: não há tabela de preços. Plano e microchip não existem no cadastro.',
        ],
        /*
         * A lentidão é linha da tabela, e não faixa no rodapé: como faixa, ela dependeria de uma
         * altura de tabela suposta — e foi essa suposição que empurrou o rodapé deste slide para
         * fora da página na primeira versão.
         */
        [
          'Lentidão e falha de rede',
          'São simuladas de propósito. Há um painel de demonstração para ajustá-las e para saltar aos casos difíceis.',
        ],
      ],
    }),
  ])
}

// ==================================================================== 21 · a seguir

{
  conteudo()
  const y0 = cabecalho(
    'A seguir',
    'O que recomendo construir em seguida',
    'Em ordem de custo para a operação real, não de esforço de desenvolvimento.',
  )

  empilhar(y0, [
    grade(
      [
        {
          etiqueta: 'Prioridade 1',
          titulo: 'Consentimento na agenda, na cirurgia',
          texto: 'Ele é assinado antes do procedimento, e hoje só existe para reimpressão no fim.',
        },
        {
          etiqueta: 'Prioridade 2',
          titulo: 'Resumo de alta imprimível',
          texto: 'A alta já registra a orientação; falta o papel que vai junto com o animal.',
        },
        {
          etiqueta: 'Prioridade 3',
          titulo: 'Alerta de medicação contínua',
          texto: 'Cruzado com o bulário, como já se faz com alergia.',
        },
        {
          etiqueta: 'Prioridade 4',
          titulo: 'A internação na linha do tempo',
          texto: 'Com desfecho e permanência. Hoje o tratamento some quando o animal vai para casa.',
        },
      ],
      { colunas: 4, altura: 1.39 },
    ),
    caixa(
      [
        {
          t: 'UM PEDIDO, ANTES DE CONSIDERAR O MENU RESOLVIDO',
          forte: true,
          cor: C.ambar,
          ...T.cartaoEtiqueta,
          espacamento: 1.6,
          quebra: true,
        },
        {
          t: 'Agora, Em curso, Pendências e Análise são as quatro perguntas que nós achamos que a clínica faz. Vinte minutos com alguém que opera clínica de verdade valem mais que qualquer teste automatizado.',
          tamanho: 12,
          entrelinha: 17,
          quebra: true,
        },
        {
          t: 'É a única verificação desta entrega que nenhum código consegue fazer.',
          forte: true,
          cor: C.ambar,
          tamanho: 12,
          entrelinha: 17,
        },
      ],
      { altura: 1.36, tom: 'atencao' },
    ),
  ])
}

// ======================================================================= 22 · fecho

slideEscuro()
texto({
  x: 1.15,
  y: 2.2,
  w: 8,
  h: 0.3,
  margem: 0,
  ...T.etiqueta,
  cor: C.verdeLinha,
  espacamento: 2.4,
  runs: [{ t: 'EM UMA FRASE', forte: true }],
})
texto({
  x: 1.15,
  y: 2.6,
  w: 10.4,
  h: 1.7,
  margem: 0,
  tamanho: 29,
  entrelinha: 40,
  cor: C.branco,
  runs: [
    {
      t: 'A clínica passa a ter um lugar só para o dia inteiro — e quem deixou o animal lá deixa de ligar quatro vezes por dia.',
      forte: true,
    },
  ],
})
retangulo({ x: 1.15, y: 4.5, w: 1.5, h: 0.04, fill: C.verdeLinha })
texto({
  x: 1.15,
  y: 4.74,
  w: 10.4,
  h: 0.4,
  margem: 0,
  tamanho: 12.5,
  entrelinha: 17,
  cor: C.verdeLinha,
  runs: [
    {
      t: 'Agenda · Fila · Prontuário · Receituário · Documentos · Vacinas · Internação · Alta hospitalar',
    },
  ],
})
texto({
  x: 1.15,
  y: 5.3,
  w: 10.4,
  h: 0.32,
  margem: 0,
  tamanho: 11,
  entrelinha: 15,
  cor: C.verdeLinha,
  runs: [{ t: 'PetJourney · Portal do parceiro · Setembro de 2026' }],
})

export const slides = ops
export const RODAPE = 'PetJourney  ·  Módulo clínico'
