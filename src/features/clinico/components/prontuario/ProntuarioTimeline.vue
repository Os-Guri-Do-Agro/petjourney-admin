<script setup lang="ts">
/**
 * Linha do tempo do paciente, com a consulta anterior em destaque.
 *
 * O retorno abre mostrando a consulta anterior porque, sem isso, o profissional relê o
 * histórico inteiro para lembrar o que prescreveu há duas semanas. O que interessa no retorno
 * é o par: o que foi dito e o que aconteceu depois.
 */
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import { useClinicFormat } from '../../composables/useClinicFormat'
import type { Encounter, TimelineEvent, TimelineEventKind } from '../../data/types'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = withDefaults(
  defineProps<{
    eventos: TimelineEvent[]
    anterior: Encounter | null
    /**
     * Quantos eventos cabem antes de a lista virar parede. Cinco é o que uma coluna lateral
     * mostra sem empurrar o conteúdo principal para cima — o resto fica na página do paciente,
     * que existe justamente para isso.
     */
    limite?: number
    /** Rota do histórico completo. Sem ela, o "ver todos" não aparece. */
    rotaCompleta?: string
  }>(),
  { limite: 5, rotaCompleta: '' },
)

const { t } = useI18n()
const formato = useClinicFormat()
const clinico = useClinicoStore()

/**
 * Filtro por tipo.
 *
 * É a tela que o vet abre antes de entrar na sala, e a pergunta que ele faz é sempre estreita:
 * "quando foi a última vacina?", "já operou?". Sem filtro, responder qualquer uma delas obriga
 * a rolar a lista inteira e ler o que não interessa.
 *
 * Só aparecem os tipos que **existem neste paciente** — uma ficha "Internação" num pet que
 * nunca internou é um clique que só devolve lista vazia. O filtro é de seleção única: a
 * pergunta é sobre um tipo de cada vez, e múltipla escolha aqui pediria um botão de aplicar.
 */
const filtro = ref<TimelineEventKind | null>(null)

const tiposPresentes = computed(() => {
  const contagem = new Map<TimelineEventKind, number>()

  for (const evento of props.eventos) {
    contagem.set(evento.kind, (contagem.get(evento.kind) ?? 0) + 1)
  }

  return [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([kind, total]) => ({ kind, total }))
})

const filtrados = computed(() =>
  filtro.value ? props.eventos.filter((evento) => evento.kind === filtro.value) : props.eventos,
)

function alternarFiltro(kind: TimelineEventKind) {
  filtro.value = filtro.value === kind ? null : kind
}

const visiveis = computed(() => filtrados.value.slice(0, props.limite))
const restantes = computed(() => Math.max(filtrados.value.length - props.limite, 0))

const ICONE: Record<TimelineEvent['kind'], string> = {
  consulta: 'pi pi-file',
  vacina: 'pi pi-shield',
  exame: 'pi pi-search',
  cirurgia: 'pi pi-heart',
  internacao: 'pi pi-home',
  prescricao: 'pi pi-book',
  falta: 'pi pi-user-minus',
  observacao: 'pi pi-comment',
}

/**
 * O que foi prescrito da última vez, com nome e dose legível.
 *
 * A lista mostrava "17.54 mg · 8 h · 5 d": ponto no lugar da vírgula e, pior, sem dizer de que
 * remédio se tratava. O painel existe para o profissional não reler o histórico atrás
 * exatamente disso.
 */
const prescricoesAnteriores = computed(() =>
  (props.anterior?.conduta.prescricoes ?? []).map((prescricao) => ({
    id: prescricao.id,
    nome: clinico.medicamento(prescricao.calculo.medicamentoId)?.nome ?? '',
    dose: t('clinico.prontuario.timeline.doseAnterior', {
      mg: formato.numero(prescricao.calculo.mgPorAdministracao, 1),
      frequencia: prescricao.calculo.frequenciaHoras,
      duracao: prescricao.calculo.duracaoDias,
    }),
  })),
)
</script>

