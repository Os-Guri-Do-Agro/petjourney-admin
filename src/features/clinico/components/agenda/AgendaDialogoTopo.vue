<script setup lang="ts">
/**
 * O alto dos diálogos da Agenda: o ícone do que se está fazendo, o título e, embaixo, a linha
 * que diz **sobre o quê** — o dia, o paciente, o horário. É o "onde estou" do diálogo: a caixa
 * cobre a grade, e quem foi interrompido por um telefonema precisa reler em que estava mexendo.
 *
 * O `id` vai no título para o `Dialog` apontar o `aria-labelledby` para ele: com o cabeçalho em
 * slot, o PrimeVue apontaria para um título que não existe e a caixa ficaria sem nome.
 */
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    id: string
    titulo: string
    subtitulo?: string
    icone: string
    tom?: 'clinica' | 'atencao' | 'risco'
  }>(),
  { subtitulo: '', tom: 'clinica' },
)

/** O subtítulo costuma ser uma data por extenso, que o `Intl` entrega em minúscula. */
const subtituloComInicial = computed(() =>
  props.subtitulo ? props.subtitulo.charAt(0).toLocaleUpperCase() + props.subtitulo.slice(1) : '',
)
</script>

<template>
  <div class="topo">
    <span class="topo__icone" :class="`topo__icone--${tom}`" aria-hidden="true">
      <i :class="icone" />
    </span>
    <span class="topo__texto">
      <h2 :id="id" class="topo__titulo">{{ titulo }}</h2>
      <span v-if="subtitulo || $slots.default" class="topo__sub">
        <span v-if="subtitulo">{{ subtituloComInicial }}</span>
        <slot />
      </span>
    </span>
  </div>
</template>

<style scoped>
.topo {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 14px;
}

.topo__icone {
  display: grid;
  width: 40px;
  height: 40px;
  flex: none;
  place-items: center;
  border-radius: 12px;
  background: var(--clinica-fundo);
  color: var(--clinica-tinta);
  font-size: 20px;
}

.topo__icone--atencao {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.topo__icone--risco {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.topo__texto {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.topo__titulo {
  margin: 0;
  color: var(--tinta);
  font-family: var(--font-texto);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.3;
}

.topo__sub {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
  color: var(--tinta-2);
  font-size: 13.5px;
  font-weight: 400;
  line-height: 1.4;
}
</style>
