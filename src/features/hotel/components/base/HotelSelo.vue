<script setup lang="ts">
/**
 * Selo de estado.
 *
 * O tom é escolha de significado, não de decoração. E ele **nunca é a única diferença**: cada
 * degrau sobe também um canal de forma — neutro sem moldura, atenção com moldura âmbar, risco com
 * moldura, peso e cor cheia. Em escala de cinza, ou para quem não distingue vermelho de âmbar, a
 * diferença entre "vence durante" e "vencido" continua de pé.
 *
 * O ícone é opcional e sempre decorativo: a palavra é a informação, e um selo que dependa do
 * ícone para ser lido é um selo que o leitor de tela não entrega.
 */
withDefaults(
  defineProps<{
    rotulo: string
    tom?: 'neutro' | 'atencao' | 'risco' | 'acento' | 'positivo'
    icone?: string
    /** Some a moldura: para quando o selo já vive dentro de um bloco com borda própria. */
    plano?: boolean
  }>(),
  { tom: 'neutro', icone: '', plano: false },
)
</script>

<template>
  <span class="selo" :class="[`selo--${tom}`, { 'selo--plano': plano }]">
    <i v-if="icone" :class="icone" aria-hidden="true" />
    {{ rotulo }}
  </span>
</template>

<style scoped>
.selo {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.12rem 0.5rem;
  border: 1px solid transparent;
  border-radius: 999px;
  background: var(--clinic-surface-soft);
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  white-space: nowrap;
}

.selo i {
  font-size: 0.7em;
}

.selo--plano {
  padding-inline: 0;
  border-color: transparent;
  background: transparent;
}

.selo--acento {
  border-color: var(--clinic-accent-soft);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
}

.selo--positivo {
  border-color: var(--clinic-accent-soft);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
}

.selo--atencao {
  border-color: var(--clinic-attention-line);
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
}

.selo--risco {
  border-color: var(--clinic-risk-line);
  background: var(--clinic-risk-bg);
  color: var(--clinic-risk-text);
  font-weight: 800;
}
</style>
