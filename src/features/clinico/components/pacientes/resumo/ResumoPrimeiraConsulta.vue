<script setup lang="ts">
/**
 * O vazio útil: paciente que nunca passou pela clínica e cujo responsável ainda não abriu o app.
 *
 * Uma tela em branco diria "nada a ver aqui" — e há muito a fazer. Em vez do vazio, a lista do
 * que esta primeira consulta precisa levantar, montada a partir do pouco que o cadastro já
 * sabe: sem peso, pesar; filhote, perguntar origem e desmame. O último item é o que faz a
 * próxima abertura desta tela não ser vazia.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { Pet } from '../../../data/types'
import { faixaEtariaDoPaciente } from '../../../domain/porte'
import { clinicClock } from '../../../stores/clinico'

const props = defineProps<{
  pet: Pet
}>()

const { t } = useI18n()

const itens = computed(() => {
  const filhote = faixaEtariaDoPaciente(props.pet, clinicClock.today()) === 'filhote'

  return [
    props.pet.pesoKg === null ? 'pesar' : '',
    'vacinas',
    filhote ? 'filhote' : '',
    'antecedentes',
    'diario',
  ].filter(Boolean)
})
</script>

<template>
  <section class="primeira" aria-labelledby="primeira-titulo">
    <h2 id="primeira-titulo" class="primeira__titulo">
      {{ t('clinico.resumoDoPaciente.primeira.titulo') }}
    </h2>
    <p class="primeira__descricao">{{ t('clinico.resumoDoPaciente.primeira.descricao') }}</p>

    <ol class="primeira__lista">
      <li v-for="item in itens" :key="item">
        <strong>{{ t(`clinico.resumoDoPaciente.primeira.${item}.titulo`) }}</strong>
        <span>{{ t(`clinico.resumoDoPaciente.primeira.${item}.detalhe`) }}</span>
      </li>
    </ol>
  </section>
</template>

<style scoped>
.primeira {
  display: grid;
  gap: var(--clinic-space-2);
  padding: var(--clinic-space-3) var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
}

.primeira__titulo {
  margin: 0;
  font-size: var(--clinic-font-title);
  font-weight: 700;
}

.primeira__descricao {
  margin: 0;
  color: var(--clinic-muted);
}

.primeira__lista {
  display: grid;
  margin: 0;
  padding: 0;
  counter-reset: item;
  list-style: none;
}

.primeira__lista li {
  display: grid;
  grid-template-columns: 1.75rem minmax(0, 1fr);
  column-gap: var(--clinic-space-2);
  padding-block: var(--clinic-space-2);
  border-top: 1px solid var(--clinic-line-soft);
  counter-increment: item;
}

.primeira__lista li::before {
  grid-row: span 2;
  color: var(--clinic-accent-strong);
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  content: counter(item) '.';
}

.primeira__lista strong {
  font-weight: 700;
}

.primeira__lista span {
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}
</style>
