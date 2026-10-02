<script setup lang="ts">
/**
 * O que o paciente recebeu, e quando.
 *
 * A pergunta que esta lista responde é feita duas vezes por dia numa clínica e não tinha tela:
 * *este animal já tomou isso?* Antes, a resposta estava partida em três lugares que nunca se
 * encontravam — a carteira de vacinas, o checklist da internação e a receita da consulta, que
 * nem execução é: é ordem. Quem precisava juntar, juntava de cabeça.
 *
 * Três decisões que a lista toma e uma tabela genérica não tomaria:
 *
 * - **A origem aparece em cada linha.** "Dipirona há 14 dias" muda de peso conforme tenha sido
 *   aplicada na veia aqui, dada pela enfermagem no leito, ou contada pelo responsável. Sem a
 *   origem, as três viram a mesma frase.
 * - **O que a clínica não presenciou é dito.** Ato `avulso` não tem profissional, e o lugar de
 *   "quem" não fica em branco: ele diz *relatado*. Campo vazio parece dado que faltou carregar;
 *   a palavra é a informação.
 * - **O filtro é por natureza do ato, não por origem.** Quem procura medicamento não quer
 *   vacina e curativo no meio — e quem procura vacina tem a carteira, que diz muito mais.
 *
 * Mora na coluna estreita do histórico, ao lado da lista do que aconteceu. Por isso é lista de
 * linhas, e não tabela: quatro colunas em 20 rem cortavam o cabeçalho ("O / que") e a coluna de
 * quem executou sumia pela borda.
 */
import Button from 'primevue/button'
import { PhFirstAidKit, PhPill, PhPlus, PhBandaids } from '@phosphor-icons/vue'
import Skeleton from 'primevue/skeleton'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import type { AtoClinico, AtoClinicoKind, OrigemDoAto } from '../../data/types'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  atos: AtoClinico[]
  carregando: boolean
}>()

const emit = defineEmits<{
  registrar: []
  abrirAtendimento: [encounterId: string]
}>()

const { t } = useI18n()
const clinico = useClinicoStore()
const formato = useClinicFormat()

type Filtro = 'todos' | AtoClinicoKind

const filtro = ref<Filtro>('todos')

/** Contagem na própria ficha: antes de clicar já se sabe se vale. */
const opcoesFiltro = computed(() => {
  const contar = (kind: AtoClinicoKind) => props.atos.filter((ato) => ato.kind === kind).length

  return [
    {
      valor: 'todos' as Filtro,
      rotulo: t('clinico.paciente.atos.filtro.todos'),
      total: props.atos.length,
    },
    {
      valor: 'medicamento' as Filtro,
      rotulo: t('clinico.paciente.atos.filtro.medicamento'),
      total: contar('medicamento'),
    },
    {
      valor: 'procedimento' as Filtro,
      rotulo: t('clinico.paciente.atos.filtro.procedimento'),
      total: contar('procedimento'),
    },
  ].filter((opcao) => opcao.valor === 'todos' || opcao.total > 0)
})

const visiveis = computed(() =>
  filtro.value === 'todos' ? props.atos : props.atos.filter((ato) => ato.kind === filtro.value),
)

/** A segunda linha do ato: via e dose, quando existem. É o que distingue duas linhas iguais. */
function detalhe(ato: AtoClinico): string {
  const via = ato.via ? t(`clinico.prontuario.conduta.via_.${ato.via}`) : ''

  return [via, ato.doseTexto, ato.observacao].filter(Boolean).join(' · ')
}

function origem(valor: OrigemDoAto): string {
  return t(`clinico.paciente.atos.origem.${valor}`)
}

/**
 * A cor do selo de origem tem significado: internação e vacina são categorias da casa, e o relato
 * do responsável é ressalva (pêssego) — "alguém disse que aplicaram" não lê como "a clínica aplicou".
 */
const TOM_DA_ORIGEM: Record<OrigemDoAto, string> = {
  clinica: 'hc--cinza',
  internacao: 'hc--verde',
  vacina: 'hc--ciano',
  avulso: 'hc--pessego',
}

