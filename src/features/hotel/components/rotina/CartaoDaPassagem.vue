<script setup lang="ts">
/**
 * O fim do turno, no pé da prancheta.
 *
 * ## Por que existe
 *
 * A regra R3 fecha a porta da passagem: ocorrência grave sem contato com o responsável **não passa
 * adiante** (ver `PassagemDialog`). Até aqui, a pessoa só descobria isso ao abrir o diálogo — e ela
 * abre o diálogo às 22h, que é exatamente quando já não dá para ligar para ninguém. O travamento
 * era verdadeiro, correto e inútil: chegava tarde demais para ser resolvido.
 *
 * Este cartão traz os três números do fim do turno para dentro da tela onde a pessoa passa o turno
 * inteiro: **quem assume, quanto fica, e o que impede a entrega**. Às 14h ainda dá para ligar. É o
 * único lugar da prancheta onde a tela evita um trabalho em vez de acelerá-lo.
 *
 * Os dados já vinham carregados — `carregarPassagem()` roda no `onMounted` da rotina desde sempre.
 * O que faltava era mostrá-los antes da hora do aperto.
 *
 * ## Por que não resolve aqui
 *
 * O aviso leva ao diálogo, e é lá que cada ocorrência travada tem o próprio botão de resolver, com
 * o caminho para a estadia do animal. Duplicar essa lista aqui criaria dois lugares para a mesma
 * decisão, e o cartão deixaria de ser o que ele é — um aviso de que existe trabalho a fazer antes
 * das 22h, não a terceira tela onde se faz.
 *
 * ## A forma
 *
 * Rima com o cartão que fecha o painel do dia, que é onde a mesma pessoa começa o turno: mesma
 * superfície recolhida, mesmo par de linhas, ação à direita. E o travamento é dito no **ícone e no
 * número**, nunca pintando o cartão de vermelho — a casa já decidiu que urgência não mora na
 * superfície, e cinco tarefas atrasadas mais um cartão vermelho no pé não somam urgência.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useHotelFormat } from '../../composables/useHotelFormat'
import type { PassagemDeTurno } from '../../data/repositories'
import type { Cuidador } from '../../data/types'

const props = defineProps<{
  passagem: PassagemDeTurno | null
  cuidadores: Cuidador[]
}>()

const emit = defineEmits<{
  passar: []
}>()

const { t } = useI18n()
const formato = useHotelFormat()

/** Quantas ocorrências impedem a entrega. É a única contagem do cartão que muda o que se faz hoje. */
const travadas = computed(() => props.passagem?.pendencias.ocorrencias.length ?? 0)

const ficam = computed(() => props.passagem?.pendencias.tarefas.length ?? 0)

/**
 * Quem assume, pelo nome.
 *
 * O turno seguinte guarda só o `responsavelId`. "assume Noite" sem nome é metade da informação:
 * quem entrega precisa saber para quem está entregando, e num hotel a escala muda.
 */
const quemAssume = computed(() => {
  const id = props.passagem?.seguinte.responsavelId

  return props.cuidadores.find((pessoa) => pessoa.id === id)?.nome ?? ''
})

const cabecalho = computed(() => {
  if (!props.passagem) return ''

  const fim = formato.hora(props.passagem.turno.fim)
  const turno = formato.turno(props.passagem.seguinte.kind)

  return quemAssume.value
    ? `${fim} · ${t('hotel.turno.assumeCom', { turno, pessoa: quemAssume.value })}`
    : fim
})
</script>

<template>
  <section v-if="passagem" class="fim">
    <div class="fim__texto">
      <p class="fim__topo">
        <i class="pi pi-sign-out" aria-hidden="true" />
        <strong class="fim__rotulo">{{ t('hotel.turno.fimDoTurno') }}</strong>
        <span class="fim__quando">{{ cabecalho }}</span>
      </p>

      <p class="fim__linha">
        {{ t('hotel.turno.ficam', { total: ficam }, ficam) }}
      </p>

      <!--
        O travamento, dito no ícone e no número. Clicável porque o caminho para resolvê-lo é o
        mesmo diálogo — um aviso que não leva a lugar nenhum transfere para a pessoa o trabalho de
        descobrir onde é esse lugar.
      -->
      <button v-if="travadas > 0" type="button" class="fim__trava" @click="emit('passar')">
        <i class="pi pi-exclamation-circle" aria-hidden="true" />
        {{ t('hotel.turno.travaEntrega', { total: travadas }, travadas) }}
      </button>

      <p v-else class="fim__linha fim__linha--livre">
        <i class="pi pi-check" aria-hidden="true" />
        {{ t('hotel.turno.nadaTrava') }}
      </p>
    </div>

    <Button
      :label="t('hotel.turno.passar')"
      class="acao-turno"
      icon="pi pi-sign-out"
      severity="secondary"
      outlined
      size="small"
      @click="emit('passar')"
    />
  </section>
</template>

<style scoped>
/*
 * Recolhido, e não um cartão de conteúdo: isto fecha a página, não compete com ela.
 *
 * Por isso a superfície é a afundada e não a de cartão — o mesmo tom que a prancheta já usa para
 * o que está resolvido — e a ação principal é contornada, não cheia. O verde cheio, nesta tela,
 * significa "isto pede o polegar agora", e passar o turno às 14h não pede.
 */
.fim {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  margin-block-start: var(--clinic-space-3);
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-line-soft);
  border-radius: var(--clinic-radius-card);
  gap: var(--clinic-space-3);
  background: var(--clinic-surface-soft);
}

.fim__texto {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}

.fim__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  margin: 0;
  gap: 0.4rem;
  color: var(--clinic-muted);
}

.fim__topo .pi {
  color: var(--clinic-faint);
  font-size: 0.75rem;
}

.fim__rotulo {
  color: var(--clinic-text);
  font-size: 0.75rem;
  font-weight: 600;
}

.fim__quando {
  font-size: var(--clinic-font-label);
  font-variant-numeric: tabular-nums;
}

.fim__linha {
  margin: 0;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.fim__linha--livre {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--clinic-accent-strong);
}

/* A trava: vermelha no ícone e no texto da contagem, nunca no fundo do cartão. */
.fim__trava {
  display: flex;
  align-items: center;
  justify-self: start;
  padding: 0;
  border: 0;
  gap: 0.3rem;
  background: transparent;
  color: var(--clinic-risk-text);
  cursor: pointer;
  font: inherit;
  font-size: var(--clinic-font-label);
  font-weight: 700;
  text-align: start;
}

.fim__trava:hover {
  text-decoration: underline;
}
</style>
