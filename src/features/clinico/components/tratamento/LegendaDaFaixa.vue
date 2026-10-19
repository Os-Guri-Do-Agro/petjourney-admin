<script setup lang="ts">
/**
 * A legenda da faixa de doses — uma por cartão, não uma por remédio.
 *
 * Carrega a frase que a tela inteira existe para dizer: **sem registro não é dose perdida.** Está
 * aqui, e não num balão de ajuda, porque é a leitura que muda a conversa do vet com a casa, e
 * precisa estar à vista na primeira vez que alguém vê um quadradinho cinza.
 */
import { useI18n } from 'vue-i18n'

import './faixa-cores.css'

withDefaults(
  defineProps<{
    /** Mostra o fio da última consulta — só onde a faixa o desenha. */
    comMarco?: boolean
  }>(),
  { comMarco: false },
)

const { t } = useI18n()

const ITENS = ['dada', 'pulada', 'sem-registro', 'aberta'] as const
</script>

<template>
  <div class="legenda faixa-cores">
    <ul class="legenda__itens" :aria-label="t('clinico.ficha.tratamento.legenda')">
      <li v-for="item in ITENS" :key="item" class="legenda__item">
        <span class="legenda__amostra" :class="`legenda__amostra--${item}`" aria-hidden="true" />
        {{ t(`clinico.adesao.situacao.${item}`) }}
      </li>
      <li v-if="comMarco" class="legenda__item">
        <span class="legenda__fio" aria-hidden="true" />
        {{ t('clinico.adesao.faixa.marcoLegenda') }}
      </li>
    </ul>
    <p class="legenda__nota">{{ t('clinico.adesao.faixa.semRegistroNota') }}</p>
  </div>
</template>

<style scoped>
.legenda {
  display: grid;
  gap: 6px;
}

.legenda__itens {
  display: flex;
  flex-wrap: wrap;
  margin: 0;
  padding: 0;
  gap: 6px 16px;
  list-style: none;
}

.legenda__item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 500;
}

/* A amostra no tamanho da célula da ficha: a legenda ensina a mesma forma que a faixa desenha. */
.legenda__amostra {
  width: 12px;
  height: 12px;
  flex-shrink: 0;
  border-radius: 3px;
}

.legenda__amostra--dada {
  background: var(--faixa-dada);
}

.legenda__amostra--pulada {
  background: var(--faixa-pulada);
}

.legenda__amostra--sem-registro {
  background: var(--faixa-sem-registro);
}

.legenda__amostra--aberta {
  box-shadow: inset 0 0 0 2px var(--faixa-agora);
}

.legenda__fio {
  width: 1px;
  height: 14px;
  background: var(--faixa-fio);
}

.legenda__nota {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}
</style>
