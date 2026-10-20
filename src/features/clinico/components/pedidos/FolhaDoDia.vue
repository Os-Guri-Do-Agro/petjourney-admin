<script setup lang="ts">
/**
 * A folhinha de calendário: o dia do pedido lido de relance.
 *
 * Numa caixa de pedidos, a pergunta da recepção é "para quando?" — e a frase "qua., 14/10 · 18:30
 * com Caio" obriga a ler a linha inteira para achar a resposta. A folha põe o dia onde o olho
 * bate primeiro: a faixa com o dia da semana e o mês, o número grande, e embaixo a hora (ou as
 * noites, no hotel; ou o período, no pedido de melhor horário).
 *
 * Período (`ate`) vira "22–25". A hora riscada é o horário escolhido que já não existe: a folha
 * continua dizendo o que foi pedido, e o risco diz que não serve mais.
 *
 * Os nomes saem do `Intl`, na tag do portal, ao meio-dia UTC — o fuso de quem abre não muda o dia.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { DEFAULT_LOCALE, INTL_LOCALE, isLocale } from '@/i18n/locales'

const props = withDefaults(
  defineProps<{
    /** `AAAA-MM-DD`. */
    dia: string
    /** Último dia do período, para a janela de melhor horário e a estadia do hotel. */
    ate?: string | null
    /** O que vai embaixo do número: a hora, as noites, o período do dia. */
    rodape?: string
    /** O horário escolhido já não existe. */
    riscada?: boolean
    tamanho?: 'md' | 'lg'
  }>(),
  { ate: null, rodape: '', riscada: false, tamanho: 'md' },
)

const { locale } = useI18n()

const tag = computed(() => INTL_LOCALE[isLocale(locale.value) ? locale.value : DEFAULT_LOCALE])

function meioDia(iso: string) {
  return new Date(`${iso}T12:00:00Z`)
}

function semPonto(texto: string) {
  return texto.replace(/\.$/, '')
}

const faixa = computed(() => {
  const mes = semPonto(
    new Intl.DateTimeFormat(tag.value, { month: 'short', timeZone: 'UTC' }).format(
      meioDia(props.dia),
    ),
  )

  if (props.ate && props.ate !== props.dia) {
    return mes
  }

  const semana = semPonto(
    new Intl.DateTimeFormat(tag.value, { weekday: 'short', timeZone: 'UTC' }).format(
      meioDia(props.dia),
    ),
  )

  return `${semana} · ${mes}`
})

const numero = computed(() => {
  const inicio = Number(props.dia.slice(8, 10))

  if (!props.ate || props.ate === props.dia) {
    return String(inicio)
  }

  return `${inicio}–${Number(props.ate.slice(8, 10))}`
})

/** "22 de outubro" para quem não vê a folha. */
const rotulo = computed(() => {
  const formato = new Intl.DateTimeFormat(tag.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  })
  const texto =
    props.ate && props.ate !== props.dia
      ? `${formato.format(meioDia(props.dia))} – ${formato.format(meioDia(props.ate))}`
      : formato.format(meioDia(props.dia))

  return props.rodape ? `${texto}, ${props.rodape}` : texto
})
</script>

<template>
  <span
    class="folha"
    :class="[`folha--${tamanho}`, { 'folha--periodo': ate && ate !== dia }]"
    role="img"
    :aria-label="rotulo"
  >
    <span class="folha__faixa" aria-hidden="true">{{ faixa }}</span>
    <span class="folha__numero" aria-hidden="true">{{ numero }}</span>
    <span
      v-if="rodape"
      class="folha__rodape"
      :class="{ 'folha__rodape--riscada': riscada }"
      aria-hidden="true"
    >
      <bdi>{{ rodape }}</bdi>
    </span>
  </span>
</template>

<style scoped>
.folha {
  display: inline-grid;
  overflow: hidden;
  width: 4.25rem;
  border: 1px solid var(--linha);
  border-radius: 12px;
  background: var(--superficie);
  grid-template-rows: auto 1fr auto;
  justify-items: center;
  text-align: center;
  flex-shrink: 0;
}

/* A faixa do mês, como numa folhinha: em caixa normal, na tinta da casa. */
.folha__faixa {
  width: 100%;
  padding: 3px 4px;
  background: var(--musgo-fundo);
  color: var(--musgo);
  font-size: 11.5px;
  font-weight: 600;
  line-height: 1.2;
  white-space: nowrap;
}

.folha__numero {
  padding-top: 2px;
  color: var(--tinta);
  font-family: var(--font-dados);
  font-size: 22px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  line-height: 1.15;
}

.folha--periodo .folha__numero {
  font-size: 17px;
  line-height: 1.5;
}

.folha__rodape {
  width: 100%;
  padding: 0 4px 5px;
  color: var(--tinta-2);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  font-weight: 550;
  line-height: 1.2;
  white-space: nowrap;
}

.folha__rodape--riscada {
  color: var(--tinta-3);
  text-decoration: line-through;
  text-decoration-color: var(--atencao-tinta);
  text-decoration-thickness: 1.5px;
}

.folha--lg {
  width: 5.25rem;
  border-radius: 14px;
}

.folha--lg .folha__faixa {
  padding-block: 4px;
  font-size: 12.5px;
}

.folha--lg .folha__numero {
  font-size: 30px;
}

.folha--lg.folha--periodo .folha__numero {
  font-size: 22px;
  line-height: 1.6;
}

.folha--lg .folha__rodape {
  padding-bottom: 6px;
  font-size: 13px;
}
</style>
