<script setup lang="ts">
/**
 * Chip de alerta clínico — da família do selo do kit (`ui-selo`).
 *
 * Mesma peça que diz "Urgente" na pauta: 24 px, raio 7, ícone e palavra, no par de cor do estado
 * (risco, atenção, neutro). Cor sozinha não carrega informação aqui: cada severidade tem ícone
 * próprio, para que em escala de cinza — ou para quem não distingue vermelho de verde — "risco"
 * continue diferente de "atenção". O texto sempre acompanha; chip sem rótulo é enfeite.
 */
import { computed } from 'vue'

import type { AlertSeverity } from '../../data/types'

const props = withDefaults(
  defineProps<{
    severidade: AlertSeverity
    rotulo: string
    detalhe?: string
    /** Só o ícone, com o rótulo no `title` — para grades muito estreitas. */
    compacto?: boolean
    icone?: string
  }>(),
  { detalhe: '', compacto: false, icone: '' },
)

const iconePorSeveridade: Record<AlertSeverity, string> = {
  risco: 'ph ph-warning',
  atencao: 'ph ph-warning-circle',
  info: 'ph ph-info',
}

/** O par de cor do selo: informação é o neutro do kit. */
const TOM: Record<AlertSeverity, 'risco' | 'atencao' | 'neutro'> = {
  risco: 'risco',
  atencao: 'atencao',
  info: 'neutro',
}

const icone = computed(() => props.icone || iconePorSeveridade[props.severidade])
const titulo = computed(() => (props.detalhe ? `${props.rotulo}: ${props.detalhe}` : props.rotulo))
</script>

<template>
  <span
    class="chip"
    :class="[`chip--${severidade}`, `chip--tom-${TOM[severidade]}`, { 'chip--compacto': compacto }]"
    :title="titulo"
  >
    <i :class="icone" aria-hidden="true" />
    <!--
      Rótulo e detalhe são **um texto só**: a reticência, quando falta espaço, corta o fim da
      frase (e não a frase inteira), e quem precisa do selo inteiro (o cabeçalho do paciente)
      deixa esse texto quebrar linha ao lado do ícone.
    -->
    <span v-if="!compacto" class="chip__texto">
      <span class="chip__rotulo">{{ rotulo }}<template v-if="detalhe">:</template></span>
      <template v-if="detalhe">
        {{ ' ' }}<span class="chip__detalhe">{{ detalhe }}</span>
      </template>
    </span>
    <span v-else class="sr-only">{{ titulo }}</span>
  </span>
</template>

<style scoped>
.chip {
  display: inline-flex;
  min-width: 0;
  max-width: 100%;
  height: 24px;
  flex: none;
  align-items: center;
  gap: 5px;
  padding: 0 9px;
  border-radius: 7px;
  background: var(--neutro-fundo);
  color: var(--neutro-tinta);
  font-family: var(--font-texto);
  font-size: 12.5px;
  font-weight: 600;
  line-height: 1;
  white-space: nowrap;
}

.chip i {
  flex: 0 0 auto;
  font-size: 14px;
}

.chip--compacto {
  width: 24px;
  justify-content: center;
  padding: 0;
}

/* Altura de linha cheia: o corte do `overflow` não pode comer a perna do "p" de "Dipirona". */
.chip__texto {
  min-width: 0;
  overflow: hidden;
  line-height: 1.4;
  text-overflow: ellipsis;
}

/* O detalhe é o nome do que se trata ("Dipirona"): um peso abaixo do rótulo. */
.chip__detalhe {
  font-weight: 500;
}

.chip--tom-risco {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.chip--tom-atencao {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.chip--tom-neutro {
  background: var(--neutro-fundo);
  color: var(--neutro-tinta);
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
}
</style>
