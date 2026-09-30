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
 */
import Button from 'primevue/button'
import { PhFirstAidKit, PhPlus } from '@phosphor-icons/vue'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicDataTable from '../base/ClinicDataTable.vue'
import ClinicToggleGroup from '../base/ClinicToggleGroup.vue'
import type { ColunaTabela } from '../base/table-types'
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
      rotulo: `${t('clinico.paciente.atos.filtro.todos')} (${props.atos.length})`,
    },
    {
      valor: 'medicamento' as Filtro,
      rotulo: `${t('clinico.paciente.atos.filtro.medicamento')} (${contar('medicamento')})`,
    },
    {
      valor: 'procedimento' as Filtro,
      rotulo: `${t('clinico.paciente.atos.filtro.procedimento')} (${contar('procedimento')})`,
    },
  ]
})

const visiveis = computed(() =>
  filtro.value === 'todos' ? props.atos : props.atos.filter((ato) => ato.kind === filtro.value),
)

const colunas = computed<ColunaTabela[]>(() => [
  { id: 'quando', rotulo: t('clinico.paciente.atos.colunaQuando'), largura: '10rem' },
  { id: 'ato', rotulo: t('clinico.paciente.atos.colunaAto'), largura: 'minmax(0, 2fr)' },
  {
    id: 'origem',
    rotulo: t('clinico.paciente.atos.colunaOrigem'),
    largura: '9rem',
    ocultarEmTelaEstreita: true,
  },
  {
    id: 'quem',
    rotulo: t('clinico.paciente.atos.colunaQuem'),
    largura: 'minmax(0, 1fr)',
    ocultarEmTelaEstreita: true,
  },
])

/** A segunda linha do ato: via e dose, quando existem. É o que distingue duas linhas iguais. */
function detalhe(ato: AtoClinico): string {
  const via = ato.via ? t(`clinico.prontuario.conduta.via_.${ato.via}`) : ''

  return [via, ato.doseTexto, ato.observacao].filter(Boolean).join(' · ')
}

function origem(valor: OrigemDoAto): string {
  return t(`clinico.paciente.atos.origem.${valor}`)
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
        class="ficha-pilula"
        :label="t('clinico.paciente.atos.registrar')"
        @click="emit('registrar')"
      >
        <template #icon>
          <PhPlus class="ficha-pilula__icone" weight="bold" aria-hidden="true" />
        </template>
      </Button>
    </header>

    <ClinicToggleGroup
      v-model="filtro"
      :opcoes="opcoesFiltro"
      :rotulo="t('clinico.paciente.atos.titulo')"
    />

    <ClinicDataTable
      :colunas="colunas"
      :linhas="visiveis"
      :chave="(ato) => ato.id"
      :carregando="carregando"
      :vazio-titulo="t('clinico.paciente.atos.vazioTitulo')"
      :vazio-descricao="t('clinico.paciente.atos.vazioDescricao')"
      :rotulo="t('clinico.paciente.atos.titulo')"
      @ativar="abrir"
    >
      <template #vazio-acao>
        <Button
          type="button"
          outlined
          size="small"
          icon="pi pi-plus"
          :label="t('clinico.paciente.atos.registrar')"
          @click="emit('registrar')"
        />
      </template>

      <template #celula-quando="{ linha }">
        <strong class="clinic-value">
          {{ formato.dataCurta(clinicClock.dateOf(linha.realizadoEm)) }}
        </strong>
        <span class="atos__meta">
          {{ clinicClock.dateOf(linha.realizadoEm).slice(0, 4) }} ·
          {{ formato.hora(linha.realizadoEm) }}
        </span>
      </template>

      <template #celula-ato="{ linha }">
        <strong class="atos__nome">
          <i
            :class="linha.kind === 'medicamento' ? 'pi pi-inbox' : 'pi pi-briefcase'"
            aria-hidden="true"
          />
          {{ linha.descricao }}
        </strong>
        <span v-if="detalhe(linha)" class="atos__meta">{{ detalhe(linha) }}</span>
      </template>

      <template #celula-origem="{ linha }">
        <span class="selo" :class="`selo--${linha.origem}`">{{ origem(linha.origem) }}</span>
      </template>

      <template #celula-quem="{ linha }">
        <span :class="linha.professionalId ? 'atos__nome' : 'atos__relato'">
          {{ quem(linha) }}
        </span>
      </template>
    </ClinicDataTable>
  </section>
</template>

<style scoped>
.atos {
  display: grid;
  gap: 0.85rem;
  min-width: 0;
  padding: 1.2rem 1.35rem 1.35rem;
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
}

.atos__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--clinic-space-2);
}

.atos__titulos {
  min-width: 0;
}

.atos__titulo {
  display: inline-flex;
  align-items: center;
  gap: 0.55rem;
  margin: 0;
  color: var(--clinic-text);
  font-size: 1rem;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.atos__titulo-icone {
  flex-shrink: 0;
  width: 1.2rem;
  height: 1.2rem;
  color: var(--clinic-accent);
}

.atos__ajuda {
  margin: 0.2rem 0 0;
  color: var(--clinic-muted);
  font-size: 0.8125rem;
}

.atos__nome {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.atos__nome i {
  flex: none;
  color: var(--clinic-faint);
  font-size: 0.7rem;
}

.atos__meta {
  display: block;
  overflow: hidden;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* "Relatado" é itálico e apagado: diz que o dado existe e que a clínica não o presenciou. */
.atos__relato {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-style: italic;
}

.selo {
  display: inline-block;
  padding: 0.1rem 0.45rem;
  border: 1px solid var(--clinic-line-strong);
  border-radius: var(--clinic-radius-chip);
  background: var(--clinic-surface-soft);
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 650;
}

.selo--internacao {
  border-color: var(--clinic-accent-strong);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
}

.selo--vacina {
  border-color: var(--clinic-ok-line);
  background: var(--clinic-ok-bg);
  color: var(--clinic-ok-text);
}

/*
 * Relato do responsável ganha moldura âmbar, e não cinza.
 *
 * Não é alerta — é ressalva. A diferença entre "a clínica aplicou" e "alguém disse que
 * aplicaram" é exatamente o tipo de coisa que se lê rápido demais na terceira leitura do dia.
 */
.selo--avulso {
  border-color: var(--clinic-attention-line);
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
}
</style>
