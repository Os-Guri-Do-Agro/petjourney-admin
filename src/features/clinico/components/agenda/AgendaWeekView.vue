<script setup lang="ts">
/**
 * Visão de semana: a carga da equipe, dia a dia.
 *
 * Uma tabela numa folha só — dias nas colunas, profissionais nas linhas. A pergunta do balcão ("a
 * Helena tem alguma coisa de manhã na quinta?") se responde cruzando uma linha com uma coluna.
 *
 * - **A ocupação aparece como número, além da barra.** Barra sozinha some em escala de cinza.
 * - **Manhã e tarde em duas barrinhas**, porque ninguém pergunta pelo dia inteiro.
 * - **Clicar no dia leva para a grade daquele dia** — a rota mais curta entre "a quinta está
 *   vazia" e "marquei na quinta". Qualquer célula do dia faz isso.
 * - **Dia fechado fica apagado**, com a palavra: a coluna existe, mas não pede atenção.
 *
 * A cor é de estado e mora no número e na barra: folgado no azul da Clínica, cheio em âmbar,
 * além da capacidade em vermelho.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useClinicFormat } from '../../composables/useClinicFormat'
import { faixaDeOcupacao } from '../../domain/load'
import { useAgendaStore } from '../../stores/agenda'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const emit = defineEmits<{ escolherDia: [data: string] }>()

const { t } = useI18n()
const agenda = useAgendaStore()
const clinico = useClinicoStore()
const formato = useClinicFormat()

function comInicial(texto: string) {
  return texto.charAt(0).toLocaleUpperCase() + texto.slice(1)
}

const dias = computed(() =>
  agenda.semanaDias.map((dia) => ({
    ...dia,
    faixa: faixaDeOcupacao(dia.ocupacao),
    ehHoje: dia.data === clinicClock.today(),
    fechado: dia.capacidadeMinutos === 0,
    semana: comInicial(formato.diaDaSemanaCurto(dia.data)),
  })),
)

/** Os profissionais que aparecem na semana, na ordem do cadastro (a mesma das colunas do dia). */
const pessoas = computed(() => {
  const presentes = new Set(
    dias.value.flatMap((dia) => dia.porProfissional.map((pessoa) => pessoa.professionalId)),
  )

  return clinico.profissionais.filter((pessoa) => presentes.has(pessoa.id))
})

type Dia = (typeof dias.value)[number]

function cargaDe(dia: Dia, professionalId: string) {
  return dia.porProfissional.find((pessoa) => pessoa.professionalId === professionalId) ?? null
}

/** As iniciais de quem atende: primeiro e último nome, como no cabeçalho da grade do dia. */
function iniciais(nome: string) {
  const partes = nome.trim().split(/\s+/).filter(Boolean)
  const primeira = partes[0]?.charAt(0) ?? ''
  const ultima = partes.length > 1 ? (partes.at(-1)?.charAt(0) ?? '') : ''

  return `${primeira}${ultima}`.toLocaleUpperCase()
}

function rotuloDoDia(dia: Dia) {
  return `${formato.diaDaSemanaCurto(dia.data)} ${formato.dataCurta(dia.data)}`
}
</script>

