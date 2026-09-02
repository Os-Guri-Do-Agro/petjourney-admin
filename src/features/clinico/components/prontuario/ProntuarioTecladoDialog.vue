<script setup lang="ts">
/**
 * Mapa de teclas do prontuário.
 *
 * Sai da mesma tabela que o ouvinte usa, então documentação e comportamento não divergem — o
 * mesmo arranjo do diálogo da agenda.
 *
 * As duas primeiras linhas não vêm da tabela porque não são atalhos globais: `Enter` e os
 * números são comportamento **de campo**, tratados onde o campo está. Continuam aqui porque
 * são o que faz o modo valer a pena, e um mapa que os omitisse esconderia o principal.
 */
import Dialog from 'primevue/dialog'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { TECLAS_DO_PRONTUARIO } from '../../composables/useProntuarioTeclado'

const aberto = defineModel<boolean>('visible', { default: false })

const { t } = useI18n()

const SIMBOLO: Record<string, string> = {
  ArrowLeft: '←',
  ArrowRight: '→',
}

const linhas = computed(() => [
  { chave: 'campoSeguinte', teclas: ['Enter'] },
  { chave: 'escolherOpcao', teclas: ['1', '…', '9'] },
  { chave: 'entreOpcoes', teclas: ['←', '→'] },
  ...TECLAS_DO_PRONTUARIO.map((item) => ({
    chave: item.acao,
    teclas: ['Alt', SIMBOLO[item.tecla] ?? item.tecla.toUpperCase()],
  })),
])
</script>

<template>
  <Dialog
    v-model:visible="aberto"
    modal
    class="clinic-dialog"
    :style="{ width: 'min(26rem, 94vw)' }"
    :header="t('clinico.prontuario.teclado.titulo')"
    :dismissable-mask="true"
  >
    <div class="mapa clinic-scope">
      <p class="mapa__lede">{{ t('clinico.prontuario.teclado.descricao') }}</p>

      <dl class="mapa__lista">
        <div v-for="linha in linhas" :key="linha.chave">
          <dt>{{ t(`clinico.prontuario.teclado.acao.${linha.chave}`) }}</dt>
          <dd>
            <template v-for="(tecla, indice) in linha.teclas" :key="indice">
              <span v-if="tecla === '…'" class="mapa__mais">…</span>
              <kbd v-else>{{ tecla }}</kbd>
            </template>
          </dd>
        </div>
      </dl>
    </div>
  </Dialog>
</template>

<style scoped>
.mapa {
  display: grid;
  gap: var(--clinic-space-3);
}

.mapa__lede {
  margin: 0;
  color: var(--clinic-muted);
  line-height: 1.5;
}

.mapa__lista {
  display: grid;
  gap: 0.15rem;
  margin: 0;
}

.mapa__lista div {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-2) 0;
  border-bottom: 1px solid var(--clinic-line-soft);
}

.mapa__lista div:last-child {
  border-bottom: 0;
}

.mapa__lista dt {
  color: var(--clinic-text);
}

.mapa__lista dd {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  margin: 0;
}

kbd {
  min-width: 1.5rem;
  padding: 0.1rem 0.4rem;
  border: 1px solid var(--clinic-line-strong);
  border-bottom-width: 2px;
  border-radius: 0.3rem;
  background: var(--clinic-surface-soft);
  color: var(--clinic-text);
  font-family: ui-monospace, 'SF Mono', Menlo, monospace;
  font-size: 0.72rem;
  font-weight: 700;
  text-align: center;
}

.mapa__mais {
  color: var(--clinic-faint);
}
</style>
