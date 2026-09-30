<script setup lang="ts">
/**
 * Andamento do dia: o "My Goals" do Prodify, com o dia da casa.
 *
 * Cada linha é uma meta do dia que já dá para medir com o que o sistema tem: quanto da agenda da
 * clínica já foi atendido, quantos dos que tinham hora vieram, quanto da rotina do hotel está feito
 * e quanto do hotel está ocupado. Título, de onde vem o número, a barra e a porcentagem — como lá.
 */
import Skeleton from 'primevue/skeleton'
import { PhTarget } from '@phosphor-icons/vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { contarPorEstado } from './linha-do-dia'
import { useDiaDaCasa } from './useLinhaDoDia'

const props = defineProps<{ clinica: boolean; hotel: boolean }>()

const { t } = useI18n()
const dia = useDiaDaCasa()

type Meta = {
  id: string
  titulo: string
  detalhe: string
  percentual: number
  cor: string
}

function percentual(parte: number, todo: number) {
  return todo > 0 ? Math.round((parte / todo) * 100) : 0
}

const carregando = computed(
  () =>
    (props.clinica && dia.clinica.value.carga === 'carregando') ||
    (props.hotel && dia.hotel.value.carga === 'carregando'),
)

const metas = computed<Meta[]>(() => {
  const lista: Meta[] = []
  const secaoClinica = t('clinico.navegacao.secao')
  const secaoHotel = t('hotel.navegacao.secao')

  const agenda = dia.clinica.value
  if (props.clinica && agenda.carga === 'pronta' && !agenda.fechada && agenda.contas.length > 0) {
    const contagem = contarPorEstado(agenda.contas)
    const total = agenda.contas.length

    lista.push({
      id: 'finalizados',
      titulo: t('inicio.andamento.finalizados'),
      detalhe: t('inicio.andamento.finalizadosDetalhe', {
        modulo: secaoClinica,
        feitos: contagem.feito,
        total,
      }),
      percentual: percentual(contagem.feito, total),
      cor: 'var(--andamento-ciano)',
    })

    /* Comparecimento: de quem tinha hora e já devia ter vindo, quantos vieram. */
    const vieram = contagem.feito + contagem.agora + contagem.esperando
    const esperados = vieram + contagem.falta

    if (esperados > 0) {
      lista.push({
        id: 'comparecimento',
        titulo: t('inicio.andamento.comparecimento'),
        detalhe: t(
          'inicio.andamento.comparecimentoDetalhe',
          { modulo: secaoClinica, total: contagem.falta },
          contagem.falta,
        ),
        percentual: percentual(vieram, esperados),
        cor: 'var(--andamento-verde)',
      })
    }
  }

  const casa = dia.hotel.value
  if (props.hotel && casa.carga === 'pronta') {
    if (casa.rotina.total > 0) {
      lista.push({
        id: 'rotina',
        titulo: t('inicio.andamento.rotina'),
        detalhe: t('inicio.andamento.rotinaDetalhe', {
          modulo: secaoHotel,
          feitas: casa.rotina.feitas,
          total: casa.rotina.total,
        }),
        percentual: percentual(casa.rotina.feitas, casa.rotina.total),
        cor: 'var(--andamento-laranja)',
      })
    }

    if (casa.ocupacao && casa.ocupacao.operando > 0) {
      lista.push({
        id: 'ocupacao',
        titulo: t('inicio.andamento.ocupacao'),
        detalhe: t('inicio.andamento.ocupacaoDetalhe', {
          modulo: secaoHotel,
          ocupadas: casa.ocupacao.ocupadas,
          total: casa.ocupacao.operando,
        }),
        percentual: percentual(casa.ocupacao.ocupadas, casa.ocupacao.operando),
        cor: 'var(--andamento-lilas)',
      })
    }
  }

  return lista
})
</script>

<template>
  <section class="hc andamento" aria-labelledby="home-andamento-titulo">
    <header class="hc__cabeca">
      <h2 id="home-andamento-titulo" class="hc__titulo">
        <PhTarget class="hc__icone" aria-hidden="true" />
        {{ t('inicio.andamento.titulo') }}
      </h2>
    </header>

    <div
      v-if="carregando && metas.length === 0"
      class="andamento__esqueleto"
      role="status"
      aria-busy="true"
      :aria-label="t('inicio.andamento.carregando')"
    >
      <Skeleton v-for="n in 2" :key="n" width="100%" height="2.6rem" border-radius="0.5rem" />
    </div>

    <p v-else-if="metas.length === 0" class="andamento__vazio">
      {{ t('inicio.andamento.vazio') }}
    </p>

    <ul v-else class="andamento__lista">
      <li v-for="meta in metas" :key="meta.id" class="meta">
        <span class="meta__texto">
          <span class="meta__titulo">{{ meta.titulo }}</span>
          <span class="meta__detalhe">{{ meta.detalhe }}</span>
        </span>
        <span
          class="hc-barra meta__barra"
          role="img"
          :aria-label="`${meta.titulo}: ${meta.percentual}%`"
          :style="{ '--barra-cor': meta.cor }"
        >
          <span class="hc-barra__cheia" :style="{ inlineSize: `${meta.percentual}%` }" />
        </span>
        <span class="meta__percentual" aria-hidden="true">{{ meta.percentual }}%</span>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.andamento {
  --andamento-ciano: #35b1aa;
  --andamento-verde: #4caf7d;
  --andamento-laranja: #f09a55;
  --andamento-lilas: #8f7fe6;

  gap: 0.6rem;
}

.andamento__esqueleto {
  display: grid;
  gap: 0.5rem;
}

.andamento__vazio {
  margin: 0;
  color: var(--hc-tinta-2);
  font-size: 0.875rem;
}

.andamento__lista {
  display: grid;
  margin: 0;
  padding: 0;
  list-style: none;
}

.meta {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto 2.75rem;
  align-items: center;
  gap: 1rem;
  padding-block: 0.7rem;
}

.meta + .meta {
  border-block-start: 1px solid var(--hc-linha);
}

.meta__texto {
  display: grid;
  gap: 0.15rem;
  min-width: 0;
}

.meta__titulo {
  color: var(--hc-tinta);
  font-size: 0.875rem;
  font-weight: 500;
}

.meta__detalhe {
  color: var(--hc-tinta-3);
  font-size: 0.75rem;
  font-variant-numeric: tabular-nums;
}

.meta__barra {
  inline-size: 6rem;
}

.meta__percentual {
  color: var(--hc-tinta);
  font-size: 0.875rem;
  font-weight: 650;
  font-variant-numeric: tabular-nums;
  text-align: end;
}
</style>