<template>
  <aside class="timeline clinic-scope">
    <section v-if="anterior" class="anterior">
      <header class="anterior__topo">
        <span class="clinic-label">{{ t('clinico.prontuario.timeline.consultaAnterior') }}</span>
        <span class="clinic-value anterior__data">
          {{ formato.dataCurta(clinicClock.dateOf(anterior.finalizadoEm ?? anterior.abertoEm)) }}
        </span>
      </header>

      <p class="anterior__queixa">
        {{ clinico.diagnosticoPrincipal(anterior) || anterior.anamnese.queixaPrincipal || '—' }}
      </p>

      <p v-if="anterior.conduta.orientacoes" class="anterior__texto">
        {{ anterior.conduta.orientacoes }}
      </p>

      <ul v-if="prescricoesAnteriores.length > 0" class="anterior__prescricoes">
        <li v-for="prescricao in prescricoesAnteriores" :key="prescricao.id">
          <strong v-if="prescricao.nome">{{ prescricao.nome }}</strong>
          <span class="clinic-value">{{ prescricao.dose }}</span>
        </li>
      </ul>
    </section>

    <section class="historico">
      <h3 class="clinic-label">{{ t('clinico.prontuario.timeline.titulo') }}</h3>

      <!--
        Fichas de filtro com a contagem: além de filtrar, elas respondem "o que já foi feito
        neste pet" antes de qualquer clique — que é a pergunta que traz o vet a esta lista.
      -->
      <div v-if="tiposPresentes.length > 1" class="filtro" role="group">
        <button
          v-for="tipo in tiposPresentes"
          :key="tipo.kind"
          type="button"
          class="filtro__ficha clinic-focusable"
          :class="{ 'filtro__ficha--ativa': filtro === tipo.kind }"
          :aria-pressed="filtro === tipo.kind"
          @click="alternarFiltro(tipo.kind)"
        >
          <i :class="ICONE[tipo.kind]" aria-hidden="true" />
          <span>{{ t(`clinico.prontuario.timeline.kind.${tipo.kind}`) }}</span>
          <span class="filtro__contagem clinic-value">{{ tipo.total }}</span>
        </button>
      </div>

      <ol v-if="visiveis.length > 0" class="linha">
        <li v-for="evento in visiveis" :key="evento.id" class="linha__item">
          <span class="linha__marca" :class="`linha__marca--${evento.kind}`" aria-hidden="true">
            <i :class="ICONE[evento.kind]" />
          </span>

          <div class="linha__corpo">
            <span class="linha__data clinic-value">
              {{ formato.dataCurta(clinicClock.dateOf(evento.em)) }}
            </span>
            <strong class="linha__titulo">
              {{ evento.titulo || t(`clinico.prontuario.timeline.kind.${evento.kind}`) }}
            </strong>
            <span v-if="evento.resumo" class="linha__resumo">{{ evento.resumo }}</span>
          </div>
        </li>
      </ol>

      <p v-else class="vazio">{{ t('clinico.prontuario.timeline.vazio') }}</p>

      <RouterLink v-if="restantes > 0 && rotaCompleta" class="historico__mais" :to="rotaCompleta">
        {{ t('clinico.comum.verTodos', { contagem: eventos.length }) }}
        <i class="pi pi-arrow-right" aria-hidden="true" />
      </RouterLink>
    </section>
  </aside>
</template>

<style scoped>
.timeline {
  display: grid;
  align-content: start;
  gap: var(--clinic-space-3);
  width: 320px;
}

.anterior {
  display: grid;
  gap: var(--clinic-space-2);
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-accent);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-accent-tint);
}

.anterior__topo {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--clinic-space-2);
}

.anterior__data {
  color: var(--clinic-accent-strong);
  font-weight: 800;
}

.anterior__queixa {
  margin: 0;
  font-size: var(--clinic-font-value);
  font-weight: 700;
  line-height: 1.4;
}

.anterior__texto {
  margin: 0;
  color: var(--clinic-muted);
  line-height: 1.5;
}

.anterior__prescricoes {
  display: grid;
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.anterior__prescricoes li {
  display: grid;
  gap: 0.05rem;
  line-height: 1.35;
}

.anterior__prescricoes strong {
  font-weight: 750;
}

.anterior__prescricoes span {
  color: var(--clinic-accent-strong);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.filtro {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2rem;
  margin-top: var(--clinic-space-2);
}

.filtro__ficha {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.1rem 0.4rem;
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-chip);
  background: var(--clinic-surface);
  color: var(--clinic-muted);
  cursor: pointer;
  font: inherit;
  font-size: var(--clinic-font-label);
}

.filtro__ficha i {
  font-size: 0.6rem;
}

.filtro__ficha:hover {
  border-color: var(--clinic-line-strong);
  color: var(--clinic-text);
}

/* Filtro ligado ganha contorno e fundo, não só cor: o estado sobrevive à escala de cinza. */
.filtro__ficha--ativa {
  border-color: var(--clinic-accent-strong);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  font-weight: 700;
}

.filtro__contagem {
  color: var(--clinic-faint);
  font-weight: 750;
}

.filtro__ficha--ativa .filtro__contagem {
  color: var(--clinic-accent-strong);
}

.historico {
  display: grid;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
}

.linha {
  display: grid;
  gap: var(--clinic-space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

.linha__item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: var(--clinic-space-2);
}

.linha__marca {
  display: grid;
  width: 1.7rem;
  height: 1.7rem;
  place-items: center;
  border-radius: 999px;
  background: var(--clinic-surface-sunken);
  color: var(--clinic-muted);
  font-size: 0.65rem;
}

.linha__marca--falta {
  background: var(--clinic-risk-bg);
  color: var(--clinic-risk-text);
}

.linha__marca--cirurgia {
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
}

.linha__corpo {
  display: grid;
  gap: 0.1rem;
  min-width: 0;
}

.linha__data {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.linha__titulo {
  font-weight: 700;
  line-height: 1.35;
  overflow-wrap: anywhere;
}

.linha__resumo {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  line-height: 1.45;
}

.historico__mais {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--clinic-accent-strong);
  font-size: var(--clinic-font-label);
  font-weight: 750;
  text-decoration: none;
}

.historico__mais:hover {
  text-decoration: underline;
  text-underline-offset: 2px;
}

.historico__mais i {
  font-size: 0.62rem;
}

.vazio {
  margin: 0;
  color: var(--clinic-faint);
}

@media (max-width: 1200px) {
  .timeline {
    width: 100%;
  }
}
</style>
