<script setup lang="ts">
/**
 * Avisos de conflito de um horário: um selo com a palavra e a frase ao lado.
 *
 * A palavra ("Sala ocupada", "Almoço") é o que se lê de relance e decide a conversa; a frase diz
 * com quem e por quanto tempo. Cor e palavra andam juntas: o impedimento em risco, o aviso em
 * atenção e o que é só informação no neutro.
 *
 * Mora aqui porque a criação, a edição e a confirmação de remarcação mostram a mesma lista — três
 * desenhos para o mesmo aviso fariam parecer três avisos diferentes.
 */
import { useI18n } from 'vue-i18n'

import { useClinicFormat } from '../../composables/useClinicFormat'
import type { Conflict, ConflictSeverity } from '../../data/types'

defineProps<{ conflitos: Conflict[] }>()

const { t } = useI18n()
const formato = useClinicFormat()

const TOM: Record<ConflictSeverity, { selo: string; icone: string }> = {
  blocking: { selo: 'ui-selo--risco', icone: 'ph ph-prohibit' },
  warning: { selo: 'ui-selo--atencao', icone: 'ph ph-warning-circle' },
  info: { selo: '', icone: 'ph ph-info' },
}
</script>

<template>
  <ul v-if="conflitos.length > 0" class="avisos" :aria-label="t('clinico.agenda.conflitosTitulo')">
    <li v-for="(conflito, indice) in conflitos" :key="`${conflito.kind}-${indice}`" class="aviso">
      <span class="ui-selo aviso__selo" :class="TOM[conflito.severity].selo">
        <i :class="TOM[conflito.severity].icone" aria-hidden="true" />
        {{ t(`clinico.agenda.aviso.${conflito.kind}`) }}
      </span>
      <span class="aviso__texto">{{ formato.conflito(conflito) }}</span>
    </li>
  </ul>
</template>

<style scoped>
/* Selo numa coluna, frase na outra: as frases começam todas na mesma linha vertical. */
.avisos {
  display: grid;
  gap: 10px 12px;
  margin: 0;
  padding: 0;
  grid-template-columns: max-content minmax(0, 1fr);
  list-style: none;
}

.aviso {
  display: grid;
  align-items: start;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
}

.aviso__texto {
  min-width: 0;
  padding-top: 3px;
  color: var(--tinta);
  font-size: 13.5px;
  line-height: 1.45;
}

@media (max-width: 520px) {
  .avisos {
    grid-template-columns: minmax(0, 1fr);
  }

  .aviso {
    gap: 4px;
  }

  .aviso__selo {
    justify-self: start;
  }
}
</style>
