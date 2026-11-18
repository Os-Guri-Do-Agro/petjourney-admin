<script setup lang="ts">
/**
 * A linha de todas as telas do protótipo: diz, antes de qualquer número, que eles são ilustrativos
 * (uma simulação dos 90 primeiros dias), para ninguém sair da apresentação achando que são medidos.
 * Discreta (o selo e uma frase, sem caixa): é aviso, não assunto. O espaço só aparece no menu
 * enquanto se está numa tela dele (`prototipo.ts`); "Sair do protótipo" volta ao Início, e ele some.
 */
import Button from 'primevue/button'
import { useRouter } from 'vue-router'

import { dataCurta, PERIODO } from '@/features/saude-publica/dados'

/** A frase do aviso, quando a tela simula outro período (o piloto com a Subea). */
defineProps<{ texto?: string }>()

const router = useRouter()

function sair() {
  void router.push('/inicio')
}
</script>

<template>
  <p class="aviso-prototipo" role="note">
    <span class="ui-selo ui-selo--atencao aviso-prototipo__selo">
      <i class="ph ph-flask" aria-hidden="true" />
      Protótipo
    </span>
    <span v-if="texto" class="aviso-prototipo__texto">{{ texto }}</span>
    <span v-else class="aviso-prototipo__texto">
      Dados ilustrativos: simulação dos 90 primeiros dias em Campo Grande ({{
        dataCurta(PERIODO.inicio)
      }}
      a {{ dataCurta(PERIODO.fim) }}). Nenhum tutor é identificado.
    </span>
    <Button
      type="button"
      size="small"
      severity="secondary"
      outlined
      icon="ph ph-sign-out"
      label="Sair do protótipo"
      class="aviso-prototipo__sair"
      @click="sair"
    />
  </p>
</template>

<style scoped>
.aviso-prototipo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px 12px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.aviso-prototipo__selo {
  display: inline-flex;
  flex: none;
  align-items: center;
  gap: 5px;
}

.aviso-prototipo__texto {
  flex: 1 1 20rem;
  min-width: 0;
}

.aviso-prototipo__sair {
  flex: none;
}
</style>
