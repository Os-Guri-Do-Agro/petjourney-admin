<script setup lang="ts">
/**
 * Hoje, versão **Linha do dia**, no design **planilha**.
 *
 * O layout trata o dia como ele é: uma sequência. Uma tabela só, em ordem de horário, cada linha
 * com a situação do paciente agora e a ação que cabe a ela. Uma marca de **agora** corta a
 * tabela: em cima, o que está acontecendo; embaixo, o que vem. O que já acabou fica recolhido
 * numa linha. As urgentes ficam numa fileira acima da tabela; o resto do que pede ação abre numa
 * gaveta à direita.
 *
 * O desenho é o de uma folha de jornal ou de planilha impressa, o oposto do cartão:
 *
 * - **Sem caixa.** Nada de cartão, sombra ou canto arredondado; o que organiza é a régua. Fio
 *   grosso em marinho abre cada bloco, fio fino separa as linhas.
 * - **Tipografia manda.** Instrument Sans em tudo, números tabulares e grandes: a data em
 *   manchete, o placar do dia em algarismos de 40 px separados por fio vertical, a hora como
 *   primeira coluna em destaque.
 * - **Uma cor de tinta.** Marinho `#1D3557` da paleta para texto, fio e ação. Estado é um
 *   quadradinho de cor ao lado da palavra (coral urgente, pêssego esperando, sálvia confirmado,
 *   marinho cheio em sala, vazado quando só marcado): forma e palavra, nunca só a cor.
 * - Botões de canto quase reto; rótulo de coluna em versalete pequeno.
 */
import Button from 'primevue/button'
import Drawer from 'primevue/drawer'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import UiPagina from '@/components/ui/UiPagina.vue'
import { useClinicFormat } from '@/features/clinico/composables/useClinicFormat'
import type { MeuDia } from '@/features/clinico/composables/useMeuDia'
import type { Appointment } from '@/features/clinico/data/types'
import { clinicClock } from '@/features/clinico/stores/clinico'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'
import { INTL_LOCALE, type Locale } from '@/i18n/locales'

const props = defineProps<{ dia: MeuDia }>()

const { t, locale } = useI18n()
const formato = useClinicFormat()

const encerradosAbertos = ref(false)
const gavetaAberta = ref(false)

const ENCERRADOS: Appointment['status'][] = ['finalizado', 'falta']
const DE_AGORA: Appointment['status'][] = ['em-atendimento', 'aguardando']

const encerrados = computed(() =>
  props.dia.doDia.filter((item) => ENCERRADOS.includes(item.status)),
)

/** Em cima da marca: quem está na sala, quem espera e o horário que já passou sem chegar. */
const antesDoAgora = computed(() => {
  const instante = clinicClock.nowIso()

  return props.dia.doDia.filter(
    (item) =>
      !ENCERRADOS.includes(item.status) &&
      (DE_AGORA.includes(item.status) || item.inicio <= instante),
  )
})

const depoisDoAgora = computed(() => {
  const instante = clinicClock.nowIso()

  return props.dia.doDia.filter(
    (item) =>
      !ENCERRADOS.includes(item.status) &&
      !DE_AGORA.includes(item.status) &&
      item.inicio > instante,
  )
})

/** As linhas da tabela, na ordem em que aparecem, com as duas que não são paciente. */
type Linha =
  | { tipo: 'encerrados' }
  | { tipo: 'agora' }
  | { tipo: 'vazio' }
  | { tipo: 'paciente'; item: Appointment; encerrado: boolean }

const linhas = computed<Linha[]>(() => [
  ...(encerrados.value.length ? [{ tipo: 'encerrados' as const }] : []),
  ...(encerradosAbertos.value
    ? encerrados.value.map((item) => ({ tipo: 'paciente' as const, item, encerrado: true }))
    : []),
  ...antesDoAgora.value.map((item) => ({ tipo: 'paciente' as const, item, encerrado: false })),
  { tipo: 'agora' as const },
  ...depoisDoAgora.value.map((item) => ({ tipo: 'paciente' as const, item, encerrado: false })),
  ...(depoisDoAgora.value.length ? [] : [{ tipo: 'vazio' as const }]),
])

