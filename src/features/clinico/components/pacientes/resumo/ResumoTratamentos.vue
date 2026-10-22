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
 *
 * Acabamento (20/10/2026): cartão com cabeçalho (`ficha.css`) e "Abrir tratamento" na ponta dele,
 * a legenda no pé. Redesenho (19/10/2026): os remédios numa
 * folha só, separados por um fio, e a legenda no pé da folha.
 */
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import '../ficha/ficha.css'
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
  <section class="ficha-cartao remedios ui-folha" aria-labelledby="resumo-remedios-titulo">
    <header class="ficha-cartao__cabeca">
      <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-pill" /></span>
      <div class="ficha-cartao__titulos">
        <h2 id="resumo-remedios-titulo" class="ficha-cartao__titulo">
          {{ t('clinico.resumoDoPaciente.tratamentos.titulo') }}
        </h2>
        <p class="ficha-cartao__descricao">{{ t('clinico.resumoDoPaciente.tratamentos.ajuda') }}</p>
      </div>
      <div class="ficha-cartao__acoes">
        <RouterLink class="ui-mais" :to="`/clinica/paciente/${petId}/tratamento`">
          {{ t('clinico.resumoDoPaciente.tratamentos.abrir') }}
          <i class="ph ph-arrow-right" aria-hidden="true" />
        </RouterLink>
      </div>
    </header>

    <div class="remedios__corpo">
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
            <p class="remedio__contagem ui-num">{{ rotulos.contagem(item.periodo) }}</p>
            <p
              v-if="rotulos.quem(item.periodo, item.nomes) || horarioDestoante(item.periodo)"
              class="remedio__meta"
            >
              {{ rotulos.quem(item.periodo, item.nomes) }}
              <template v-if="horarioDestoante(item.periodo)">
                · {{ rotulos.horarioDestoante(horarioDestoante(item.periodo)!) }}
              </template>
            </p>
            <p v-if="item.alerta" class="remedio__alerta ui-selo ui-selo--risco">
              <i class="ph ph-warning" aria-hidden="true" />
              {{ rotulos.alerta(item.alerta).titulo }}
            </p>
          </template>
          <p v-else class="remedio__meta">{{ t('clinico.adesao.naoCompartilhado') }}</p>
        </li>
      </ul>
    </div>

    <footer class="ficha-cartao__pe">
      <LegendaDaFaixa />
    </footer>
  </section>
</template>

<style scoped>
.remedios__corpo {
  display: grid;
  min-width: 0;
}

.remedios__lista {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.remedio {
  display: grid;
  min-width: 0;
  gap: 8px;
  padding: 16px 24px;
}

.remedio + .remedio {
  border-top: 1px solid var(--linha-suave);
}

.remedio__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 10px;
}

.remedio__topo strong {
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.remedio__meta {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.remedio__contagem {
  margin: 0;
  color: var(--tinta);
  font-size: 14px;
  font-weight: 550;
}

.remedio__alerta.ui-selo {
  justify-self: start;
  max-width: 100%;
  height: auto;
  min-height: 26px;
  margin: 2px 0 0;
  padding-block: 4px;
  font-size: 13px;
  white-space: normal;
}
</style>
