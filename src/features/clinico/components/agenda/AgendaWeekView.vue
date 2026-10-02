<script setup lang="ts">
/**
 * Visão de semana: quem tem horário, e quando.
 *
 * Uma tabela num cartão só — profissionais nas linhas, dias nas colunas — no lugar dos sete
 * cartões com iniciais coloridas. Nos cartões, "AR 38%" pedia para lembrar quem era AR, e a
 * pergunta do balcão ("a Helena tem alguma coisa de manhã na quinta?") obrigava a correr os olhos
 * por sete cartões atrás da mesma sigla. Na tabela, a linha é a pessoa e a coluna é o dia.
 *
 * Três escolhas que ficaram de antes, porque são de leitura:
 *
 * - **A ocupação aparece como número, além da barra.** Barra sozinha some em escala de cinza.
 * - **Manhã e tarde em duas barrinhas**, porque ninguém pergunta pelo dia inteiro.
 * - **Clicar no dia leva para a grade daquele dia** — a rota mais curta entre "a quinta está
 *   vazia" e "marquei na quinta". Aqui, qualquer célula do dia faz isso.
 *
 * A cor é de estado e mora no número e na barra: cheio em pêssego, além da capacidade em coral.
 */
import Button from 'primevue/button'
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

const dias = computed(() =>
  agenda.semanaDias.map((dia) => ({
    ...dia,
    faixa: faixaDeOcupacao(dia.ocupacao),
    ehHoje: dia.data === clinicClock.today(),
    fechado: dia.capacidadeMinutos === 0,
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

function rotuloDoDia(dia: Dia) {
  return `${formato.diaDaSemanaCurto(dia.data)} ${formato.dataCurta(dia.data)}`
}
</script>

<template>
  <section class="hc semana" :aria-label="t('clinico.agenda.semana.titulo')">
    <div class="semana__rolagem">
      <table class="semana__tabela">
        <thead>
          <tr>
            <th scope="col" class="semana__canto">
              <span class="semana__nota">
                <span class="semana__amostra" aria-hidden="true"> <span /><span /> </span>
                {{ t('clinico.agenda.semana.legendaBarras') }}
              </span>
            </th>
            <th
              v-for="dia in dias"
              :key="dia.data"
              scope="col"
              :class="{ 'semana__col--hoje': dia.ehHoje, 'semana__col--fechado': dia.fechado }"
            >
              <Button
                type="button"
                class="semana__dia"
                severity="secondary"
                text
                :aria-label="t('clinico.agenda.semana.abrirDia', { dia: rotuloDoDia(dia) })"
                @click="emit('escolherDia', dia.data)"
              >
                <span class="semana__dia-nome">{{ formato.diaDaSemanaCurto(dia.data) }}</span>
                <span class="semana__dia-data">{{ formato.dataCurta(dia.data) }}</span>
              </Button>
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
                {{ t('clinico.agenda.semana.fechada') }}
              </span>
              <Button
                v-else
                type="button"
                class="semana__celula"
                severity="secondary"
                text
                :aria-label="t('clinico.agenda.semana.abrirDia', { dia: rotuloDoDia(dia) })"
                @click="emit('escolherDia', dia.data)"
              >
                <span class="semana__pct" :class="`semana__pct--${dia.faixa}`">
                  {{ formato.percentual(dia.ocupacao) }}
                </span>
              </Button>
            </td>
          </tr>

          <!--
            Agendados e faltas numa linha cada, só com o número: a palavra em toda célula não cabia
            na coluna do tablet ("agendado:" cortado), e o título da linha já diz o que o número é.
          -->
          <tr class="semana__contagem">
            <th scope="row">{{ t('clinico.agenda.semana.linhaAgendados') }}</th>
            <td
              v-for="dia in dias"
              :key="dia.data"
              :class="{ 'semana__col--hoje': dia.ehHoje, 'semana__col--fechado': dia.fechado }"
            >
              <span class="semana__numero">{{ dia.fechado ? '—' : dia.agendados }}</span>
            </td>
          </tr>

          <tr class="semana__contagem semana__contagem--ultima">
            <th scope="row">{{ t('clinico.agenda.semana.linhaFaltas') }}</th>
            <td
              v-for="dia in dias"
              :key="dia.data"
              :class="{ 'semana__col--hoje': dia.ehHoje, 'semana__col--fechado': dia.fechado }"
            >
              <span class="semana__numero" :class="{ 'semana__numero--faltas': dia.faltas > 0 }">
                {{ dia.faltas > 0 ? dia.faltas : '—' }}
              </span>
            </td>
          </tr>

          <tr v-for="pessoa in pessoas" :key="pessoa.id">
            <th scope="row">
              <span class="semana__pessoa">
                <span
                  class="semana__cor"
                  :style="{ background: clinico.corDaColuna(pessoa.id) }"
                  aria-hidden="true"
                />
                <span class="semana__nome">{{ pessoa.nome }}</span>
              </span>
            </th>
            <td
              v-for="dia in dias"
              :key="dia.data"
              :class="{ 'semana__col--hoje': dia.ehHoje, 'semana__col--fechado': dia.fechado }"
            >
              <template v-if="!dia.fechado && cargaDe(dia, pessoa.id)">
                <Button
                  type="button"
                  class="semana__celula"
                  severity="secondary"
                  text
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
                    class="semana__pct"
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
                      class="semana__periodo"
                      :class="`semana__periodo--${faixaDeOcupacao(periodo)}`"
                    >
                      <span :style="{ inlineSize: `${Math.min(periodo, 1) * 100}%` }" />
                    </span>
                  </span>
                </Button>
              </template>
              <span v-else class="semana__vazio" aria-hidden="true">—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
</template>

<style scoped>
.semana {
  padding: 0.75rem 0.9rem 0.9rem;
}

/* No tablet em pé, a tabela rola dentro do cartão em vez de espremer os dias. */
.semana__rolagem {
  overflow-x: auto;
}

.semana__tabela {
  width: 100%;
  min-width: 38rem;
  border-collapse: collapse;
  table-layout: fixed;
  font-variant-numeric: tabular-nums;
}

.semana__tabela th,
.semana__tabela td {
  padding: 0;
  border-bottom: 1px solid var(--hc-linha);
  text-align: start;
  vertical-align: middle;
}

.semana__tabela tbody tr:last-child th,
.semana__tabela tbody tr:last-child td {
  border-bottom: 0;
}

.semana__canto {
  width: 11rem;
  padding: 0.4rem 0.5rem 0.6rem 0;
}

.semana__nota {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  color: var(--hc-tinta-3);
  font-size: 0.75rem;
  font-weight: 500;
}

.semana__amostra {
  display: inline-flex;
  gap: 2px;
}

.semana__amostra span {
  width: 0.9rem;
  height: 0.3rem;
  border-radius: 999px;
  background: var(--hc-marca);
}

/* O cabeçalho do dia é o atalho para a grade daquele dia. */
.semana__dia.p-button {
  display: grid;
  justify-content: start;
  justify-items: start;
  gap: 0;
  width: 100%;
  padding: 0.35rem 0.6rem 0.55rem;
  border-radius: 0.6rem;
  color: var(--hc-tinta);
  text-align: start;
}

.semana__dia-nome {
  color: var(--hc-tinta-2);
  font-size: 0.75rem;
  font-weight: 650;
}

.semana__dia-nome::first-letter {
  text-transform: uppercase;
}

.semana__dia-data {
  font-size: 0.9375rem;
  font-weight: 700;
}

/* Hoje: a coluna inteira num fundo de marca bem claro, e a data na tinta da marca. */
.semana__col--hoje {
  background: color-mix(in srgb, var(--hc-marca-clara) 40%, transparent);
}

.semana__col--hoje .semana__dia-data,
.semana__col--hoje .semana__dia-nome {
  color: var(--hc-marca-forte);
}

.semana__col--fechado {
  background: color-mix(in srgb, var(--hc-linha) 60%, transparent);
}

.semana__tabela tbody th {
  padding: 0.55rem 0.75rem 0.55rem 0;
  color: var(--hc-tinta);
  font-size: 0.875rem;
  font-weight: 600;
}

/* As três linhas da clínica formam um bloco; a borda mais forte o separa das pessoas. */
.semana__contagem--ultima th,
.semana__contagem--ultima td {
  border-bottom-color: var(--hc-borda);
}

.semana__contagem th {
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
  font-weight: 500;
}

.semana__numero {
  display: block;
  padding: 0.4rem 0.6rem;
  color: var(--hc-tinta);
  font-size: 0.875rem;
  font-weight: 600;
}

.semana__numero--faltas {
  color: var(--hc-coral-tinta);
}

.semana__pessoa {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  min-width: 0;
}

/* A cor do profissional é a mesma da coluna dele na grade do dia: liga as duas visões. */
.semana__cor {
  flex-shrink: 0;
  width: 0.55rem;
  height: 0.55rem;
  border-radius: 999px;
}

.semana__nome {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.semana__celula.p-button {
  display: grid;
  justify-content: stretch;
  justify-items: start;
  gap: 0.25rem;
  width: 100%;
  padding: 0.5rem 0.6rem;
  border-radius: 0.6rem;
  color: var(--hc-tinta);
  font-weight: inherit;
  text-align: start;
}

.semana__celula.p-button:not(:disabled):hover {
  background: color-mix(in srgb, var(--hc-marca-clara) 55%, transparent);
}

.semana__pct {
  font-size: 0.875rem;
  font-weight: 700;
}

.semana__clinica .semana__pct {
  font-size: 1rem;
}

.semana__pct--vazio {
  color: var(--hc-tinta-3);
  font-weight: 500;
}

.semana__pct--cheio {
  color: var(--hc-pessego-tinta);
}

.semana__pct--excedido {
  color: var(--hc-coral-tinta);
}

.semana__meta {
  color: var(--hc-tinta-2);
  font-size: 0.75rem;
}

.semana__meta--faltas {
  color: var(--hc-coral-tinta);
  font-weight: 600;
}

.semana__fechado {
  display: block;
  padding: 0.5rem 0.6rem;
  color: var(--hc-tinta-3);
  font-size: 0.8125rem;
}

.semana__vazio {
  display: block;
  padding: 0.5rem 0.6rem;
  color: var(--hc-tinta-3);
}

/* Manhã e tarde: duas barrinhas lado a lado, cada uma com o próprio trilho. */
.semana__periodos {
  display: grid;
  gap: 3px;
  grid-template-columns: 1fr 1fr;
  width: 100%;
  max-width: 5.5rem;
}

.semana__periodo {
  display: block;
  height: 0.3rem;
  overflow: hidden;
  border-radius: 999px;
  background: var(--hc-linha);
}

.semana__periodo > span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: var(--hc-marca);
}

.semana__periodo--cheio > span {
  background: var(--hc-pessego-tinta);
}

.semana__periodo--excedido > span {
  background: var(--hc-coral-tinta);
}
</style>