function chaveDa(linha: Linha) {
  return linha.tipo === 'paciente' ? linha.item.id : linha.tipo
}

const horaDeAgora = computed(() => formato.hora(clinicClock.nowIso()))

/** A data em manchete: o dia grande, o dia da semana e o mês ao lado. */
const manchete = computed(() => {
  const intl = INTL_LOCALE[locale.value as Locale]
  const data = new Date(clinicClock.nowIso())
  const parte = (opcoes: Intl.DateTimeFormatOptions) => data.toLocaleDateString(intl, opcoes)
  const maiuscula = (texto: string) => texto.charAt(0).toLocaleUpperCase(intl) + texto.slice(1)

  return {
    dia: parte({ day: 'numeric' }),
    semana: maiuscula(parte({ weekday: 'long' })),
    mes: maiuscula(parte({ month: 'long' })),
  }
})

/** O quadradinho de estado: cor e forma por situação, sempre ao lado da palavra. */
type Marca = 'cheia' | 'espera' | 'confirmado' | 'vazada' | 'feito' | 'falta'

const MARCA_DO_STATUS: Record<Appointment['status'], Marca> = {
  'em-atendimento': 'cheia',
  aguardando: 'espera',
  confirmado: 'confirmado',
  agendado: 'vazada',
  finalizado: 'feito',
  falta: 'falta',
  cancelado: 'vazada',
}

/** "1 h 58 min" não quebra no meio quando a situação dobra no tablet: quebra no " · ". */
function tempoDesde(iso: string | null) {
  return formato.duracao(props.dia.minutosDesde(iso) ?? 0).replace(/ /g, ' ')
}

function situacao(item: Appointment) {
  const rotulo = formato.status(item.status)

  if (item.status === 'em-atendimento') {
    return `${rotulo} · ${tempoDesde(item.iniciadoEm ?? item.inicio)}`
  }

  if (item.status === 'aguardando') {
    return `${rotulo} · ${tempoDesde(item.chegadaEm)}`
  }

  return rotulo
}

function primeiroAlerta(item: Appointment) {
  const alerta = props.dia.alertasRelevantes(props.dia.pet(item.petId))[0]

  return alerta ? props.dia.textoDoAlerta(alerta) : ''
}
</script>