const anoAtual = computed(() => clinicClock.today().slice(0, 4))

/** O ano só aparece quando não é este: "18/11/2025", mas "01/10". */
function dataDoAto(ato: AtoClinico) {
  const data = clinicClock.dateOf(ato.realizadoEm)

  return data.slice(0, 4) === anoAtual.value
    ? formato.dataCurta(data)
    : formato.dataCurtaComAno(data)
}

function quem(ato: AtoClinico): string {
  return (
    clinico.profissional(ato.professionalId)?.nome ?? t('clinico.paciente.atos.semProfissional')
  )
}

function abrir(ato: AtoClinico) {
  if (ato.encounterId) {
    emit('abrirAtendimento', ato.encounterId)
  }
}
</script>

<template>
  <!--
    Um cartão da ficha do paciente, no acabamento da Visão geral: título com ícone, ajuda embaixo e
    a ação em pílula contornada. É a única tela em que ele aparece (o histórico do paciente).
  -->
  <section class="atos">
    <header class="atos__topo">
      <div class="atos__titulos">
        <h2 class="atos__titulo">
          <PhFirstAidKit class="atos__titulo-icone" weight="duotone" aria-hidden="true" />
          {{ t('clinico.paciente.atos.titulo') }}
        </h2>
        <p class="atos__ajuda">{{ t('clinico.paciente.atos.ajuda') }}</p>
      </div>

      <Button
        type="button"
        class="hc-pilula"
        :label="t('clinico.paciente.atos.registrar')"
        @click="emit('registrar')"
      >
        <template #icon>
          <PhPlus class="hc-pilula__icone" weight="bold" aria-hidden="true" />
        </template>
      </Button>
    </header>

    <div
      v-if="atos.length > 0"
      class="atos__filtro"
      role="group"
      :aria-label="t('clinico.paciente.atos.titulo')"
    >
      <Button
        v-for="opcao in opcoesFiltro"
        :key="opcao.valor"
        type="button"
        class="atos__ficha"
        :class="{ 'atos__ficha--ativa': filtro === opcao.valor }"
        severity="secondary"
        outlined
        rounded
        size="small"
        :aria-pressed="filtro === opcao.valor"
        @click="filtro = opcao.valor"
      >
        <span>{{ opcao.rotulo }}</span>
        <span class="atos__contagem">{{ opcao.total }}</span>
      </Button>
    </div>

    <div v-if="carregando && atos.length === 0" class="atos__carregando" aria-busy="true">
      <Skeleton v-for="n in 3" :key="n" height="2.6rem" border-radius="0.6rem" />
    </div>

    <div v-else-if="atos.length === 0" class="atos__vazio">
      <strong>{{ t('clinico.paciente.atos.vazioTitulo') }}</strong>
      <p>{{ t('clinico.paciente.atos.vazioDescricao') }}</p>
    </div>

    <ol v-else class="atos__lista" :aria-label="t('clinico.paciente.atos.titulo')">
      <li v-for="ato in visiveis" :key="ato.id">
        <component
          :is="ato.encounterId ? Button : 'div'"
          v-bind="ato.encounterId ? { type: 'button' } : {}"
          class="atos__linha"
          :class="{ 'atos__linha--abre': ato.encounterId }"
          @click="abrir(ato)"
        >
          <span class="atos__quando">
            <strong>{{ dataDoAto(ato) }}</strong>
            <span>{{ formato.hora(ato.realizadoEm) }}</span>
          </span>

          <span class="atos__corpo">
            <span class="atos__nome">
              <component
                :is="ato.kind === 'medicamento' ? PhPill : PhBandaids"
                class="atos__tipo"
                weight="duotone"
                :aria-label="t(`clinico.paciente.atos.kind.${ato.kind}`)"
              />
              {{ ato.descricao }}
            </span>
            <span v-if="detalhe(ato)" class="atos__meta">{{ detalhe(ato) }}</span>
            <span class="atos__origem">
              <span class="hc-selo" :class="TOM_DA_ORIGEM[ato.origem]">{{
                origem(ato.origem)
              }}</span>
              <span :class="ato.professionalId ? 'atos__quem' : 'atos__relato'">{{
                quem(ato)
              }}</span>
            </span>
          </span>
        </component>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.atos {
  display: grid;
  align-content: start;
  gap: 0.85rem;
  min-width: 0;
  padding: 1.2rem 1.35rem 1.35rem;
  border: 1px solid var(--hc-borda);
  border-radius: 1rem;
  background: var(--hc-cartao);
  box-shadow: var(--hc-sombra);
}

