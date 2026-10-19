<script setup lang="ts">
/**
 * O alto dos diálogos do atendimento: o ícone do que se está fazendo, o título e, embaixo, a
 * linha que diz **sobre quem** — o paciente e a consulta. O diálogo cobre o prontuário, e quem
 * foi interrompido por um telefonema precisa reler em que estava mexendo.
 *
 * O `id` vai no título para o `Dialog` apontar o `aria-labelledby` para ele: com o cabeçalho em
 * slot, o PrimeVue apontaria para um título que não existe e a caixa ficaria sem nome.
 *
 * Local ao prontuário de propósito: a Agenda tem o seu, e os dois evoluem com as telas deles.
 */
withDefaults(
  defineProps<{
    id: string
    titulo: string
    subtitulo?: string
    icone: string
    tom?: 'clinica' | 'ok' | 'atencao' | 'risco' | 'neutro'
  }>(),
  { subtitulo: '', tom: 'clinica' },
)
</script>

<template>
  <div class="topo">
    <span class="topo__icone" :class="`topo__icone--${tom}`" aria-hidden="true">
      <i :class="icone" />
    </span>
    <span class="topo__texto">
      <h2 :id="id" class="topo__titulo">{{ titulo }}</h2>
      <span v-if="subtitulo" class="topo__sub">{{ subtitulo }}</span>
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
  /* O diálogo vai para o `body`, fora da classe de lugar: a Clínica vai escrita. */
  background: var(--clinica-fundo);
  color: var(--clinica-tinta);
  font-size: 20px;
}

.topo__icone--ok {
  background: var(--ok-fundo);
  color: var(--ok-tinta);
}

.topo__icone--atencao {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.topo__icone--risco {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.topo__icone--neutro {
  background: var(--neutro-fundo);
  color: var(--neutro-tinta);
}

.topo__texto {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.topo__titulo {
  margin: 0;
  color: var(--tinta);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.25;
}

.topo__sub {
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.4;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
