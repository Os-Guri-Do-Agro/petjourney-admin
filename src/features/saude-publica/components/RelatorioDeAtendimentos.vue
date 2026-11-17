<script setup lang="ts">
/**
 * O relatório dos atendimentos em campo por lugar (17/11/2026, "gerar relatório dos atendimentos por
 * bairro, região ou CEP, e o usuário pode colocar quantos CEPs forem necessários").
 *
 * Três caixas, uma por assunto: o recorte (de onde, quando, que animais, em que situação, onde e como
 * agrupar), o resultado agrupado (os números do recorte e uma linha por região, bairro ou CEP) e o
 * porquê (os motivos do que não deu e cada procedimento). Os números saem de `campo.ts`
 * (`registrosDoRelatorio`), então o que a equipe registra na apresentação entra na hora.
 *
 * "Onde" escolhe um modo (região, bairro ou CEP) e só o modo escolhido filtra; o agrupamento é à
 * parte, para dar para filtrar por região e ver CEP a CEP. No modo CEP cabem quantos CEPs a pessoa
 * quiser, digitados ou colados de uma vez; o começo do CEP (de 3 a 7 dígitos) pega a faixa toda.
 *
 * Saídas: a folha para imprimir (cópia no `body` marcada `clinic-print-root`, cores fixas de papel)
 * e a planilha CSV (ponto e vírgula e BOM, para o Excel em português abrir certo). A página chama
 * as duas pelo `defineExpose`.
 */
import Button from 'primevue/button'
import Chip from 'primevue/chip'
import DatePicker from 'primevue/datepicker'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Popover from 'primevue/popover'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import { computed, ref, watch } from 'vue'

import UiVazioIlustrado from '@/components/ui/UiVazioIlustrado.vue'
import {
  agruparRegistros,
  cepConfere,
  cepNaTela,
  digitosDoCep,
  registrosDoRelatorio,
  resumirRegistros,
  type Agrupamento,
  type FiltroDoRelatorio,
  type LinhaDoRelatorio,
} from '@/features/saude-publica/campo'
import {
  BAIRROS,
  CAMPANHAS,
  dataCurta,
  motivo as motivoDe,
  numero,
  procedimento as procedimentoDe,
  REGIOES,
  tipoDeCampanha,
  type IdDaRegiao,
  type SituacaoDoAtendimento,
} from '@/features/saude-publica/dados'
import type { Especie } from '@/features/saude-publica/serie'

/* ================================================================================ o recorte */

/** O que o relatório cobre: os 90 dias do programa e março, onde ficam as campanhas agendadas. */
const LIMITE = { inicio: '2026-12-01', fim: '2027-03-31' }
const PADRAO = { de: '2026-12-01', ate: '2027-02-28' }

const TODOS = 'todos'
const origem = ref<string>(TODOS)
const de = ref(PADRAO.de)
const ate = ref(PADRAO.ate)
const especie = ref<Especie>('todos')
const situacao = ref<SituacaoDoAtendimento | null>(null)

type Onde = 'regiao' | 'bairro' | 'cep'
const onde = ref<Onde>('regiao')
const regioes = ref<IdDaRegiao[]>([])
const bairros = ref<string[]>([])
/** Só os dígitos: 8 é o CEP inteiro; de 3 a 7, o começo (a faixa). */
const ceps = ref<string[]>([])

const agrupamento = ref<Agrupamento>('regiao')

type Ordem = 'total' | 'taxa' | 'nome'
const ordem = ref<Ordem>('total')

/* --------------------------------------------------------------------------------- opções */

const campanhasEmOrdem = [...CAMPANHAS].sort((uma, outra) => uma.data.localeCompare(outra.data))

const OPCOES_DE_ORIGEM = [
  { valor: TODOS, rotulo: 'Todos os atendimentos', icone: 'ph ph-squares-four' },
  { valor: 'piloto', rotulo: 'Consultório Móvel (piloto)', icone: 'ph ph-van' },
  { valor: 'campanhas', rotulo: 'Todas as campanhas', icone: 'ph ph-megaphone' },
  ...campanhasEmOrdem.map((campanha) => ({
    valor: campanha.id,
    rotulo: `${tipoDeCampanha(campanha.tipo).rotulo} · ${dataCurta(campanha.data).slice(0, 5)}`,
    icone: tipoDeCampanha(campanha.tipo).icone,
  })),
]

const ESPECIES: { valor: Especie; rotulo: string; icone: string }[] = [
  { valor: 'todos', rotulo: 'Cães e gatos', icone: 'ph ph-paw-print' },
  { valor: 'caes', rotulo: 'Cães', icone: 'ph ph-dog' },
  { valor: 'gatos', rotulo: 'Gatos', icone: 'ph ph-cat' },
]

const SITUACOES: { valor: SituacaoDoAtendimento; rotulo: string; icone: string }[] = [
  { valor: 'realizado', rotulo: 'Realizado', icone: 'ph ph-check-circle' },
  { valor: 'parcial', rotulo: 'Parcial', icone: 'ph ph-circle-half' },
  { valor: 'nao-realizado', rotulo: 'Não realizado', icone: 'ph ph-x-circle' },
]

const LUGARES: { valor: Agrupamento; rotulo: string; icone: string }[] = [
  { valor: 'regiao', rotulo: 'Região', icone: 'ph ph-map-trifold' },
  { valor: 'bairro', rotulo: 'Bairro', icone: 'ph ph-map-pin-area' },
  { valor: 'cep', rotulo: 'CEP', icone: 'ph ph-envelope-simple' },
]