.atos__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.5rem;
}

.atos__titulos {
  min-width: 0;
}

.atos__titulo {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  margin: 0;
  color: var(--hc-tinta);
  font-size: 1rem;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.atos__titulo-icone {
  flex-shrink: 0;
  width: 1.2rem;
  height: 1.2rem;
  color: var(--hc-marca);
}

.atos__ajuda {
  margin: 0.2rem 0 0;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}

.atos__filtro {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.atos__ficha.p-button {
  gap: 0.35rem;
  padding: 0.3rem 0.7rem;
  font-size: 0.8125rem;
}

.atos__contagem {
  color: var(--hc-tinta-3);
  font-variant-numeric: tabular-nums;
  font-weight: 700;
}

.atos__ficha--ativa.p-button,
.atos__ficha--ativa.p-button:not(:disabled):hover {
  border-color: var(--hc-marca);
  background: var(--hc-marca-clara);
  color: var(--hc-marca-forte);
}

.atos__carregando {
  display: grid;
  gap: 0.5rem;
}

.atos__vazio {
  display: grid;
  gap: 0.25rem;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}

.atos__vazio strong {
  color: var(--hc-tinta);
  font-size: 0.875rem;
}

.atos__vazio p {
  margin: 0;
}

.atos__lista {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.atos__lista > li + li {
  border-top: 1px solid var(--hc-linha);
}

.atos__linha {
  display: grid;
  align-items: start;
  gap: 0.75rem;
  grid-template-columns: 3.4rem minmax(0, 1fr);
  width: 100%;
  padding: 0.65rem 0.35rem;
  border-radius: 0.6rem;
  color: inherit;
  text-align: start;
}

.atos__linha.p-button {
  border: 0;
  background: transparent;
  font-size: inherit;
  font-weight: inherit;
  transition: background-color 0.15s ease-out;
}

.atos__lista .atos__linha.p-button,
.atos__lista .atos__linha.p-button:not(:disabled):hover,
.atos__lista .atos__linha.p-button:focus-visible {
  box-shadow: none;
}

.atos__linha.p-button:not(:disabled):hover,
.atos__linha.p-button:not(:disabled):active {
  background: color-mix(in srgb, var(--hc-marca-clara) 45%, transparent);
  color: inherit;
}

.atos__linha.p-button:focus-visible {
  outline: 2px solid var(--hc-marca);
  outline-offset: -2px;
}

.atos__quando {
  display: grid;
  gap: 0.05rem;
  color: var(--hc-tinta-2);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.atos__quando strong {
  color: var(--hc-tinta);
  font-size: 0.8125rem;
  font-weight: 650;
}

.atos__corpo {
  display: grid;
  gap: 0.2rem;
  min-width: 0;
}

.atos__nome {
  display: flex;
  align-items: flex-start;
  gap: 0.35rem;
  color: var(--hc-tinta);
  font-size: 0.875rem;
  font-weight: 650;
}

.atos__tipo {
  flex-shrink: 0;
  margin-top: 0.2rem;
  width: 0.95rem;
  height: 0.95rem;
  color: var(--hc-marca);
}

.atos__meta {
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}

.atos__origem {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.35rem 0.5rem;
  font-size: 0.8125rem;
}

.atos__quem {
  color: var(--hc-tinta-2);
}

/* "Relatado" é itálico e apagado: diz que o dado existe e que a clínica não o presenciou. */
.atos__relato {
  color: var(--hc-tinta-3);
  font-style: italic;
}

@media (prefers-reduced-motion: reduce) {
  .atos__linha.p-button {
    transition: none;
  }
}
</style>