<template>
  <section class="semana ui-folha clinic-scope" :aria-label="t('clinico.agenda.semana.titulo')">
    <div class="semana__rolagem">
      <table class="semana__tabela">
        <thead>
          <tr>
            <th scope="col" class="semana__canto">
              <span class="semana__nota">
                <span class="semana__amostra" aria-hidden="true"><span /><span /></span>
                {{ t('clinico.agenda.semana.legendaBarras') }}
              </span>
            </th>
            <th
              v-for="dia in dias"
              :key="dia.data"
              scope="col"
              class="semana__cabeca"
              :class="{ 'semana__col--hoje': dia.ehHoje, 'semana__col--fechado': dia.fechado }"
            >
              <button
                type="button"
                class="semana__dia"
                :aria-label="t('clinico.agenda.semana.abrirDia', { dia: rotuloDoDia(dia) })"
                @click="emit('escolherDia', dia.data)"
              >
                <span class="semana__dia-nome">{{ dia.semana }}</span>
                <span class="semana__dia-data ui-num">{{ formato.dataCurta(dia.data) }}</span>
              </button>
            </th>
          </tr>
        </thead>

        <tbody>
          <!-- A clínica inteira primeiro: o agregado, com agendados e faltas do dia. -->
          <tr class="semana__clinica">
            <th scope="row">{{ t('clinico.agenda.semana.clinica') }}</th>
            <td
              v-for="dia in dias"
              :key="dia.data"
              :class="{ 'semana__col--hoje': dia.ehHoje, 'semana__col--fechado': dia.fechado }"
            >
              <span v-if="dia.fechado" class="semana__fechado">
                <i class="ph ph-moon" aria-hidden="true" />
                {{ t('clinico.agenda.semana.fechada') }}
              </span>
              <button
                v-else
                type="button"
                class="semana__celula"
                :aria-label="t('clinico.agenda.semana.abrirDia', { dia: rotuloDoDia(dia) })"
                @click="emit('escolherDia', dia.data)"
              >
                <span class="semana__pct ui-num" :class="`semana__pct--${dia.faixa}`">
                  {{ formato.percentual(dia.ocupacao) }}
                </span>
                <span class="semana__barra" :class="`semana__barra--${dia.faixa}`" aria-hidden="true">
                  <span :style="{ inlineSize: `${Math.min(dia.ocupacao, 1) * 100}%` }" />
                </span>
              </button>
            </td>
          </tr>

          <!--
            Agendados e faltas numa linha cada, só com o número: o título da linha já diz o que o
            número é, e a palavra em toda célula não cabia na coluna do tablet.
          -->
          <tr class="semana__contagem">
            <th scope="row">{{ t('clinico.agenda.semana.linhaAgendados') }}</th>
            <td
              v-for="dia in dias"
              :key="dia.data"
              :class="{ 'semana__col--hoje': dia.ehHoje, 'semana__col--fechado': dia.fechado }"
            >
              <span class="semana__numero ui-num">{{ dia.fechado ? '–' : dia.agendados }}</span>
            </td>
          </tr>

          <tr class="semana__contagem semana__contagem--ultima">
            <th scope="row">{{ t('clinico.agenda.semana.linhaFaltas') }}</th>
            <td
              v-for="dia in dias"
              :key="dia.data"
              :class="{ 'semana__col--hoje': dia.ehHoje, 'semana__col--fechado': dia.fechado }"
            >
              <span
                class="semana__numero ui-num"
                :class="{ 'semana__numero--faltas': dia.faltas > 0 }"
              >
                {{ dia.faltas > 0 ? dia.faltas : '–' }}
              </span>
            </td>
          </tr>

          <tr v-for="pessoa in pessoas" :key="pessoa.id" class="semana__pessoa-linha">
            <th scope="row">
              <span class="semana__pessoa">
                <!-- O mesmo monograma do cabeçalho da coluna no dia: liga as duas visões. -->
                <span
                  class="semana__monograma"
                  :style="{ '--coluna-cor': clinico.corDaColuna(pessoa.id) }"
                  aria-hidden="true"
                >
                  {{ iniciais(pessoa.nome) }}
                </span>
                <span class="semana__nome" :title="pessoa.nome">{{ pessoa.nome }}</span>
              </span>
            </th>
            <td
              v-for="dia in dias"
              :key="dia.data"
              :class="{ 'semana__col--hoje': dia.ehHoje, 'semana__col--fechado': dia.fechado }"
            >
              <button
                v-if="!dia.fechado && cargaDe(dia, pessoa.id)"
                type="button"
                class="semana__celula"
                :aria-label="
                  t('clinico.agenda.semana.detalhePessoa', {
                    nome: pessoa.nome,
                    manha: formato.percentual(cargaDe(dia, pessoa.id)!.ocupacaoManha),
                    tarde: formato.percentual(cargaDe(dia, pessoa.id)!.ocupacaoTarde),
                  })
                "
                @click="emit('escolherDia', dia.data)"
              >
                <span
                  class="semana__pct ui-num"
                  :class="`semana__pct--${faixaDeOcupacao(cargaDe(dia, pessoa.id)!.ocupacao)}`"
                >
                  {{ formato.percentual(cargaDe(dia, pessoa.id)!.ocupacao) }}
                </span>
                <span class="semana__periodos" aria-hidden="true">
                  <span
                    v-for="(periodo, indice) in [
                      cargaDe(dia, pessoa.id)!.ocupacaoManha,
                      cargaDe(dia, pessoa.id)!.ocupacaoTarde,
                    ]"
                    :key="indice"
                    class="semana__barra"
                    :class="`semana__barra--${faixaDeOcupacao(periodo)}`"
                  >
                    <span :style="{ inlineSize: `${Math.min(periodo, 1) * 100}%` }" />
                  </span>
                </span>
              </button>
              <span v-else class="semana__vazio" aria-hidden="true">–</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.semana {
  overflow: hidden;
}