<template>
  <UiPagina
    class="planilha"
    :carregando="dia.carregando"
    :erro="dia.erro"
    bloquear-se-suspenso
    @tentar-de-novo="dia.carregar"
  >
    <!-- A manchete: a data grande, a frase do dia e as duas ações. -->
    <template #cabecalho>
      <header class="manchete">
        <p class="manchete__data">
          <span class="manchete__dia">{{ manchete.dia }}</span>
          <span class="manchete__extenso">
            <span>{{ manchete.semana }}</span>
            <span>{{ manchete.mes }}</span>
          </span>
        </p>

        <div class="manchete__frase">
          <h1>{{ dia.fraseDoResumo }}</h1>
          <p v-if="dia.andamentoDoDia">{{ dia.andamentoDoDia }}</p>
        </div>

        <div class="manchete__acoes">
          <Button
            type="button"
            severity="secondary"
            icon="ph ph-list-checks"
            :label="`${t('inicio.pauta.titulo')} (${dia.linhasDaPauta.length})`"
            :aria-expanded="gavetaAberta"
            @click="gavetaAberta = true"
          />
          <RouterLink class="p-button p-component" to="/veterinario/agenda">
            <i class="ph ph-calendar-blank" aria-hidden="true" />
            {{ t('clinico.meuDia.agendaCompleta') }}
          </RouterLink>
        </div>
      </header>
    </template>

    <div class="folha">
      <!-- O placar: os números do dia em algarismos grandes, separados por fio. -->
      <ul class="placar" :aria-label="t('clinico.meuDia.abertura.indicadores')">
        <li v-for="indicador in dia.indicadores" :key="indicador.id">
          <RouterLink class="placar__item" :to="indicador.to ?? '/veterinario/agenda'">
            <span class="placar__valor">{{ indicador.valor }}</span>
            <span class="placar__rotulo">
              <span
                v-if="indicador.tom"
                class="marca"
                :class="indicador.tom === 'risco' ? 'marca--falta' : 'marca--espera'"
                aria-hidden="true"
              />
              {{ indicador.rotulo }}
            </span>
          </RouterLink>
        </li>
      </ul>

      <!-- Só as urgentes, numa fileira: o quadradinho coral e a frase. -->
      <div v-if="dia.urgentes.length" class="urgentes">
        <p class="urgentes__rotulo">
          <span class="marca marca--falta" aria-hidden="true" />
          {{ t('inicio.pauta.gravidade.risco') }}
        </p>
        <ul>
          <li v-for="linha in dia.urgentes" :key="linha.id">
            <RouterLink :to="linha.to">
              <strong>{{ linha.frase }}</strong>
              <span v-if="linha.detalhe">{{ linha.detalhe }}</span>
            </RouterLink>
          </li>
        </ul>
      </div>

      <table class="tabela">
        <thead>
          <tr>
            <th scope="col" class="col-hora">{{ t('clinico.agenda.tabela.horario') }}</th>
            <th scope="col">{{ t('clinico.faltas.colunaPaciente') }}</th>
            <th scope="col" class="col-atendimento">
              {{ t('clinico.pacientes.colunaAtendimento') }}
            </th>
            <th scope="col" class="col-sala">{{ t('clinico.agenda.criar.sala') }}</th>
            <th scope="col">{{ t('clinico.agenda.filtroSituacao') }}</th>
            <th scope="col" class="col-acao">
              <span class="so-leitor">{{ t('clinico.meuDia.versoes.linha.acao') }}</span>
            </th>
          </tr>
        </thead>

        <tbody>
          <template v-for="linha in linhas" :key="chaveDa(linha)">
            <tr v-if="linha.tipo === 'encerrados'" class="tabela__encerrados">
              <td colspan="6">
                <Button
                  type="button"
                  severity="secondary"
                  text
                  size="small"
                  :icon="encerradosAbertos ? 'ph ph-caret-down' : 'ph ph-caret-right'"
                  :label="
                    t(
                      'clinico.meuDia.versoes.linha.encerrados',
                      { total: encerrados.length },
                      encerrados.length,
                    )
                  "
                  :aria-expanded="encerradosAbertos"
                  @click="encerradosAbertos = !encerradosAbertos"
                />
              </td>
            </tr>

            <!-- A marca do agora: fio grosso de ponta a ponta, com a hora num bloco. -->
            <tr v-else-if="linha.tipo === 'agora'" class="tabela__agora" aria-hidden="true">
              <td colspan="6">
                <span>{{ t('clinico.agenda.tabela.agora') }} {{ horaDeAgora }}</span>
              </td>
            </tr>

            <tr v-else-if="linha.tipo === 'vazio'" class="tabela__vazio">
              <td colspan="6">{{ t('clinico.meuDia.semProximo') }}</td>
            </tr>

            <tr
              v-else
              :class="[
                `tabela__linha--${linha.item.status}`,
                { 'tabela__linha--encerrada': linha.encerrado },
              ]"
            >
              <td class="col-hora">{{ formato.hora(linha.item.inicio) }}</td>
              <td>
                <span class="paciente">
                  <PetAvatar
                    :nome="dia.pet(linha.item.petId)?.nome ?? ''"
                    :iniciais="dia.pet(linha.item.petId)?.iniciais ?? ''"
                    :especie="dia.pet(linha.item.petId)?.especie ?? null"
                    :foto-url="dia.pet(linha.item.petId)?.fotoUrl ?? ''"
                    tamanho="sm"
                  />
                  <span class="paciente__texto">
                    <strong>{{ dia.pet(linha.item.petId)?.nome }}</strong>
                    <small v-if="!linha.encerrado && primeiroAlerta(linha.item)" class="alerta">
                      <span class="marca marca--espera" aria-hidden="true" />
                      {{ primeiroAlerta(linha.item) }}
                    </small>
                    <small v-else>{{ dia.linhaDoPaciente(dia.pet(linha.item.petId)) }}</small>
                  </span>
                </span>
              </td>
              <td class="col-atendimento">
                <span class="atendimento">
                  <span>{{ dia.tipoDe(linha.item) }}</span>
                  <small>{{ dia.profissionaisDe(linha.item) }}</small>
                </span>
              </td>
              <td class="col-sala">{{ dia.salasDe(linha.item) }}</td>
              <td>
                <span class="situacao">
                  <span
                    class="marca"
                    :class="`marca--${MARCA_DO_STATUS[linha.item.status]}`"
                    aria-hidden="true"
                  />
                  {{ situacao(linha.item) }}
                </span>
              </td>
              <td class="col-acao">
                <Button
                  v-if="linha.item.status === 'aguardando'"
                  type="button"
                  size="small"
                  icon="ph ph-door-open"
                  :label="t('clinico.hoje.chamar')"
                  @click="dia.abrirProntuario(linha.item)"
                />
                <RouterLink
                  v-else-if="linha.item.status === 'em-atendimento'"
                  class="p-button p-component p-button-secondary p-button-sm"
                  :to="dia.rotaDoProntuario(linha.item)"
                  :aria-label="t('clinico.paciente.abrirProntuario')"
                >
                  <i class="ph ph-stethoscope" aria-hidden="true" />
                  <span class="acao__rotulo">{{ t('clinico.paciente.abrirProntuario') }}</span>
                </RouterLink>
                <RouterLink
                  v-else-if="linha.item.status === 'finalizado'"
                  class="link"
                  :to="dia.rotaDoProntuario(linha.item)"
                  :aria-label="t('clinico.paciente.abrirProntuario')"
                >
                  <span class="acao__rotulo">{{ t('clinico.paciente.abrirProntuario') }}</span>
                  <i class="ph ph-arrow-right" aria-hidden="true" />
                </RouterLink>
                <RouterLink
                  v-else-if="!linha.encerrado"
                  class="link"
                  :to="dia.focoNaAgenda(linha.item.id)"
                  :aria-label="t('clinico.fila.aceite.verNaAgenda')"
                >
                  <span class="acao__rotulo">{{ t('clinico.fila.aceite.verNaAgenda') }}</span>
                  <i class="ph ph-arrow-right" aria-hidden="true" />
                </RouterLink>
              </td>
            </tr>
          </template>
        </tbody>
      </table>
    </div>

    <template #sempre>
      <Drawer
        v-model:visible="gavetaAberta"
        position="right"
        class="planilha-gaveta"
        :style="{ width: 'min(30rem, 96vw)' }"
        :header="t('inicio.pauta.titulo')"
      >
        <ul class="pendencias">
          <li v-for="linha in dia.linhasDaPauta" :key="linha.id">
            <RouterLink class="pendencias__linha" :to="linha.to" @click="gavetaAberta = false">
              <span
                class="marca"
                :class="{
                  'marca--falta': linha.tom === 'risco',
                  'marca--espera': linha.tom === 'atencao',
                  'marca--vazada': linha.tom === 'neutro',
                }"
                aria-hidden="true"
              />
              <span class="pendencias__texto">
                <span class="pendencias__gravidade">
                  {{ t(`inicio.pauta.gravidade.${linha.tom}`) }} · {{ linha.onde }}
                </span>
                <strong>{{ linha.frase }}</strong>
                <span v-if="linha.detalhe">{{ linha.detalhe }}</span>
              </span>
            </RouterLink>
          </li>
        </ul>
        <p v-if="!dia.linhasDaPauta.length" class="pendencias__calma">
          {{ t('inicio.pauta.calma') }}
        </p>
      </Drawer>
      <slot name="sempre" />
    </template>
  </UiPagina>
