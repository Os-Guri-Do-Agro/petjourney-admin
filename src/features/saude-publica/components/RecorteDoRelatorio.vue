<script setup lang="ts">
/**
 * A caixa do recorte dos Relatórios (17/11/2026, "organizar melhor os filtros do recorte"), a mesma
 * nas abas "Atendimentos por lugar" e "Equipe" (o estado mora em `recorte-do-relatorio.ts`).
 *
 * Duas fileiras, com o rótulo em cima de cada campo e todos da mesma altura:
 *
 * - **O quê e quando**: de onde, quando, animais, situação e equipe, numa grade alinhada (cinco
 *   colunas no largo, três no tablet).
 * - **Onde**: região, bairro ou CEP (um modo por vez; só o escolhido filtra) e o campo do modo no
 *   resto da linha. No modo CEP cabem quantos CEPs a pessoa quiser, digitados ou colados de uma vez;
 *   o começo do CEP (de 3 a 7 dígitos) pega a faixa toda.
 *
 * No pé, o recorte numa frase e "Limpar filtros (N)", só quando algum filtro saiu do padrão. Como
 * agrupar não é filtro: fica na caixa do resultado de cada aba ("Ver por").
 */
import Button from 'primevue/button'
import Chip from 'primevue/chip'
import DatePicker from 'primevue/datepicker'
import InputText from 'primevue/inputtext'
import MultiSelect from 'primevue/multiselect'
import Popover from 'primevue/popover'
import Select from 'primevue/select'
import SelectButton from 'primevue/selectbutton'
import { computed, ref } from 'vue'

import { cepConfere, digitosDoCep, registrosDoRelatorio } from '@/features/saude-publica/campo'
import {
  BAIRROS,
  EQUIPE,
  FUNCOES,
  funcaoDaPessoa,
  numero,
  REGIOES,
} from '@/features/saude-publica/dados'
import {
  ESPECIES_DO_RECORTE,
  LIMITE_DO_RELATORIO,
  OPCOES_DE_ORIGEM,
  PERIODO_PADRAO,
  rotuloDoCep,
  SITUACOES_DO_RECORTE,
  useRecorteDoRelatorio,
  type OndeDoRecorte,
} from '@/features/saude-publica/recorte-do-relatorio'

const recorte = useRecorteDoRelatorio()
const { origem, de, ate, especie, situacao, equipe, onde, regioes, bairros, ceps } = recorte

/* --------------------------------------------------------------------------------- opções */

