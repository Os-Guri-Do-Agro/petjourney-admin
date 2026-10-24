<script setup lang="ts">
/**
 * O seletor das versões de layout do Hoje, para a equipe comparar na mesma tela.
 *
 * Fica preso no pé, no meio, fora do fluxo da página: nenhuma versão precisa abrir espaço para
 * ele, e trocar de versão não mexe na rolagem de quem está comparando. A escolha vai para a URL
 * (`?versao=`), então um link copiado abre a mesma versão para o colega.
 *
 * É andaime de avaliação: escolhida a versão, sai junto com as outras.
 */
import SelectButton from 'primevue/selectbutton'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

export type VersaoDoMeuDia = 'foco' | 'linha' | 'mesa' | 'atual'

const versao = defineModel<VersaoDoMeuDia>({ required: true })

const { t } = useI18n()

const opcoes = computed(() => [
  { valor: 'foco', rotulo: t('clinico.meuDia.versoes.opcao.foco'), icone: 'ph ph-crosshair' },
  { valor: 'linha', rotulo: t('clinico.meuDia.versoes.opcao.linha'), icone: 'ph ph-list-bullets' },
  { valor: 'mesa', rotulo: t('clinico.meuDia.versoes.opcao.mesa'), icone: 'ph ph-columns' },
  {
    valor: 'atual',
    rotulo: t('clinico.meuDia.versoes.opcao.atual'),
    icone: 'ph ph-clock-counter-clockwise',
  },
])
</script>

<template>
  <div class="versoes" role="group" :aria-label="t('clinico.meuDia.versoes.aria')">
    <span class="versoes__rotulo">
      <i class="ph ph-layout" aria-hidden="true" />
      {{ t('clinico.meuDia.versoes.rotulo') }}
    </span>
    <SelectButton
      v-model="versao"
      :options="opcoes"
      option-label="rotulo"
      option-value="valor"
      :allow-empty="false"
    >
      <template #option="{ option }">
        <i :class="option.icone" aria-hidden="true" />
        <span>{{ option.rotulo }}</span>
      </template>
    </SelectButton>
  </div>
</template>

<style scoped>
/* No canto, ao lado do botão do painel de desenvolvimento: longe da barra lateral e do conteúdo. */
.versoes {
  position: fixed;
  z-index: 40;
  bottom: 18px;
  inset-inline-end: 92px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 6px 6px 16px;
  border: 1px solid var(--linha);
  border-radius: 16px;
  background: var(--superficie);
  box-shadow: var(--sombra-2);
}

.versoes__rotulo {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.versoes__rotulo i {
  font-size: 16px;
}

.versoes :deep(.p-togglebutton-content) {
  white-space: nowrap;
}

/* No tablet sobra pouco ao lado da barra lateral: some o rótulo, ficam os botões. */
@media (max-width: 1180px) {
  .versoes__rotulo {
    display: none;
  }

  .versoes {
    padding-left: 6px;
  }
}
</style>