</template>

<!-- O fundo da área de conteúdo é da página aberta: aqui, o papel branco quente da paleta. -->
<style>
.palco__conteudo:has(.planilha) {
  background: #fffdfb;
}

.app-dark .palco__conteudo:has(.planilha) {
  background: #12161d;
}
</style>

<style scoped>
/* -------------------------------------------------------------------- tokens da planilha */

.planilha,
.planilha-gaveta {
  --pl-papel: #fffdfb;
  --pl-tinta: #1d3557;
  --pl-texto: #24324a;
  --pl-texto-2: #56607a;
  --pl-fio: #1d3557;
  --pl-regua: #e2e5eb;
  --pl-sobre: #f6f3ef;
  --pl-coral: #f28482;
  --pl-pessego: #ffb7a1;
  --pl-salvia: #84a59d;
  --pl-feito: #a3abb9;
  --pl-risco-texto: #a8322f;

  /* Instrument Sans em tudo: texto e números na mesma família. */
  --font-texto: var(--font-dados);

  /* Botões de canto quase reto: tinta cheia ou contorno de fio. */
  --p-button-border-radius: 3px;
  --p-button-label-font-weight: 600;
  --p-button-primary-background: var(--pl-tinta);
  --p-button-primary-hover-background: #142843;
  --p-button-primary-active-background: #142843;
  --p-button-primary-border-color: var(--pl-tinta);
  --p-button-primary-hover-border-color: #142843;
  --p-button-primary-active-border-color: #142843;
  --p-button-primary-color: #fff;
  --p-button-primary-hover-color: #fff;
  --p-button-primary-active-color: #fff;
  --p-button-secondary-background: transparent;
  --p-button-secondary-hover-background: var(--pl-sobre);
  --p-button-secondary-active-background: var(--pl-sobre);
  --p-button-secondary-border-color: var(--pl-tinta);
  --p-button-secondary-hover-border-color: var(--pl-tinta);
  --p-button-secondary-active-border-color: var(--pl-tinta);
  --p-button-secondary-color: var(--pl-tinta);
  --p-button-secondary-hover-color: var(--pl-tinta);
  --p-button-secondary-active-color: var(--pl-tinta);
  --p-button-text-secondary-color: var(--pl-tinta);
  --p-button-text-secondary-hover-background: var(--pl-sobre);

  color: var(--pl-texto);
  font-family: var(--font-dados);
}