const ORDENS: { valor: Ordem; rotulo: string }[] = [
  { valor: 'total', rotulo: 'Mais atendimentos' },
  { valor: 'taxa', rotulo: 'Menor % realizado' },
  { valor: 'nome', rotulo: 'Nome' },
]

const opcoesDeRegiao = [...REGIOES]
  .sort((uma, outra) => uma.nome.localeCompare(outra.nome, 'pt'))
  .map((regiao) => ({ valor: regiao.id, rotulo: regiao.nome }))

/** Os 74 bairros, agrupados pela região, em ordem alfabética nos dois níveis. */
const opcoesDeBairro = [...REGIOES]
  .sort((uma, outra) => uma.nome.localeCompare(outra.nome, 'pt'))
  .map((regiao) => ({
    rotulo: regiao.nome,
    itens: BAIRROS.filter((bairro) => bairro.regiao === regiao.id)
      .map((bairro) => ({ valor: bairro.nome, rotulo: bairro.nome }))
      .sort((um, outro) => um.rotulo.localeCompare(outro.rotulo, 'pt')),
  }))

/* ------------------------------------------------------------------------------ o período */

const calendario = ref<InstanceType<typeof Popover> | null>(null)
const datas = ref<(Date | null)[] | null>(null)

function paraData(valor: string) {
  const [ano, mes, dia] = valor.split('-').map(Number) as [number, number, number]
  return new Date(ano, mes - 1, dia)
}

function paraTexto(data: Date) {
  const mes = String(data.getMonth() + 1).padStart(2, '0')
  const dia = String(data.getDate()).padStart(2, '0')
  return `${data.getFullYear()}-${mes}-${dia}`
}

const limites = { min: paraData(LIMITE.inicio), max: paraData(LIMITE.fim) }

const intervalo = computed(() => `${dataCurta(de.value)} a ${dataCurta(ate.value)}`)

function abrirCalendario(evento: Event) {
  datas.value = [paraData(de.value), paraData(ate.value)]
  calendario.value?.toggle(evento)
}

function aoEscolherDatas(valor: unknown) {
  const lista = Array.isArray(valor) ? (valor as (Date | null)[]) : null
  datas.value = lista
  const [inicio, fim] = lista ?? []
  if (inicio && fim) {
    const [um, outro] = [paraTexto(inicio), paraTexto(fim)].sort()
    de.value = um!
    ate.value = outro!
    calendario.value?.hide()
  }
}

function usarPeriodo(inicio: string, fim: string) {
  de.value = inicio
  ate.value = fim
  calendario.value?.hide()
}

/* A campanha escolhida fora do período: o período estica até ela, para o recorte não vir vazio. */
watch(origem, (valor) => {
  const campanha = CAMPANHAS.find((item) => item.id === valor)
  if (!campanha) return
  if (campanha.data < de.value) de.value = campanha.data
  if (campanha.data > ate.value) ate.value = campanha.data
})

/* ----------------------------------------------------------------------------------- CEPs */

const textoDoCep = ref('')
const recusados = ref<string[]>([])

/**
 * Lê um ou vários CEPs (vírgula, ponto e vírgula, espaço ou quebra de linha): 8 dígitos é o CEP, de
 * 3 a 7 é o começo dele. Campo Grande é 79000-000 a 79129-999: o que não começa por 79 fica de fora.
 */
function adicionarCeps(texto: string) {
  const pedacos = texto
    .split(/[\s,;]+/)
    .map((pedaco) => pedaco.trim())
    .filter(Boolean)
  if (!pedacos.length) return
  const novos: string[] = []
  const ruins: string[] = []
  for (const pedaco of pedacos) {
    const digitos = digitosDoCep(pedaco)
    const soCep = /^[\d.\-–…]+$/.test(pedaco)
    if (!soCep || digitos.length < 3 || digitos.length > 8 || !digitos.startsWith('79')) {
      ruins.push(pedaco)
      continue
    }
    if (!ceps.value.includes(digitos) && !novos.includes(digitos)) novos.push(digitos)
  }
  ceps.value = [...ceps.value, ...novos]
  recusados.value = ruins
  textoDoCep.value = ''
}

function aoColar(evento: ClipboardEvent) {
  const texto = evento.clipboardData?.getData('text') ?? ''
  if (!/[\s,;]/.test(texto.trim())) return
  evento.preventDefault()
  adicionarCeps(`${textoDoCep.value} ${texto}`)
}

function aoTeclar(evento: KeyboardEvent) {
  if (evento.key === 'Enter' || evento.key === ',' || evento.key === ';') {
    evento.preventDefault()
    adicionarCeps(textoDoCep.value)
  }
}

function tirarCep(cep: string) {
  ceps.value = ceps.value.filter((item) => item !== cep)
}

function limparCeps() {
  ceps.value = []
  recusados.value = []
  textoDoCep.value = ''
}

/** "79094-000", ou "79094-… (faixa)" para o começo do CEP. */
function rotuloDoCep(cep: string) {
  return cep.length === 8 ? cepNaTela(cep) : `${cepNaTela(cep)}… (faixa)`
}

/* ============================================================================== o resultado */

const filtro = computed<FiltroDoRelatorio>(() => ({
  origem: origem.value === TODOS ? null : origem.value,
  de: de.value,
  ate: ate.value,
  especie: especie.value,
  situacao: situacao.value,
  regioes: onde.value === 'regiao' ? regioes.value : [],
  bairros: onde.value === 'bairro' ? bairros.value : [],
  ceps: onde.value === 'cep' ? ceps.value : [],
}))

