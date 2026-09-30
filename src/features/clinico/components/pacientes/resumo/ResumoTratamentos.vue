<script setup lang="ts">
/**
 * Remédio em casa — a pergunta do retorno, respondida antes de alguém perguntar.
 *
 * "O tratamento não funcionou" e "o tratamento não foi feito" pedem condutas opostas, e até aqui
 * só o responsável sabia qual das duas era, e só se alguém perguntasse do jeito certo. O cartão
 * mostra, desde a última consulta, o que a casa registrou no app: a faixa de doses e a conta sem
 * nota. O detalhe — quem deu, os registros um a um, o registro da conversa — está na aba
 * Tratamento da ficha, a um clique.
 *
 * Mora ao lado do diário ("o que aconteceu em casa") porque é a mesma pergunta: o que o vet não
 * viu acontecer.
 */
import { PhPill, PhWarning } from '@phosphor-icons/vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import FaixaDeDoses from '../../tratamento/FaixaDeDoses.vue'
import LegendaDaFaixa from '../../tratamento/LegendaDaFaixa.vue'
import { useRotulosDoTratamento } from '../../../composables/useRotulosDoTratamento'
import { horarioDestoante } from '../../../domain/adesao'
import type { TratamentoNoResumo } from '../../../domain/resumo-do-paciente'

defineProps<{
  petId: string
  tratamentos: TratamentoNoResumo[]
}>()

const { t } = useI18n()
const rotulos = useRotulosDoTratamento()
</script>

<template>
  <section class="hc remedios" aria-labelledby="resumo-remedios-titulo">
    <header class="hc__cabeca">
      <h2 id="resumo-remedios-titulo" class="hc__titulo">
        <PhPill class="hc__icone" weight="duotone" aria-hidden="true" />
        {{ t('clinico.resumoDoPaciente.tratamentos.titulo') }}
      </h2>
      <RouterLink class="hc__link" :to="`/veterinario/paciente/${petId}/tratamento`">
        {{ t('clinico.resumoDoPaciente.tratamentos.abrir') }}
        <i class="pi pi-arrow-right" aria-hidden="true" />
      </RouterLink>
    </header>
    <p class="ficha-ajuda">{{ t('clinico.resumoDoPaciente.tratamentos.ajuda') }}</p>

    <ul class="remedios__lista">
      <li v-for="item in tratamentos" :key="item.id" class="remedio">
        <div class="remedio__topo">
          <strong>{{ rotulos.nome(item) }}</strong>
          <span class="remedio__meta">{{ rotulos.posologia(item) }}</span>
        </div>

        <template v-if="item.compartilhado">
          <FaixaDeDoses
            :doses="item.doses"
            :frequencia-horas="item.frequenciaHoras"
            :nomes="item.nomes"
            :rotulo="`${rotulos.nome(item)}: ${rotulos.contagem(item.periodo)}`"
          />
          <p class="remedio__contagem">{{ rotulos.contagem(item.periodo) }}</p>
          <p
            v-if="rotulos.quem(item.periodo, item.nomes) || horarioDestoante(item.periodo)"
            class="remedio__meta"
          >
            {{ rotulos.quem(item.periodo, item.nomes) }}
            <template v-if="horarioDestoante(item.periodo)">
              · {{ rotulos.horarioDestoante(horarioDestoante(item.periodo)!) }}
            </template>
          </p>
          <p v-if="item.alerta" class="remedio__alerta">
            <PhWarning class="remedio__alerta-icone" weight="fill" aria-hidden="true" />
            {{ rotulos.alerta(item.alerta).titulo }}
          </p>
        </template>
        <p v-else class="remedio__meta">{{ t('clinico.adesao.naoCompartilhado') }}</p>
      </li>
    </ul>

    <LegendaDaFaixa />
  </section>
</template>

<style scoped>
.remedios__lista {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.remedio {
  display: grid;
  gap: 0.5rem;
  padding-block: 0.9rem;
}

.remedio:first-child {
  padding-top: 0;
}

.remedio + .remedio {
  border-top: 1px solid var(--hc-linha);
}

.remedio__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.2rem 0.6rem;
  color: var(--hc-tinta);
  font-size: 0.9375rem;
}

.remedio__topo strong {
  font-weight: 650;
}

.remedio__meta {
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: 0.8125rem;
}

.remedio__contagem {
  margin: 0;
  color: var(--hc-tinta);
  font-size: 0.875rem;
  font-variant-numeric: tabular-nums;
}

.remedio__alerta {
  display: flex;
  align-items: center;
  margin: 0;
  gap: 0.4rem;
  color: var(--hc-coral-tinta);
  font-size: 0.875rem;
  font-weight: 650;
}

.remedio__alerta-icone {
  flex-shrink: 0;
  width: 1rem;
  height: 1rem;
}
</style>