.app-dark .planilha,
.app-dark .planilha-gaveta {
  --pl-papel: #12161d;
  --pl-tinta: #c9d6ea;
  --pl-texto: #dfe5ee;
  --pl-texto-2: #9aa5b7;
  --pl-fio: #9db4d8;
  --pl-regua: #262d38;
  --pl-sobre: #1a2029;
  --pl-feito: #6b7587;
  --pl-risco-texto: #f4a09d;
  --p-button-primary-hover-background: #b4c5df;
  --p-button-primary-active-background: #b4c5df;
  --p-button-primary-hover-border-color: #b4c5df;
  --p-button-primary-color: #12161d;
  --p-button-primary-hover-color: #12161d;
  --p-button-primary-active-color: #12161d;
}

.planilha .p-button,
.planilha-gaveta .p-button {
  min-height: 38px;
  background-image: none !important;
  box-shadow: none !important;
}

.planilha .p-button.p-button-sm {
  min-height: 32px;
}

.planilha .p-button:not(:disabled):active {
  transform: none;
}

/* ------------------------------------------------------------------------------ manchete */

.manchete {
  display: grid;
  min-width: 0;
  flex: 1;
  align-items: end;
  gap: 12px 36px;
  grid-template-columns: auto minmax(0, 1fr) auto;
  padding-bottom: 22px;
  border-bottom: 3px solid var(--pl-fio);
}

.manchete__data {
  display: flex;
  align-items: flex-end;
  gap: 12px;
  margin: 0;
  color: var(--pl-tinta);
}

.manchete__dia {
  font-size: 84px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  letter-spacing: -0.05em;
  line-height: 0.82;
}

.manchete__extenso {
  display: grid;
  padding-bottom: 2px;
  font-size: 15px;
  font-weight: 600;
  line-height: 1.25;
}

.manchete__frase {
  display: grid;
  min-width: 0;
  gap: 6px;
  padding-left: 36px;
  border-left: 1px solid var(--pl-regua);
}

.manchete__frase h1 {
  margin: 0;
  color: var(--pl-tinta);
  font-size: 30px;
  font-weight: 650;
  letter-spacing: -0.03em;
  line-height: 1.1;
  text-wrap: balance;
}

