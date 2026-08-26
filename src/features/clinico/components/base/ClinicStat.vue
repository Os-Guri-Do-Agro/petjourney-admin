<script setup lang="ts">
/**
 * Número de resumo.
 *
 * Serve para o topo de uma tela de lista responder, antes da rolagem, a pergunta que a lista
 * inteira responderia depois. Três desses valem mais que trinta linhas — mas só se forem três:
 * uma fileira de oito volta a ser a mesma parede que a tabela era.
 *
 * O tom é escolha de significado, não de decoração: `risco` e `atencao` só entram quando o
 * número é, de fato, um problema.
 */
withDefaults(
  defineProps<{
    rotulo: string
    valor: string
    detalhe?: string
    icone?: string
    tom?: 'neutro' | 'atencao' | 'risco' | 'acento'
  }>(),
  { detalhe: '', icone: '', tom: 'neutro' },
)
</script>

<template>
  <div class="stat" :class="`stat--${tom}`">
    <span v-if="icone" class="stat__icone" aria-hidden="true"><i :class="icone" /></span>

    <span class="stat__corpo">
      <span class="stat__rotulo">{{ rotulo }}</span>
      <strong class="stat__valor clinic-value">{{ valor }}</strong>
      <span v-if="detalhe" class="stat__detalhe">{{ detalhe }}</span>
    </span>
  </div>
</template>

<style scoped>
.stat {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-3);
  min-width: 0;
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
  box-shadow: var(--clinic-shadow-card);
}

.stat__icone {
  display: grid;
  width: 2.2rem;
  height: 2.2rem;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 0.7rem;
  background: var(--clinic-accent-tint);
  color: var(--clinic-muted);
  font-size: 0.85rem;
}

.stat__corpo {
  display: grid;
  min-width: 0;
  gap: 0.05rem;
}

.stat__rotulo {
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.stat__valor {
  font-size: 1.4rem;
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.15;
}

.stat__detalhe {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.stat--acento {
  border-color: var(--clinic-accent-soft);
}

.stat--acento .stat__icone {
  background: var(--clinic-accent-soft);
  color: var(--clinic-accent-strong);
}

.stat--acento .stat__valor {
  color: var(--clinic-accent-strong);
}

.stat--atencao {
  border-color: var(--clinic-attention-line);
}

.stat--atencao .stat__icone {
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
}

.stat--atencao .stat__valor {
  color: var(--clinic-attention-text);
}

.stat--risco {
  border-color: var(--clinic-risk-line);
}

.stat--risco .stat__icone {
  background: var(--clinic-risk-bg);
  color: var(--clinic-risk-text);
}

.stat--risco .stat__valor {
  color: var(--clinic-risk-text);
}
</style>
