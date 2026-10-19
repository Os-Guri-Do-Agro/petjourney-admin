<script setup lang="ts">
/**
 * Número de resumo.
 *
 * Serve para o topo de uma tela de lista responder, antes da rolagem, a pergunta que a lista
 * inteira responderia depois. Três desses valem mais que trinta linhas — mas só se forem três:
 * uma fileira de oito volta a ser a mesma parede que a tabela era.
 *
 * O tom é escolha de significado, não de decoração: `risco` e `atencao` só entram quando o
 * número é, de fato, um problema — e aí pintam o número e o disco do ícone, nunca a borda: a
 * folha continua igual às outras, e o que muda é o que se lê.
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
      <strong class="stat__valor ui-num clinic-value">{{ valor }}</strong>
      <span v-if="detalhe" class="stat__detalhe">{{ detalhe }}</span>
    </span>
  </div>
</template>

<style scoped>
.stat {
  display: flex;
  min-width: 0;
  align-items: flex-start;
  gap: 14px;
  padding: 16px 18px;
  border: 1px solid var(--linha);
  border-radius: 16px;
  background: var(--superficie);
  color: var(--tinta);
}

.stat__icone {
  display: grid;
  width: 40px;
  height: 40px;
  flex: 0 0 auto;
  place-items: center;
  border-radius: 12px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 20px;
}

.stat__corpo {
  display: grid;
  min-width: 0;
  gap: 4px;
}

/* `.stat .stat__rotulo` vence a regra global antiga de `.hc-tema .stat__rotulo`. */
.stat .stat__rotulo {
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 500;
  letter-spacing: 0;
  line-height: 1.35;
  text-transform: none;
}

.stat .stat__valor {
  color: var(--tinta);
  font-family: var(--font-dados);
  font-size: 26px;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1.1;
}

.stat__detalhe {
  color: var(--tinta-2);
  font-size: 12.5px;
  line-height: 1.4;
}

.stat--acento .stat__icone {
  background: var(--pj-lugar-fundo, var(--musgo-fundo));
  color: var(--pj-lugar-tinta, var(--musgo));
}

.stat--atencao .stat__icone {
  background: var(--atencao-fundo);
  color: var(--atencao-tinta);
}

.stat--atencao .stat__valor {
  color: var(--atencao-tinta);
}

.stat--risco .stat__icone {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

.stat--risco .stat__valor {
  color: var(--risco-tinta);
}
</style>
