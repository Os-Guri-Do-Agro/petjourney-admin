<script setup lang="ts">
/**
 * As funções de uma pessoa da equipe na clínica ou no hotel (E1-03), numa gaveta ao lado da lista.
 *
 * Cada função diz o que abre, porque a escolha muda o menu dela: recepção vê agenda e pacientes,
 * enfermagem vê vacinas e internação, quem não tem função nenhuma vê só o portal comercial. A
 * matriz é da API; o texto aqui só traduz o que ela libera.
 */
import Button from 'primevue/button'
import Checkbox from 'primevue/checkbox'
import Drawer from 'primevue/drawer'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSidePanelOffset } from '@/composables/useSidePanelOffset'
import { useTelaLarga } from '@/composables/useTelaLarga'
import { isRTLLocale, type Locale } from '@/i18n/locales'
import type { PapelOperacional } from '@/service/parceiro/equipe-service'

const props = defineProps<{
  nome: string
  atuais: PapelOperacional[]
  salvando: boolean
  erro: Error | null
}>()

const emit = defineEmits<{ salvar: [papeis: PapelOperacional[]] }>()

const visible = defineModel<boolean>('visible', { default: false })

const LARGURA = '26.5rem'

/** Na ordem em que a casa costuma pensar: o balcão, o consultório, o hotel e a gestão. */
const FUNCOES: PapelOperacional[] = [
  'RECEPCAO',
  'VETERINARIO',
  'ENFERMAGEM',
  'CUIDADOR',
  'BANHISTA',
  'ADESTRADOR',
  'GESTOR',
  'FINANCEIRO',
]

const { t, locale } = useI18n()
const telaLarga = useTelaLarga()

useSidePanelOffset(
  computed(() => visible.value && telaLarga.value),
  LARGURA,
)

const drawerPosition = computed(() => (isRTLLocale(locale.value as Locale) ? 'left' : 'right'))
const escolhidas = ref<PapelOperacional[]>([])

watch(visible, (aberta) => {
  if (aberta) {
    escolhidas.value = [...props.atuais]
  }
})
</script>

<template>
  <Drawer
    v-model:visible="visible"
    :position="drawerPosition"
    :modal="false"
    :dismissable="false"
    :block-scroll="false"
    class="funcoes-gaveta"
    :style="{ width: `min(${LARGURA}, 100vw)` }"
  >
    <template #header>
      <h2 class="fg-titulo">
        <span class="ui-ladrilho ui-ladrilho--lugar" aria-hidden="true">
          <i class="ph ph-identification-badge" />
        </span>
        <span>
          {{ t('parceiro.equipe.funcoes.titulo') }}
          <small>{{ nome }}</small>
        </span>
      </h2>
    </template>

    <form id="funcoes-equipe" class="fg" novalidate @submit.prevent="emit('salvar', escolhidas)">
      <p class="fg__lede">{{ t('parceiro.equipe.funcoes.lede') }}</p>

      <fieldset class="fg__lista">
        <legend class="fg__invisivel">{{ t('parceiro.equipe.funcoes.titulo') }}</legend>
        <label
          v-for="funcao in FUNCOES"
          :key="funcao"
          class="fg__opcao"
          :class="{ 'fg__opcao--ativa': escolhidas.includes(funcao) }"
        >
          <Checkbox
            v-model="escolhidas"
            :input-id="`funcao-${funcao}`"
            name="funcoes"
            :value="funcao"
            :disabled="salvando"
          />
          <span class="fg__texto">
            <strong>{{ t(`parceiro.equipe.funcao.${funcao}`) }}</strong>
            <small>{{ t(`parceiro.equipe.funcaoDica.${funcao}`) }}</small>
          </span>
        </label>
      </fieldset>

      <p v-if="!escolhidas.length" class="fg__nota">
        <i class="ph ph-info" aria-hidden="true" />
        {{ t('parceiro.equipe.funcoes.nenhuma') }}
      </p>

      <p v-if="erro" class="fg__erro" role="alert">
        <i class="ph ph-warning-circle" aria-hidden="true" />
        {{ erro.message }}
      </p>
    </form>

    <template #footer>
      <div class="fg__pe">
        <Button
          type="button"
          :label="t('parceiro.equipe.gaveta.cancelar')"
          severity="secondary"
          outlined
          :disabled="salvando"
          @click="visible = false"
        />
        <Button
          type="submit"
          form="funcoes-equipe"
          icon="ph ph-check"
          :label="t('parceiro.equipe.funcoes.salvar')"
          :loading="salvando"
        />
      </div>
    </template>
  </Drawer>
</template>

<style scoped>
.fg-titulo {
  display: inline-flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  color: var(--tinta);
  font-size: 18px;
  font-weight: 650;
  letter-spacing: -0.01em;
}

.fg-titulo > span:last-child {
  display: grid;
}

.fg-titulo small {
  color: var(--tinta-2);
  font-size: 13.5px;
  font-weight: 500;
  letter-spacing: 0;
}

.fg {
  display: grid;
  gap: 18px;
  padding-bottom: 8px;
}

.fg__lede {
  margin: 0;
  color: var(--tinta-2);
  font-size: 14px;
  line-height: 1.5;
}

.fg__lista {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  border: 0;
}

.fg__invisivel {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

.fg__opcao {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid var(--linha);
  border-radius: 14px;
  background: var(--superficie);
  cursor: pointer;
}

.fg__opcao:hover {
  border-color: var(--linha-forte);
}

.fg__opcao--ativa,
.fg__opcao--ativa:hover {
  border-color: var(--musgo);
  box-shadow: 0 0 0 1px var(--musgo);
}

.fg__opcao:has(.p-checkbox-input:focus-visible) {
  outline: 2px solid var(--musgo);
  outline-offset: 3px;
}

.fg__opcao :deep(.p-checkbox) {
  flex: none;
  margin-top: 2px;
}

.fg__texto {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.fg__texto strong {
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
}

.fg__texto small {
  color: var(--tinta-2);
  font-size: 13px;
  line-height: 1.45;
}

.fg__nota,
.fg__erro {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  color: var(--tinta);
  font-size: 13.5px;
  line-height: 1.5;
}

.fg__nota i {
  margin-top: 2px;
  color: var(--tinta-3);
  font-size: 16px;
}

.fg__erro i {
  margin-top: 2px;
  color: var(--risco-tinta);
  font-size: 16px;
}

.fg__pe {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>