const registros = computed(() => registrosDoRelatorio(filtro.value))
const resumo = computed(() => resumirRegistros(registros.value))

/** Quantos atendimentos cada CEP da lista pega, com o resto do recorte igual. */
const contaPorCep = computed(() => {
  if (onde.value !== 'cep' || !ceps.value.length) return new Map<string, number>()
  const semCep = registrosDoRelatorio({ ...filtro.value, ceps: [] })
  return new Map(
    ceps.value.map((cep) => [cep, semCep.filter((item) => cepConfere(item.cep, [cep])).length]),
  )
})

const linhas = computed<LinhaDoRelatorio[]>(() => {
  const lista = agruparRegistros(registros.value, agrupamento.value)
  if (ordem.value === 'taxa') return [...lista].sort((uma, outra) => uma.taxa - outra.taxa)
  if (ordem.value === 'nome') {
    return [...lista].sort((uma, outra) => uma.rotulo.localeCompare(outra.rotulo, 'pt'))
  }
  return lista
})

/** CEP a CEP a lista passa de centenas: a tela mostra as 40 primeiras e o resto a pedido. */
const PRIMEIRAS = 40
const todasAsLinhas = ref(false)
watch([agrupamento, filtro], () => {
  todasAsLinhas.value = false
})
const linhasNaTela = computed(() =>
  todasAsLinhas.value ? linhas.value : linhas.value.slice(0, PRIMEIRAS),
)

const maiorMotivo = computed(() => Math.max(1, ...resumo.value.motivos.map((item) => item.vezes)))

/* --------------------------------------------------------------------------- os textos */

const nomeDoAgrupamento: Record<Agrupamento, { titulo: string; coluna: string; arquivo: string }> =
  {
    regiao: { titulo: 'Por região urbana', coluna: 'Região', arquivo: 'regiao' },
    bairro: { titulo: 'Por bairro', coluna: 'Bairro', arquivo: 'bairro' },
    cep: { titulo: 'Por CEP', coluna: 'CEP', arquivo: 'cep' },
  }

const nomeDaSituacao = (valor: SituacaoDoAtendimento) =>
  SITUACOES.find((item) => item.valor === valor)!.rotulo

/** Até três nomes e "e mais N". */
function lista(nomes: string[]) {
  if (nomes.length <= 3) return nomes.join(', ')
  return `${nomes.slice(0, 3).join(', ')} e mais ${nomes.length - 3}`
}

const ondeNaFrase = computed(() => {
  if (onde.value === 'regiao' && regioes.value.length) {
    return `regiões: ${lista(regioes.value.map((id) => REGIOES.find((r) => r.id === id)!.nome))}`
  }
  if (onde.value === 'bairro' && bairros.value.length) return `bairros: ${lista(bairros.value)}`
  if (onde.value === 'cep' && ceps.value.length) {
    return `CEPs: ${lista(ceps.value.map(rotuloDoCep))}`
  }
  return 'a cidade inteira'
})

/** O recorte numa linha, na tela e no papel. */
const recorteNaFrase = computed(() =>
  [
    OPCOES_DE_ORIGEM.find((item) => item.valor === origem.value)!.rotulo,
    intervalo.value,
    ESPECIES.find((item) => item.valor === especie.value)!.rotulo,
    situacao.value ? `só ${nomeDaSituacao(situacao.value).toLowerCase()}` : '',
    ondeNaFrase.value,
  ]
    .filter(Boolean)
    .join(' · '),
)

function motivoPrincipal(linha: LinhaDoRelatorio) {
  const primeiro = linha.motivos[0]
  return primeiro ? motivoDe(primeiro.motivo) : null
}

const naoRealizadosDaLinha = (linha: LinhaDoRelatorio) => linha.naoRealizados + linha.parciais

/* ================================================================================ as saídas */

function hojeEmTexto() {
  return paraTexto(new Date())
}

const geradoEm = computed(() => dataCurta(hojeEmTexto()))

function imprimir() {
  window.print()
}

