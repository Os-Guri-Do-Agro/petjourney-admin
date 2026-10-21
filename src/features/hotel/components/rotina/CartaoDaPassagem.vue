<script setup lang="ts">
/**
 * O fim do turno, ao lado da prancheta.
 *
 * ## Por que existe
 *
 * A regra R3 fecha a porta da passagem: ocorrência grave sem contato com o responsável **não passa
 * adiante** (ver `PassagemDialog`). Sem este cartão a pessoa só descobria isso ao abrir o diálogo —
 * às 22h, quando já não dá para ligar para ninguém. O travamento era verdadeiro, correto e inútil.
 *
 * Aqui ficam os três números do fim do turno, desde o começo dele: **quando acaba e quem assume,
 * quanto fica, e o que impede a entrega**. Às 14h ainda dá para ligar.
 *
 * ## Por que não resolve aqui
 *
 * O aviso leva ao diálogo, e é lá que cada ocorrência travada tem o caminho para a estadia do
 * animal. Duplicar a lista aqui criaria dois lugares para a mesma decisão.
 *
 * O travamento é dito no ícone, na cor do texto e na palavra — nunca pintando o cartão inteiro.
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

/** Quem assume, pelo nome: quem entrega precisa saber para quem está entregando. */
const quemAssume = computed(() => {
  const id = props.passagem?.seguinte.responsavelId

  return props.cuidadores.find((pessoa) => pessoa.id === id)?.nome ?? ''
})

const assume = computed(() => {
  if (!props.passagem) return ''

  const turno = formato.turno(props.passagem.seguinte.kind)

  return quemAssume.value ? t('hotel.turno.assumeCom', { turno, pessoa: quemAssume.value }) : turno
})
</script>

<template>
  <section v-if="passagem" class="fim ui-folha" aria-labelledby="fim-do-turno-titulo">
    <header class="fim__cabeca">
      <span class="fim__icone" aria-hidden="true"><i class="ph ph-arrows-left-right" /></span>

      <div class="fim__titulos">
        <h2 id="fim-do-turno-titulo">{{ t('hotel.turno.fimDoTurno') }}</h2>
        <p>{{ assume }}</p>
      </div>

      <time class="fim__hora ui-hora" :datetime="passagem.turno.fim">
        {{ formato.hora(passagem.turno.fim) }}
      </time>
    </header>

    <ul class="fim__lista">
      <li class="fim__item">
        <i class="ph ph-list-checks" aria-hidden="true" />
        <span>{{ t('hotel.turno.ficam', { total: ficam }, ficam) }}</span>
      </li>

      <!--
        O travamento, clicável: o caminho para resolvê-lo é o mesmo diálogo, e um aviso que não
        leva a lugar nenhum transfere para a pessoa o trabalho de descobrir onde é esse lugar.
      -->
      <li v-if="travadas > 0" class="fim__item fim__item--trava">
        <button type="button" class="fim__trava" @click="emit('passar')">
          <i class="ph ph-warning-circle" aria-hidden="true" />
          <span>{{ t('hotel.turno.travaEntrega', { total: travadas }, travadas) }}</span>
          <i class="ph ph-caret-right fim__seta" aria-hidden="true" />
        </button>
      </li>

      <li v-else class="fim__item fim__item--livre">
        <i class="ph ph-check-circle" aria-hidden="true" />
        <span>{{ t('hotel.turno.nadaTrava') }}</span>
      </li>
    </ul>

    <footer class="fim__pe">
      <Button
        type="button"
        class="fim__passar"
        :label="t('hotel.turno.passar')"
        icon="ph ph-sign-out"
        severity="secondary"
        outlined
        fluid
        @click="emit('passar')"
      />
    </footer>
  </section>
</template>

<style scoped>
.fim {
  display: grid;
  overflow: hidden;
}

.fim__cabeca {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 18px 24px 16px;
  border-bottom: 1px solid var(--linha-suave);
  background: linear-gradient(
    180deg,
    color-mix(in oklab, var(--hotel-fundo) 75%, var(--superficie)),
    var(--superficie)
  );
}

.fim__icone {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 11px;
  background: var(--superficie);
  box-shadow: var(--sombra-xs);
  color: var(--hotel-tinta);
  font-size: 18px;
}

.fim__titulos {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 1px;
}

.fim__titulos h2 {
  margin: 0;
  color: var(--tinta);
  font-size: 15.5px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.fim__titulos p {
  margin: 0;
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* A hora em que o turno acaba é o número que importa: grande, como o tempo de espera do Hoje. */
.fim__hora.ui-hora {
  color: var(--hotel-tinta);
  font-size: 24px;
  letter-spacing: -0.02em;
}

.fim__lista {
  display: grid;
  margin: 0;
  padding: 6px 0;
  list-style: none;
}

.fim__item {
  display: flex;
  align-items: center;
  gap: 10px;
  min-height: 44px;
  padding: 6px 18px;
  color: var(--tinta);
  font-size: 14px;
  line-height: 1.4;
}

.fim__item > i {
  flex: none;
  color: var(--tinta-2);
  font-size: 18px;
}

.fim__item--livre {
  color: var(--ok-tinta);
  font-weight: 550;
}

.fim__item--livre > i {
  color: var(--ok-tinta);
}

.fim__item--trava {
  padding: 0;
}

.fim__trava {
  display: flex;
  width: 100%;
  min-height: 44px;
  align-items: center;
  gap: 10px;
  padding: 8px 18px;
  border: 0;
  background: color-mix(in oklab, var(--risco-fundo) 60%, transparent);
  color: var(--risco-tinta);
  cursor: pointer;
  font: inherit;
  font-size: 14px;
  font-weight: 600;
  text-align: start;
}

.fim__trava:hover {
  background: var(--risco-fundo);
}

.fim__trava:focus-visible {
  outline: 2px solid var(--risco);
  outline-offset: -2px;
}

.fim__trava i {
  flex: none;
  font-size: 18px;
}

.fim__trava span {
  flex: 1;
}

.fim__seta {
  font-size: 14px;
}

[dir='rtl'] .fim__seta {
  scale: -1 1;
}

.fim__pe {
  padding: 4px 18px 16px;
}

.fim__passar.p-button {
  min-height: 40px;
}
</style>