/* No tablet em pé, a tabela rola dentro da folha em vez de espremer os dias. */
.semana__rolagem {
  overflow-x: auto;
}

.semana__tabela {
  width: 100%;
  min-width: 46rem;
  border-collapse: separate;
  border-spacing: 0;
  table-layout: fixed;
}

.semana__tabela th,
.semana__tabela td {
  padding: 0;
  border-bottom: 1px solid var(--linha-suave);
  text-align: start;
  vertical-align: middle;
}

/* O cabeçalho dos dias num poço, como o da grade do dia: o papel fica para os números. */
.semana__tabela thead th {
  border-bottom-color: var(--linha);
  background: color-mix(in oklab, var(--superficie-2) 75%, var(--superficie));
}

.semana__tabela thead th:first-child {
  background: color-mix(in oklab, var(--superficie-2) 75%, var(--superficie));
}

.semana__tabela tbody tr:last-child th,
.semana__tabela tbody tr:last-child td {
  border-bottom: 0;
}

/* A primeira coluna fica presa quando a tabela rola de lado: a linha nunca perde o nome. */
.semana__tabela th:first-child {
  position: sticky;
  left: 0;
  z-index: 1;
  background: var(--superficie);
}

.semana__canto {
  width: 13rem;
  padding: 12px 16px !important;
}