function campoCsv(valor: string | number) {
  const texto = String(valor)
  return /[;"\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto
}

/** A planilha da tabela agrupada: uma linha por lugar, com o recorte na primeira linha. */
function baixarPlanilha() {
  const coluna = nomeDoAgrupamento[agrupamento.value].coluna
  const cabeca = [
    coluna,
    'Onde fica',
    'Atendimentos',
    'Realizados',
    'Parciais',
    'Não realizados',
    '% realizado',
    'Motivo mais comum',
  ]
  const corpo = linhas.value.map((linha) => [
    linha.rotulo,
    linha.onde,
    linha.total,
    linha.realizados,
    linha.parciais,
    linha.naoRealizados,
    linha.taxa,
    motivoPrincipal(linha)?.rotulo ?? '',
  ])
  const texto = [[`Recorte: ${recorteNaFrase.value}`], cabeca, ...corpo]
    .map((linha) => linha.map(campoCsv).join(';'))
    .join('\r\n')
  const blob = new Blob([`﻿${texto}\r\n`], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `atendimentos-por-${nomeDoAgrupamento[agrupamento.value].arquivo}-${hojeEmTexto()}.csv`
  document.body.append(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

defineExpose({ imprimir, baixarPlanilha })
</script>

<template>
  <div class="ra">
    <!-- O recorte: de onde, quando, que animais, em que situação, onde e como agrupar. -->
    <section class="ui-folha ui-cartao ra-caixa" aria-labelledby="ra-recorte">
      <header class="ui-cartao__cabeca ra-cabeca">
        <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-funnel-simple" /></span>
        <span class="ui-cartao__titulos">
          <h2 id="ra-recorte" class="ui-cartao__titulo">O recorte</h2>
          <p class="ui-cartao__descricao">
            Os atendimentos do Consultório Móvel e das campanhas, onde mora o tutor de cada animal.
          </p>
        </span>
      </header>

      <div class="ra-campos">
        <div class="ra-campo">
          <span class="ra-rotulo" id="ra-origem">De onde</span>
          <Select
            v-model="origem"
            class="ra-lista ra-lista--larga"
            :options="OPCOES_DE_ORIGEM"
            option-label="rotulo"
            option-value="valor"
            aria-labelledby="ra-origem"
          >
            <template #option="{ option }">
              <span class="ra-opcao">
                <i :class="option.icone" aria-hidden="true" />
                {{ option.rotulo }}
              </span>
            </template>
          </Select>
        </div>

        <div class="ra-campo">
          <span class="ra-rotulo">Quando</span>
          <Button
            type="button"
            class="ra-datas"
            severity="secondary"
            outlined
            icon="ph ph-calendar-blank"
            :label="intervalo"
            aria-haspopup="dialog"
            :aria-label="`Período: ${intervalo}. Escolher as datas`"
            @click="abrirCalendario"
          />
          <Popover ref="calendario">
            <div class="ra-calendario">
              <strong>Escolha o começo e o fim</strong>
              <div class="ra-calendario__atalhos">
                <Button
                  type="button"
                  size="small"
                  severity="secondary"
                  outlined
                  label="Os 90 dias"
                  @click="usarPeriodo(PADRAO.de, PADRAO.ate)"
                />
                <Button
                  type="button"
                  size="small"
                  severity="secondary"
                  outlined
                  label="Até 31/03"
                  @click="usarPeriodo(LIMITE.inicio, LIMITE.fim)"
                />
              </div>
              <DatePicker
                :model-value="datas"
                selection-mode="range"
                inline
                :min-date="limites.min"
                :max-date="limites.max"
                :manual-input="false"
                @update:model-value="aoEscolherDatas"
              />
              <small>De 01/12/2026 a 31/03/2027: os 90 dias e as campanhas agendadas.</small>
            </div>
          </Popover>
        </div>

        <div class="ra-campo">
          <span class="ra-rotulo" id="ra-especie">Animais</span>
          <SelectButton
            v-model="especie"
            class="ra-trilho"
            :options="ESPECIES"
            option-label="rotulo"
            option-value="valor"
            :allow-empty="false"
            aria-labelledby="ra-especie"
          >
            <template #option="{ option }">
              <i :class="option.icone" aria-hidden="true" />
              <span>{{ option.rotulo }}</span>
            </template>
          </SelectButton>
        </div>
      </div>

      <!-- Onde: um modo por vez; só o modo escolhido filtra. -->
      <div class="ra-onde">
        <div class="ra-campo">
          <span class="ra-rotulo" id="ra-onde">Onde</span>
          <SelectButton
            v-model="onde"
            class="ra-trilho"
            :options="LUGARES"
            option-label="rotulo"
            option-value="valor"
            :allow-empty="false"
            aria-labelledby="ra-onde"
          >
            <template #option="{ option }">
              <i :class="option.icone" aria-hidden="true" />
              <span>{{ option.rotulo }}</span>
            </template>
          </SelectButton>
        </div>

        <div v-if="onde === 'regiao'" class="ra-campo ra-campo--cresce">
          <span class="ra-rotulo" id="ra-regioes">Regiões urbanas</span>
          <MultiSelect
            v-model="regioes"
            class="ra-lista ra-lista--larga"
            :options="opcoesDeRegiao"
            option-label="rotulo"
            option-value="valor"
            placeholder="Todas as regiões"
            :max-selected-labels="3"
            selected-items-label="{0} regiões"
            :show-toggle-all="false"
            aria-labelledby="ra-regioes"
          />
        </div>

        <div v-else-if="onde === 'bairro'" class="ra-campo ra-campo--cresce">
          <span class="ra-rotulo" id="ra-bairros">Bairros</span>
          <MultiSelect
            v-model="bairros"
            class="ra-lista ra-lista--larga"
            :options="opcoesDeBairro"
            option-label="rotulo"
            option-value="valor"
            option-group-label="rotulo"
            option-group-children="itens"
            placeholder="Todos os bairros"
            filter
            filter-placeholder="Procurar bairro"
            :max-selected-labels="3"
            selected-items-label="{0} bairros"
            :show-toggle-all="false"
            aria-labelledby="ra-bairros"
          />
        </div>

        <div v-else class="ra-campo ra-campo--cresce ra-ceps">
          <label class="ra-rotulo" for="ra-cep">CEPs</label>
          <div class="ra-ceps__entrada">
            <InputText
              id="ra-cep"
              v-model="textoDoCep"
              class="ra-ceps__texto"
              inputmode="numeric"
              placeholder="79094-000, 79084…"
              aria-describedby="ra-cep-dica"
              @keydown="aoTeclar"
              @paste="aoColar"
              @blur="adicionarCeps(textoDoCep)"
            />
            <Button
              type="button"
              severity="secondary"
              outlined
              icon="ph ph-plus"
              label="Adicionar"
              :disabled="!textoDoCep.trim()"
              @click="adicionarCeps(textoDoCep)"
            />
            <Button
              v-if="ceps.length"
              type="button"
              severity="secondary"
              outlined
              icon="ph ph-x"
              label="Limpar CEPs"
              @click="limparCeps"
            />
          </div>
          <small id="ra-cep-dica" class="ra-dica">
            Cole quantos CEPs quiser; o começo do CEP pega a faixa toda.
          </small>
          <p v-if="recusados.length" class="ra-recusados" role="alert">
            <i class="ph ph-warning-circle" aria-hidden="true" />
            Não entraram: {{ recusados.join(', ') }}. O CEP tem 8 dígitos (ou o começo, de 3 a 7) e
            os de Campo Grande começam com 79.
          </p>
          <ul v-if="ceps.length" class="ra-ceps__lista" aria-label="CEPs do recorte">
            <li v-for="cep in ceps" :key="cep">
              <Chip
                :label="`${rotuloDoCep(cep)} · ${numero(contaPorCep.get(cep) ?? 0)}`"
                :class="{ 'ra-ceps__vazio': !contaPorCep.get(cep) }"
                removable
                :pt="{ removeIcon: { 'aria-label': `Tirar o CEP ${rotuloDoCep(cep)}` } }"
                @remove="tirarCep(cep)"
              />
            </li>
          </ul>
        </div>
      </div>

      <div class="ra-campos">
        <div class="ra-campo">
          <span class="ra-rotulo" id="ra-situacao">Situação</span>
          <Select
            v-model="situacao"
            class="ra-lista"
            :options="SITUACOES"
            option-label="rotulo"
            option-value="valor"
            placeholder="Todas as situações"
            show-clear
            aria-labelledby="ra-situacao"
          >
            <template #option="{ option }">
              <span class="ra-opcao">
                <i :class="option.icone" aria-hidden="true" />
                {{ option.rotulo }}
              </span>
            </template>
          </Select>
        </div>

        <div class="ra-campo">
          <span class="ra-rotulo" id="ra-agrupar">Uma linha por</span>
          <SelectButton
            v-model="agrupamento"
            class="ra-trilho"
            :options="LUGARES"
            option-label="rotulo"
            option-value="valor"
            :allow-empty="false"
            aria-labelledby="ra-agrupar"
          >
            <template #option="{ option }">
              <i :class="option.icone" aria-hidden="true" />
              <span>{{ option.rotulo }}</span>
            </template>
          </SelectButton>
        </div>
      </div>
    </section>

    <!-- O resultado: os números do recorte e uma linha por lugar. -->
    <section class="ui-folha ui-cartao ra-caixa" aria-labelledby="ra-resultado">
      <header class="ui-cartao__cabeca ra-cabeca">
        <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-table" /></span>
        <span class="ui-cartao__titulos">
          <h2 id="ra-resultado" class="ui-cartao__titulo">
            {{ nomeDoAgrupamento[agrupamento].titulo }}
            <span class="ui-contagem">{{ numero(linhas.length) }}</span>
          </h2>
          <p class="ui-cartao__descricao">{{ recorteNaFrase }}</p>
        </span>
      </header>

      <UiVazioIlustrado
        v-if="!resumo.total"
        aninhado
        icone="ph ph-clipboard-text"
        titulo="Nenhum atendimento neste recorte"
        texto="Mude a origem, o período, os animais, a situação ou o lugar."
      />

      <template v-else>
        <dl class="ra-numeros">
          <div>
            <dt>Atendimentos</dt>
            <dd class="ui-num">{{ numero(resumo.total) }}</dd>
          </div>
          <div>
            <dt>Realizados</dt>
            <dd class="ui-num">{{ numero(resumo.realizados) }}</dd>
          </div>
          <div>
            <dt>Parciais</dt>
            <dd class="ui-num">{{ numero(resumo.parciais) }}</dd>
          </div>
          <div>
            <dt>Não realizados</dt>
            <dd class="ui-num">{{ numero(resumo.naoRealizados) }}</dd>
          </div>
          <div>
            <dt>Realizado</dt>
            <dd class="ui-num">{{ resumo.taxa }}%</dd>
          </div>
        </dl>

        <div class="ra-ordem">
          <span class="ra-rotulo" id="ra-ordem">Ordem</span>
          <SelectButton
            v-model="ordem"
            :options="ORDENS"
            option-label="rotulo"
            option-value="valor"
            :allow-empty="false"
            size="small"
            aria-labelledby="ra-ordem"
          />
        </div>

        <div class="ra-tabela__rolo">
          <table class="ra-tabela">
            <thead>
              <tr>
                <th scope="col">{{ nomeDoAgrupamento[agrupamento].coluna }}</th>
                <th scope="col" class="ra-tabela__numero">Atendimentos</th>
                <th scope="col" class="ra-tabela__numero">Realizados</th>
                <th scope="col" class="ra-tabela__numero">Não realizados</th>
                <th scope="col" class="ra-tabela__taxa">% realizado</th>
                <th scope="col">Motivo mais comum</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="linha in linhasNaTela" :key="linha.chave">
                <th scope="row">
                  <span class="ra-lugar">
                    <strong :class="{ 'ra-lugar--sem': linha.chave === 'sem' }">
                      {{ linha.rotulo }}
                    </strong>
                    <small v-if="linha.onde">{{ linha.onde }}</small>
                  </span>
                </th>
                <td class="ra-tabela__numero ui-num">{{ numero(linha.total) }}</td>
                <td class="ra-tabela__numero ui-num">{{ numero(linha.realizados) }}</td>
                <td class="ra-tabela__numero ui-num">
                  {{ numero(naoRealizadosDaLinha(linha)) }}
                  <small v-if="linha.parciais" class="ra-parciais">
                    ({{ numero(linha.parciais) }}
                    {{ linha.parciais === 1 ? 'parcial' : 'parciais' }})
                  </small>
                </td>
                <td class="ra-tabela__taxa">
                  <span class="ra-taxa">
                    <span class="ra-taxa__trilho" aria-hidden="true">
                      <span
                        class="ra-taxa__barra"
                        :class="{ 'ra-taxa__barra--baixa': linha.taxa < 85 }"
                        :style="{ width: `${linha.taxa}%` }"
                      />
                    </span>
                    <span class="ui-num">{{ linha.taxa }}%</span>
                  </span>
                </td>
                <td>
                  <span v-if="motivoPrincipal(linha)" class="ra-motivo">
                    <i :class="motivoPrincipal(linha)!.icone" aria-hidden="true" />
                    {{ motivoPrincipal(linha)!.rotulo }}
                  </span>
                  <span v-else class="ra-motivo ra-motivo--nada">Tudo feito</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <Button
          v-if="linhas.length > PRIMEIRAS && !todasAsLinhas"
          type="button"
          class="ra-mais"
          severity="secondary"
          outlined
          icon="ph ph-caret-down"
          :label="`Mostrar as ${numero(linhas.length)} linhas`"
          @click="todasAsLinhas = true"
        />
      </template>
    </section>

    <!-- O porquê: os motivos do que não deu e cada procedimento. -->
    <div v-if="resumo.total" class="ra-par">
      <section class="ui-folha ui-cartao ra-caixa" aria-labelledby="ra-motivos">
        <header class="ui-cartao__cabeca ra-cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-question" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="ra-motivos" class="ui-cartao__titulo">Por que não deu</h2>
            <p class="ui-cartao__descricao">
              O motivo anotado em cada procedimento que não foi feito.
            </p>
          </span>
        </header>
        <p v-if="!resumo.motivos.length" class="ra-nada">
          <i class="ph ph-check-circle" aria-hidden="true" />
          Todos os procedimentos do recorte foram feitos.
        </p>
        <ol v-else class="ra-barras">
          <li v-for="item in resumo.motivos" :key="item.motivo" class="ra-barra">
            <span class="ra-barra__rotulo">
              <i :class="motivoDe(item.motivo).icone" aria-hidden="true" />
              {{ motivoDe(item.motivo).rotulo }}
            </span>
            <span class="ra-barra__valor ui-num">{{ numero(item.vezes) }}</span>
            <span class="ra-barra__trilho" aria-hidden="true">
              <span
                class="ra-barra__cheio ra-barra__cheio--motivo"
                :style="{ width: `${(item.vezes / maiorMotivo) * 100}%` }"
              />
            </span>
          </li>
        </ol>
      </section>

      <section class="ui-folha ui-cartao ra-caixa" aria-labelledby="ra-procedimentos">
        <header class="ui-cartao__cabeca ra-cabeca">
          <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-syringe" /></span>
          <span class="ui-cartao__titulos">
            <h2 id="ra-procedimentos" class="ui-cartao__titulo">Por procedimento</h2>
            <p class="ui-cartao__descricao">Quantas vezes cada um foi feito, e quantas não deu.</p>
          </span>
        </header>
        <ol class="ra-barras">
          <li v-for="item in resumo.procedimentos" :key="item.procedimento" class="ra-barra">
            <span class="ra-barra__rotulo">
              <i :class="procedimentoDe(item.procedimento).icone" aria-hidden="true" />
              {{ procedimentoDe(item.procedimento).rotulo }}
            </span>
            <span class="ra-barra__valor">
              <span class="ui-num">{{ numero(item.feitos) }}</span> feitos ·
              <span class="ui-num">{{ numero(item.naoFeitos) }}</span> não
            </span>
            <span class="ra-barra__trilho" aria-hidden="true">
              <span
                class="ra-barra__cheio"
                :style="{ width: `${(item.feitos / (item.feitos + item.naoFeitos)) * 100}%` }"
              />
            </span>
          </li>
        </ol>
      </section>
    </div>

    <p class="ra-privacidade">
      <i class="ph ph-lock-simple" aria-hidden="true" />
      Só contagens: o relatório não traz nome de tutor nem endereço. Um CEP pode ser uma rua só:
      cuidado ao divulgar recortes com poucos atendimentos.
    </p>

    <!-- A folha do papel: só ela vai para a impressão, em cores fixas. -->
    <Teleport to="body">
      <div class="clinic-print-root ra-impressao" aria-hidden="true">
        <article class="ra-papel">
          <header class="ra-papel__cabeca">
            <span class="ra-papel__empresa">Pet Journey Saúde e Tecnologia Ltda.</span>
            <h1>Relatório de atendimentos · {{ nomeDoAgrupamento[agrupamento].titulo }}</h1>
            <p>Programa de saúde de cães e gatos · Campo Grande/MS</p>
            <p>
              Recorte: {{ recorteNaFrase }} ·
              <strong>simulação com dados ilustrativos (protótipo)</strong>
            </p>
          </header>

          <dl class="ra-papel__numeros">
            <div>
              <dt>Atendimentos</dt>
              <dd>{{ numero(resumo.total) }}</dd>
            </div>
            <div>
              <dt>Realizados</dt>
              <dd>{{ numero(resumo.realizados) }}</dd>
            </div>
            <div>
              <dt>Parciais</dt>
              <dd>{{ numero(resumo.parciais) }}</dd>
            </div>
            <div>
              <dt>Não realizados</dt>
              <dd>{{ numero(resumo.naoRealizados) }}</dd>
            </div>
            <div>
              <dt>Realizado</dt>
              <dd>{{ resumo.taxa }}%</dd>
            </div>
          </dl>

          <table class="ra-papel__tabela">
            <thead>
              <tr>
                <th>{{ nomeDoAgrupamento[agrupamento].coluna }}</th>
                <th>Onde fica</th>
                <th class="ra-papel__numero">Atend.</th>
                <th class="ra-papel__numero">Realiz.</th>
                <th class="ra-papel__numero">Não realiz.</th>
                <th class="ra-papel__numero">%</th>
                <th>Motivo mais comum</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="linha in linhas" :key="linha.chave">
                <td>
                  <strong>{{ linha.rotulo }}</strong>
                </td>
                <td>{{ linha.onde }}</td>
                <td class="ra-papel__numero">{{ numero(linha.total) }}</td>
                <td class="ra-papel__numero">{{ numero(linha.realizados) }}</td>
                <td class="ra-papel__numero">{{ numero(naoRealizadosDaLinha(linha)) }}</td>
                <td class="ra-papel__numero">{{ linha.taxa }}%</td>
                <td>{{ motivoPrincipal(linha)?.rotulo ?? 'Tudo feito' }}</td>
              </tr>
            </tbody>
          </table>

          <section v-if="resumo.motivos.length" class="ra-papel__secao">
            <h2>Por que não deu</h2>
            <p>
              <span v-for="(item, indice) in resumo.motivos" :key="item.motivo">
                {{ motivoDe(item.motivo).rotulo }}: {{ numero(item.vezes)
                }}{{ indice < resumo.motivos.length - 1 ? ' · ' : '.' }}
              </span>
            </p>
          </section>

          <section class="ra-papel__secao">
            <h2>Por procedimento</h2>
            <p>
              <span v-for="(item, indice) in resumo.procedimentos" :key="item.procedimento">
                {{ procedimentoDe(item.procedimento).rotulo }}: {{ numero(item.feitos) }} feitos,
                {{ numero(item.naoFeitos) }} não{{
                  indice < resumo.procedimentos.length - 1 ? ' · ' : '.'
                }}
              </span>
            </p>
          </section>

          <p class="ra-papel__pe">
            Só contagens, sem nome de tutor nem endereço. Gerado em {{ geradoEm }} no portal da
            PetJourney.
          </p>
        </article>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.ra {
  display: grid;
  gap: 18px;
}

.ra-caixa {
  display: grid;
  align-content: start;
  gap: 16px;
}

.ra-cabeca {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

/* ------------------------------------------------------------------------------ o recorte */

.ra-campos,
.ra-onde {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 14px 18px;
}

.ra-campo {
  display: grid;
  align-content: start;
  justify-items: start;
  gap: 6px;
}

.ra-campo--cresce {
  flex: 1 1 22rem;
  min-width: 0;
  justify-items: stretch;
}

.ra-rotulo {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 650;
}

.ra-lista {
  min-width: 13rem;
}

.ra-lista--larga {
  width: 100%;
  min-width: 17rem;
}

.ra-trilho :deep(.p-togglebutton-content) {
  gap: 6px;
}

.ra-opcao {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.ra-datas {
  font-variant-numeric: tabular-nums;
}

.ra-calendario {
  display: grid;
  gap: 8px;
}

.ra-calendario strong {
  color: var(--tinta);
  font-size: 13.5px;
}

.ra-calendario small {
  color: var(--tinta-2);
  font-size: 12px;
}

.ra-calendario__atalhos {
  display: flex;
  gap: 8px;
}

/* Os CEPs: o campo e os botões numa linha, as pílulas embaixo. */
.ra-ceps__entrada {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.ra-ceps__texto {
  flex: 1 1 14rem;
  min-width: 0;
  font-variant-numeric: tabular-nums;
}

.ra-dica {
  color: var(--tinta-2);
  font-size: 12px;
}

.ra-recusados {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  color: var(--atencao-tinta);
  font-size: 12.5px;
}

.ra-recusados i {
  margin-top: 2px;
}

.ra-ceps__lista {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ra-ceps__lista :deep(.p-chip) {
  font-variant-numeric: tabular-nums;
}

/* CEP que não pega nenhum atendimento: a pílula avisa pela forma (contorno tracejado), não só cor. */
.ra-ceps__lista :deep(.p-chip.ra-ceps__vazio) {
  outline: 1px dashed var(--atencao-tinta);
  outline-offset: -1px;
}

/* ---------------------------------------------------------------------------- o resultado */

.ra-numeros {
  display: grid;
  gap: 12px 14px;
  margin: 0;
  grid-template-columns: repeat(5, minmax(0, 1fr));
}

@media (max-width: 900px) {
  .ra-numeros {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.ra-numeros div {
  display: grid;
  gap: 2px;
}

.ra-numeros dt {
  order: 2;
  color: var(--tinta-2);
  font-size: 12.5px;
}

.ra-numeros dd {
  margin: 0;
  color: var(--tinta);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: -0.02em;
  line-height: 1.05;
}

.ra-ordem {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
}

.ra-tabela__rolo {
  overflow-x: auto;
}

.ra-tabela {
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
}

.ra-tabela th,
.ra-tabela td {
  padding: 10px 14px 10px 0;
  border-bottom: 1px solid var(--app-regua, var(--linha-suave));
  color: var(--tinta-2);
  text-align: start;
  vertical-align: middle;
}

.ra-tabela thead th {
  color: var(--tinta-2);
  font-size: 12px;
  font-weight: 650;
  white-space: nowrap;
}

.ra-tabela tbody tr:last-child th,
.ra-tabela tbody tr:last-child td {
  border-bottom: 0;
}

.ra-tabela__numero {
  text-align: end !important;
  white-space: nowrap;
}

.ra-tabela__taxa {
  width: 12rem;
}

.ra-lugar {
  display: grid;
  gap: 1px;
}

.ra-lugar strong {
  color: var(--tinta);
  font-weight: 650;
  font-variant-numeric: tabular-nums;
}

.ra-lugar--sem {
  font-style: italic;
}

.ra-lugar small {
  color: var(--tinta-2);
  font-size: 12px;
  font-weight: 400;
}

.ra-parciais {
  display: block;
  color: var(--tinta-2);
  font-size: 11.5px;
}

.ra-taxa {
  display: flex;
  align-items: center;
  gap: 10px;
}

.ra-taxa > .ui-num {
  min-width: 3ch;
  color: var(--tinta);
  font-weight: 650;
  text-align: end;
}

.ra-taxa__trilho {
  position: relative;
  flex: 1;
  height: 8px;
  border-radius: 999px;
  background: var(--superficie-3);
}

.ra-taxa__barra {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  border-radius: 999px;
  background: var(--ok);
}

/* Abaixo de 85% realizado, a barra fica na cor de atenção: o lugar pede uma olhada. */
.ra-taxa__barra--baixa {
  background: var(--atencao);
}

.ra-motivo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
}

.ra-motivo--nada {
  color: var(--tinta-2);
  font-style: italic;
}

.ra-mais {
  justify-self: center;
}

/* ------------------------------------------------------------------------------ o porquê */

.ra-par {
  display: grid;
  align-items: start;
  gap: 18px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 24rem), 1fr));
}

.ra-nada {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.ra-nada i {
  color: var(--ok-tinta);
}

.ra-barras {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.ra-barra {
  display: grid;
  align-items: center;
  gap: 6px 12px;
  grid-template-columns: minmax(0, 1fr) auto;
}

.ra-barra__rotulo {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.ra-barra__valor {
  color: var(--tinta-2);
  font-size: 12.5px;
  white-space: nowrap;
}

.ra-barra__valor .ui-num,
.ra-barra__valor.ui-num {
  color: var(--tinta);
  font-weight: 650;
}

.ra-barra__trilho {
  position: relative;
  height: 8px;
  border-radius: 999px;
  background: var(--superficie-3);
  grid-column: 1 / -1;
}

.ra-barra__cheio {
  position: absolute;
  inset-block: 0;
  inset-inline-start: 0;
  border-radius: 999px;
  background: var(--ok);
}

.ra-barra__cheio--motivo {
  background: var(--atencao);
}

.ra-privacidade {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 12.5px;
}

.ra-privacidade i {
  margin-top: 2px;
}

/* ------------------------------------------------------------------------------- o papel */

/* Na tela, a cópia do papel nunca aparece; na impressão, a regra do portal a mostra. */
.ra-impressao {
  display: none;
}

.ra-papel {
  display: grid;
  gap: 14px;
  background: #fff;
  color: #40524b;
  font-size: 11.5px;
  line-height: 1.45;
}

.ra-papel__cabeca {
  display: grid;
  gap: 2px;
  padding-bottom: 10px;
  border-bottom: 2px solid #285e4e;
}

.ra-papel__cabeca p {
  margin: 0;
}

.ra-papel__cabeca strong {
  color: #905204;
}

.ra-papel__empresa {
  color: #285e4e;
  font-size: 10px;
  font-weight: 750;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.ra-papel h1 {
  margin: 0;
  color: #142721;
  font-size: 20px;
  font-weight: 800;
}

.ra-papel h2 {
  margin: 0;
  color: #142721;
  font-size: 13px;
  font-weight: 750;
}

.ra-papel__numeros {
  display: grid;
  gap: 8px;
  margin: 0;
  grid-template-columns: repeat(5, 1fr);
}

.ra-papel__numeros div {
  padding: 8px 10px;
  border: 1px solid #dfe7e3;
  border-radius: 8px;
}

.ra-papel__numeros dt {
  font-size: 10.5px;
}

.ra-papel__numeros dd {
  margin: 0;
  color: #142721;
  font-size: 18px;
  font-weight: 800;
}

.ra-papel__tabela {
  width: 100%;
  border-collapse: collapse;
}

.ra-papel__tabela th,
.ra-papel__tabela td {
  padding: 5px 8px 5px 0;
  border-bottom: 1px solid #dfe7e3;
  text-align: start;
}

.ra-papel__tabela th {
  color: #142721;
  font-size: 10.5px;
}

.ra-papel__tabela tr {
  break-inside: avoid;
}

.ra-papel__tabela strong {
  color: #142721;
}

.ra-papel__numero {
  text-align: end !important;
  white-space: nowrap;
}

.ra-papel__secao {
  display: grid;
  gap: 4px;
  break-inside: avoid;
}

.ra-papel__secao p,
.ra-papel__pe {
  margin: 0;
}

.ra-papel__pe {
  color: #5e6d67;
  font-size: 10.5px;
}
</style>