const LUGARES: { valor: OndeDoRecorte; rotulo: string; icone: string }[] = [
  { valor: 'regiao', rotulo: 'Região', icone: 'ph ph-map-trifold' },
  { valor: 'bairro', rotulo: 'Bairro', icone: 'ph ph-map-pin-area' },
  { valor: 'cep', rotulo: 'CEP', icone: 'ph ph-envelope-simple' },
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

/** A equipe agrupada pela função, na ordem das funções. */
const opcoesDeEquipe = FUNCOES.map((definicao) => ({
  rotulo: definicao.grupo,
  itens: EQUIPE.filter((pessoa) => pessoa.funcao === definicao.id).map((pessoa) => ({
    valor: pessoa.id,
    rotulo: pessoa.nome,
    funcao: funcaoDaPessoa(pessoa),
  })),
})).filter((grupo) => grupo.itens.length)

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

const limites = {
  min: paraData(LIMITE_DO_RELATORIO.inicio),
  max: paraData(LIMITE_DO_RELATORIO.fim),
}

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

/** Quantos atendimentos cada CEP da lista pega, com o resto do recorte igual. */
const contaPorCep = computed(() => {
  if (onde.value !== 'cep' || !ceps.value.length) return new Map<string, number>()
  const semCep = registrosDoRelatorio({ ...recorte.filtro.value, ceps: [] })
  return new Map(
    ceps.value.map((cep) => [cep, semCep.filter((item) => cepConfere(item.cep, [cep])).length]),
  )
})

function limparTudo() {
  limparCeps()
  recorte.limpar()
}
</script>

<template>
  <section class="ui-folha ui-cartao rr" aria-labelledby="rr-titulo">
    <header class="ui-cartao__cabeca rr__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-funnel-simple" /></span>
      <span class="ui-cartao__titulos">
        <h2 id="rr-titulo" class="ui-cartao__titulo">O recorte</h2>
        <p class="ui-cartao__descricao">
          Os atendimentos do Consultório Móvel e das campanhas, onde mora o tutor de cada animal. O
          mesmo recorte vale para as duas abas.
        </p>
      </span>
    </header>

    <!-- O quê e quando: cinco campos numa grade, rótulo em cima, mesma altura. -->
    <div class="rr__fileira" role="group" aria-labelledby="rr-oque">
      <h3 id="rr-oque" class="rr__grupo">O quê e quando</h3>
      <div class="rr__grade">
        <div class="rr__campo">
          <span id="rr-origem" class="rr__rotulo">De onde</span>
          <Select
            v-model="origem"
            class="rr__controle"
            :options="OPCOES_DE_ORIGEM"
            option-label="rotulo"
            option-value="valor"
            aria-labelledby="rr-origem"
          >
            <template #option="{ option }">
              <span class="rr__opcao">
                <i :class="option.icone" aria-hidden="true" />
                {{ option.rotulo }}
              </span>
            </template>
          </Select>
        </div>

        <div class="rr__campo">
          <span class="rr__rotulo">Quando</span>
          <Button
            type="button"
            class="rr__controle rr__datas"
            severity="secondary"
            outlined
            icon="ph ph-calendar-blank"
            :label="recorte.intervaloCurto.value"
            aria-haspopup="dialog"
            :aria-label="`Período: ${recorte.intervalo.value}. Escolher as datas`"
            @click="abrirCalendario"
          />
          <Popover ref="calendario">
            <div class="rr__calendario">
              <strong>Escolha o começo e o fim</strong>
              <div class="rr__atalhos">
                <Button
                  type="button"
                  size="small"
                  severity="secondary"
                  outlined
                  label="Os 90 dias"
                  @click="usarPeriodo(PERIODO_PADRAO.de, PERIODO_PADRAO.ate)"
                />
                <Button
                  type="button"
                  size="small"
                  severity="secondary"
                  outlined
                  label="Até 31/03"
                  @click="usarPeriodo(LIMITE_DO_RELATORIO.inicio, LIMITE_DO_RELATORIO.fim)"
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

        <div class="rr__campo">
          <span id="rr-especie" class="rr__rotulo">Animais</span>
          <Select
            v-model="especie"
            class="rr__controle"
            :options="ESPECIES_DO_RECORTE"
            option-label="rotulo"
            option-value="valor"
            aria-labelledby="rr-especie"
          >
            <template #value="{ value }">
              <span class="rr__opcao">
                <i
                  :class="ESPECIES_DO_RECORTE.find((item) => item.valor === value)?.icone"
                  aria-hidden="true"
                />
                {{ ESPECIES_DO_RECORTE.find((item) => item.valor === value)?.rotulo }}
              </span>
            </template>
            <template #option="{ option }">
              <span class="rr__opcao">
                <i :class="option.icone" aria-hidden="true" />
                {{ option.rotulo }}
              </span>
            </template>
          </Select>
        </div>

        <div class="rr__campo">
          <span id="rr-situacao" class="rr__rotulo">Situação</span>
          <Select
            v-model="situacao"
            class="rr__controle"
            :options="SITUACOES_DO_RECORTE"
            option-label="rotulo"
            option-value="valor"
            placeholder="Todas as situações"
            show-clear
            aria-labelledby="rr-situacao"
          >
            <template #option="{ option }">
              <span class="rr__opcao">
                <i :class="option.icone" aria-hidden="true" />
                {{ option.rotulo }}
              </span>
            </template>
          </Select>
        </div>

        <div class="rr__campo">
          <span id="rr-equipe" class="rr__rotulo">Equipe</span>
          <MultiSelect
            v-model="equipe"
            class="rr__controle"
            :options="opcoesDeEquipe"
            option-label="rotulo"
            option-value="valor"
            option-group-label="rotulo"
            option-group-children="itens"
            placeholder="Toda a equipe"
            :max-selected-labels="1"
            selected-items-label="{0} pessoas"
            :show-toggle-all="false"
            aria-labelledby="rr-equipe"
          >
            <template #option="{ option }">
              <span class="rr__pessoa">
                <span>{{ option.rotulo }}</span>
                <small>{{ option.funcao }}</small>
              </span>
            </template>
          </MultiSelect>
        </div>
      </div>
    </div>

    <!-- Onde: um modo por vez, e o campo do modo no resto da linha. -->
    <div class="rr__fileira" role="group" aria-labelledby="rr-onde-grupo">
      <h3 id="rr-onde-grupo" class="rr__grupo">Onde</h3>
      <div class="rr__onde">
        <div class="rr__campo">
          <span id="rr-onde" class="rr__rotulo">Por</span>
          <SelectButton
            v-model="onde"
            class="rr__trilho"
            :options="LUGARES"
            option-label="rotulo"
            option-value="valor"
            :allow-empty="false"
            aria-labelledby="rr-onde"
          >
            <template #option="{ option }">
              <i :class="option.icone" aria-hidden="true" />
              <span>{{ option.rotulo }}</span>
            </template>
          </SelectButton>
        </div>

        <div v-if="onde === 'regiao'" class="rr__campo">
          <span id="rr-regioes" class="rr__rotulo">Regiões urbanas</span>
          <MultiSelect
            v-model="regioes"
            class="rr__controle"
            :options="opcoesDeRegiao"
            option-label="rotulo"
            option-value="valor"
            placeholder="Todas as regiões"
            :max-selected-labels="3"
            selected-items-label="{0} regiões"
            :show-toggle-all="false"
            aria-labelledby="rr-regioes"
          />
        </div>

        <div v-else-if="onde === 'bairro'" class="rr__campo">
          <span id="rr-bairros" class="rr__rotulo">Bairros</span>
          <MultiSelect
            v-model="bairros"
            class="rr__controle"
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
            aria-labelledby="rr-bairros"
          />
        </div>

        <div v-else class="rr__campo rr__ceps">
          <label class="rr__rotulo" for="rr-cep">CEPs</label>
          <div class="rr__ceps-entrada">
            <InputText
              id="rr-cep"
              v-model="textoDoCep"
              class="rr__ceps-texto"
              inputmode="numeric"
              placeholder="79094-000, 79084…"
              aria-describedby="rr-cep-dica"
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
          <small id="rr-cep-dica" class="rr__dica">
            Cole quantos CEPs quiser; o começo do CEP pega a faixa toda.
          </small>
          <p v-if="recusados.length" class="rr__recusados" role="alert">
            <i class="ph ph-warning-circle" aria-hidden="true" />
            Não entraram: {{ recusados.join(', ') }}. O CEP tem 8 dígitos (ou o começo, de 3 a 7) e
            os de Campo Grande começam com 79.
          </p>
          <ul v-if="ceps.length" class="rr__ceps-lista" aria-label="CEPs do recorte">
            <li v-for="cep in ceps" :key="cep">
              <Chip
                :label="`${rotuloDoCep(cep)} · ${numero(contaPorCep.get(cep) ?? 0)}`"
                :class="{ 'rr__ceps-vazio': !contaPorCep.get(cep) }"
                removable
                :pt="{ removeIcon: { 'aria-label': `Tirar o CEP ${rotuloDoCep(cep)}` } }"
                @remove="tirarCep(cep)"
              />
            </li>
          </ul>
        </div>
      </div>
    </div>

    <!-- O recorte numa frase, e limpar quando algo saiu do padrão. -->
    <footer class="rr__pe">
      <p class="rr__frase">
        <i class="ph ph-funnel" aria-hidden="true" />
        <span>{{ recorte.recorteNaFrase.value }}</span>
      </p>
      <Button
        v-if="recorte.ativos.value"
        type="button"
        severity="secondary"
        outlined
        icon="ph ph-x"
        :label="`Limpar filtros (${recorte.ativos.value})`"
        @click="limparTudo"
      />
    </footer>
  </section>
</template>

<style scoped>
.rr {
  display: grid;
  align-content: start;
  gap: 18px;
  container: recorte / inline-size;
}

.rr__cabeca {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.rr__fileira {
  display: grid;
  gap: 10px;
}

.rr__grupo {
  margin: 0;
  color: var(--tinta-2);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

/*
 * O quê e quando: as cinco numa linha só quando cabem sem cortar o texto (tela larga); senão, três
 * colunas alinhadas, em duas linhas. O "De onde" e o "Quando" um pouco mais largos.
 */
.rr__grade {
  display: grid;
  align-items: end;
  gap: 14px 16px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

@container recorte (min-width: 1180px) {
  .rr__grade {
    grid-template-columns: 1.3fr 1.2fr 1fr 1.1fr 1fr;
  }
}

@container recorte (max-width: 620px) {
  .rr__grade {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

.rr__campo {
  display: grid;
  align-content: start;
  gap: 6px;
  min-width: 0;
}

.rr__rotulo {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 650;
}

/* Todos os campos com a largura da coluna e a mesma altura. */
.rr__controle {
  width: 100%;
  min-width: 0;
  min-height: 2.75rem;
}

.rr__datas {
  justify-content: flex-start;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.rr__opcao {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.rr__pessoa {
  display: grid;
  gap: 1px;
}

.rr__pessoa small {
  color: var(--tinta-2);
  font-size: 11.5px;
}

.rr__trilho :deep(.p-togglebutton-content) {
  gap: 6px;
}

/* Onde: o modo no tamanho dele, e o campo do modo no resto da linha. */
.rr__onde {
  display: grid;
  align-items: start;
  gap: 14px 16px;
  grid-template-columns: auto minmax(0, 1fr);
}

@container recorte (max-width: 620px) {
  .rr__onde {
    grid-template-columns: minmax(0, 1fr);
  }
}

.rr__calendario {
  display: grid;
  gap: 8px;
}

.rr__calendario strong {
  color: var(--tinta);
  font-size: 13.5px;
}

.rr__calendario small {
  color: var(--tinta-2);
  font-size: 12px;
}

.rr__atalhos {
  display: flex;
  gap: 8px;
}

/* Os CEPs: o campo e os botões numa linha, as pílulas embaixo. */
.rr__ceps-entrada {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.rr__ceps-texto {
  flex: 1 1 14rem;
  min-width: 0;
  min-height: 2.75rem;
  font-variant-numeric: tabular-nums;
}

.rr__dica {
  color: var(--tinta-2);
  font-size: 12px;
}

.rr__recusados {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin: 0;
  color: var(--atencao-tinta);
  font-size: 12.5px;
}

.rr__recusados i {
  margin-top: 2px;
}

.rr__ceps-lista {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.rr__ceps-lista :deep(.p-chip) {
  font-variant-numeric: tabular-nums;
}

/* CEP que não pega nenhum atendimento: a pílula avisa pela forma (contorno tracejado), não só cor. */
.rr__ceps-lista :deep(.p-chip.rr__ceps-vazio) {
  outline: 1px dashed var(--atencao-tinta);
  outline-offset: -1px;
}

/* O pé: a frase do recorte e o limpar, separados das fileiras por um fio. */
.rr__pe {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
  padding-top: 14px;
  border-top: 1px solid var(--app-regua, var(--linha-suave));
}

.rr__frase {
  display: flex;
  flex: 1 1 24rem;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.rr__frase i {
  margin-top: 2px;
}
</style>