.semana__nota {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.semana__amostra {
  display: inline-grid;
  width: 30px;
  gap: 3px;
  grid-template-columns: 1fr 1fr;
}

.semana__amostra span {
  height: 5px;
  border-radius: 999px;
  background: var(--clinica);
}

/* --------------------------------------------------------------------------- dias */

/* O cabeçalho do dia é o atalho para a grade daquele dia. */
.semana__dia {
  display: grid;
  width: 100%;
  min-height: 60px;
  align-content: center;
  gap: 1px;
  padding: 10px 14px;
  border: 0;
  background: transparent;
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  text-align: start;
}

.semana__dia:hover {
  background: var(--superficie-2);
}

.semana__dia-nome {
  color: var(--tinta-2);
  font-size: 12.5px;
  font-weight: 550;
}

.semana__dia-data {
  font-size: 17px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

/* Hoje: a coluna num fundo bem claro da Clínica, e o dia na tinta dela. */
.semana__col--hoje,
.semana__tabela thead th.semana__col--hoje {
  background: color-mix(in oklab, var(--clinica-fundo) 60%, var(--superficie));
}

.semana__col--hoje .semana__dia-nome,
.semana__col--hoje .semana__dia-data {
  color: var(--clinica-tinta);
}

.semana__cabeca.semana__col--hoje {
  box-shadow: inset 0 3px 0 var(--clinica);
}

/* Dia fechado: apagado, com a palavra, sem pedir atenção. */
.semana__col--fechado,
.semana__tabela thead th.semana__col--fechado {
  background: var(--superficie-2);
}

.semana__col--fechado .semana__dia-nome,
.semana__col--fechado .semana__dia-data {
  color: var(--tinta-3);
}

/* ------------------------------------------------------------------------- linhas */

.semana__tabela tbody th {
  padding: 0 16px;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.semana__clinica th,
.semana__clinica td {
  height: 68px;
}

.semana__clinica th {
  font-size: 15px;
  font-weight: 650;
}

.semana__contagem th,
.semana__contagem td {
  height: 42px;
}

.semana__contagem th {
  color: var(--tinta-2);
  font-size: 13.5px;
  font-weight: 500;
}

/* As três linhas da clínica formam um bloco; o fio mais forte o separa da equipe. */
.semana__contagem--ultima th,
.semana__contagem--ultima td {
  border-bottom-color: var(--linha-media);
}

.semana__pessoa-linha th,
.semana__pessoa-linha td {
  height: 62px;
}

.semana__numero {
  display: block;
  padding: 0 14px;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 600;
}

.semana__numero--faltas {
  color: var(--risco-tinta);
}

.semana__col--fechado .semana__numero {
  color: var(--tinta-3);
}

.semana__pessoa {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 10px;
}

/* A cor do profissional é a mesma da coluna dele no dia: liga as duas visões. */
.semana__monograma {
  display: inline-grid;
  width: 30px;
  height: 30px;
  flex: none;
  place-items: center;
  border-radius: 50%;
  background: color-mix(in oklab, var(--coluna-cor) 32%, var(--superficie));
  box-shadow: inset 0 0 0 1px color-mix(in oklab, var(--coluna-cor) 50%, transparent);
  color: color-mix(in oklab, var(--coluna-cor) 30%, var(--tinta));
  font-family: var(--font-dados);
  font-size: 11.5px;
  font-weight: 700;
  letter-spacing: 0.02em;
}

.semana__nome {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ------------------------------------------------------------------------- células */

.semana__celula {
  display: grid;
  width: 100%;
  height: 100%;
  min-height: 44px;
  align-content: center;
  justify-items: start;
  gap: 6px;
  padding: 8px 14px;
  border: 0;
  background: transparent;
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  text-align: start;
}

.semana__celula:hover {
  background: color-mix(in oklab, var(--clinica-fundo) 60%, transparent);
}

.semana__celula:focus-visible,
.semana__dia:focus-visible {
  outline: 2px solid var(--clinica);
  outline-offset: -2px;
}

.semana__pct {
  font-size: 14px;
  font-weight: 650;
  line-height: 1.1;
}

.semana__clinica .semana__pct {
  font-size: 17px;
}

.semana__pct--vazio {
  color: var(--tinta-3);
  font-weight: 500;
}

.semana__pct--cheio {
  color: var(--atencao-tinta);
}

.semana__pct--excedido {
  color: var(--risco-tinta);
}

.semana__fechado {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 0 14px;
  color: var(--tinta-3);
  font-size: 13.5px;
}

.semana__vazio {
  display: block;
  padding: 0 14px;
  color: var(--tinta-3);
}

/* Manhã e tarde: duas barrinhas lado a lado, cada uma com o próprio trilho. */
.semana__periodos {
  display: grid;
  width: 100%;
  max-width: 6rem;
  gap: 4px;
  grid-template-columns: 1fr 1fr;
}

.semana__barra {
  display: block;
  width: 100%;
  max-width: 6rem;
  height: 5px;
  overflow: hidden;
  border-radius: 999px;
  background: var(--superficie-3);
}

.semana__barra > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--clinica);
}

.semana__barra--cheio > span {
  background: var(--atencao);
}

.semana__barra--excedido > span {
  background: var(--risco);
}

/* No celular a coluna dos nomes cede espaço aos dias, que rolam de lado. */
@media (max-width: 720px) {
  .semana__canto {
    width: 9.5rem;
  }

  .semana__tabela tbody th {
    padding-inline: 12px;
  }
}
</style>