.manchete__frase p {
  margin: 0;
  color: var(--pl-texto-2);
  font-size: 15px;
}

.manchete__acoes {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

/* -------------------------------------------------------------------------------- folha */

.folha {
  display: grid;
  gap: 28px;
  padding-bottom: 72px;
  container: folha / inline-size;
}

/* O placar: algarismos grandes, separados por fio vertical, sem caixa. */
.placar {
  display: grid;
  margin: 0;
  padding: 0;
  border-bottom: 1px solid var(--pl-regua);
  grid-template-columns: repeat(4, minmax(0, 1fr));
  list-style: none;
}

.placar li + li {
  border-left: 1px solid var(--pl-regua);
}

.placar__item {
  display: grid;
  gap: 4px;
  padding: 4px 24px 20px;
  color: var(--pl-tinta);
  text-decoration: none;
}

.placar li:first-child .placar__item {
  padding-left: 0;
}

.placar__item:hover .placar__rotulo {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.placar__item:focus-visible {
  outline: 2px solid var(--pl-fio);
  outline-offset: -2px;
}

.placar__valor {
  font-size: 44px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  letter-spacing: -0.04em;
  line-height: 1;
}

.placar__rotulo {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--pl-texto-2);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* O quadradinho de estado. Forma e cor mudam juntas; a palavra está sempre do lado. */
.marca {
  display: inline-block;
  width: 9px;
  height: 9px;
  flex: none;
  border: 1.5px solid var(--pl-tinta);
  background: transparent;
}

.marca--cheia {
  background: var(--pl-tinta);
}

.marca--espera {
  border-color: #e0895f;
  background: var(--pl-pessego);
}

.marca--confirmado {
  border-color: var(--pl-salvia);
  background: var(--pl-salvia);
}

.marca--feito {
  border-color: var(--pl-feito);
  background: var(--pl-feito);
}

.marca--falta {
  border-color: #d9605d;
  background: var(--pl-coral);
}

/* Urgentes: o rótulo em versalete, as frases separadas por fio vertical. */
.urgentes {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 8px 20px;
}

.urgentes__rotulo {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  margin: 0;
  color: var(--pl-risco-texto);
  font-size: 12px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.urgentes ul {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.urgentes li + li {
  margin-left: 18px;
  padding-left: 18px;
  border-left: 1px solid var(--pl-regua);
}

.urgentes a {
  color: var(--pl-texto);
  font-size: 14.5px;
  text-decoration: none;
}

.urgentes a strong {
  color: var(--pl-tinta);
  font-weight: 650;
}

.urgentes a span {
  margin-left: 6px;
  color: var(--pl-texto-2);
}

.urgentes a:hover strong {
  text-decoration: underline;
  text-underline-offset: 3px;
}

/* -------------------------------------------------------------------------------- tabela */

.tabela {
  width: 100%;
  border-collapse: collapse;
  border-top: 3px solid var(--pl-fio);
  font-size: 14px;
}

.tabela th {
  position: sticky;
  z-index: 1;
  top: 0;
  height: 40px;
  padding: 0 14px;
  border-bottom: 1px solid var(--pl-fio);
  background: var(--pl-papel);
  color: var(--pl-texto-2);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
}

.tabela th:first-child,
.tabela td:first-child {
  padding-left: 0;
}

.tabela td {
  height: 58px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--pl-regua);
  vertical-align: middle;
}

.tabela tbody tr:hover td {
  background: var(--pl-sobre);
}

.col-hora {
  width: 88px;
}

td.col-hora {
  color: var(--pl-tinta);
  font-size: 21px;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  letter-spacing: -0.02em;
}

td.col-sala {
  color: var(--pl-texto-2);
  white-space: nowrap;
}

.col-acao {
  width: 1%;
  text-align: right;
  white-space: nowrap;
}

.paciente {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

.paciente__texto,
.atendimento {
  display: grid;
  min-width: 0;
  gap: 1px;
}

.paciente__texto strong {
  color: var(--pl-tinta);
  font-size: 15px;
  font-weight: 650;
}

.paciente__texto small,
.atendimento small {
  color: var(--pl-texto-2);
  font-size: 12.5px;
}

.paciente__texto .alerta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--pl-texto);
  font-weight: 600;
}

.situacao {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  color: var(--pl-texto);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
}

/* Quem está na clínica agora: a linha um tom acima do papel. */
.tabela__linha--em-atendimento td,
.tabela__linha--aguardando td {
  background: var(--pl-sobre);
}

.tabela__linha--encerrada td {
  height: 46px;
  color: var(--pl-texto-2);
}

.tabela__linha--encerrada td.col-hora {
  color: var(--pl-texto-2);
  font-size: 16px;
}

.tabela__linha--encerrada .paciente__texto strong {
  color: var(--pl-texto-2);
}

.tabela__encerrados td {
  height: 44px;
  padding-left: 0;
}

.tabela__encerrados .p-button {
  margin-left: -8px;
}

/* A marca do agora: fio grosso de ponta a ponta, a hora num bloco de tinta. */
.tabela .tabela__agora td {
  position: relative;
  height: 30px;
  padding: 0;
  border-bottom: 0;
  background: transparent;
}

.tabela__agora td::before {
  position: absolute;
  top: 50%;
  right: 0;
  left: 0;
  height: 3px;
  margin-top: -1.5px;
  background: var(--pl-fio);
  content: '';
}

.tabela__agora span {
  position: relative;
  display: inline-block;
  padding: 3px 10px;
  background: var(--pl-fio);
  color: var(--pl-papel);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.tabela__vazio td {
  height: 64px;
  color: var(--pl-texto-2);
}

.link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--pl-tinta);
  font-size: 13.5px;
  font-weight: 650;
  text-decoration: underline;
  text-decoration-thickness: 1px;
  text-underline-offset: 4px;
}

.link:focus-visible {
  outline: 2px solid var(--pl-fio);
  outline-offset: 2px;
}

.so-leitor {
  position: absolute;
  overflow: hidden;
  width: 1px;
  height: 1px;
  clip-path: inset(50%);
  white-space: nowrap;
}

/* ------------------------------------------------------------------------ gaveta */

.pendencias {
  display: grid;
  margin: 0;
  padding: 0;
  border-top: 3px solid var(--pl-fio);
  list-style: none;
}

.pendencias li {
  border-bottom: 1px solid var(--pl-regua);
}

.pendencias__linha {
  display: flex;
  align-items: baseline;
  gap: 12px;
  padding: 14px 4px;
  color: var(--pl-texto);
  text-decoration: none;
}

.pendencias__linha:hover strong {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.pendencias__texto {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.pendencias__gravidade {
  color: var(--pl-texto-2);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.pendencias__texto strong {
  color: var(--pl-tinta);
  font-size: 15px;
  font-weight: 650;
}

.pendencias__texto > span:last-child:not(.pendencias__gravidade) {
  color: var(--pl-texto-2);
  font-size: 13px;
}

.pendencias__calma {
  color: var(--pl-texto-2);
}

/* ------------------------------------------------------------------------ estreito */

@media (max-width: 1280px) {
  .manchete {
    grid-template-columns: auto minmax(0, 1fr);
  }

  .manchete__acoes {
    justify-content: flex-start;
    grid-column: 1 / -1;
  }
}

@container folha (max-width: 880px) {
  .col-sala {
    display: none;
  }

  .placar__valor {
    font-size: 34px;
  }

  .placar__item {
    padding-inline: 14px;
  }
}

/* Tablet: o atendimento sai, as ações secundárias viram ícone; "Iniciar consulta" fica escrito. */
@container folha (max-width: 760px) {
  .col-atendimento {
    display: none;
  }

  .tabela th,
  .tabela td {
    padding-inline: 10px;
  }

  .col-hora {
    width: 62px;
  }

  td.col-hora {
    font-size: 17px;
  }

  .situacao {
    white-space: normal;
  }

  .acao__rotulo {
    display: none;
  }

  .col-acao a.p-button {
    gap: 0;
  }
}
</style>
