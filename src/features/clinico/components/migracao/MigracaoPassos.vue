<script setup lang="ts">
/**
 * Onde a pessoa está: três trilhos com nome, o atual em destaque.
 *
 * Só indica, não navega. A primeira versão fazia das etapas botões, e o resultado era uma fileira
 * de coisas clicáveis que ora iam, ora não iam — e diziam por quê só no título do botão. Voltar
 * agora é sempre a pílula "Voltar" no rodapé de cada etapa.
 *
 * As colunas não têm trilho: o sistema as liga sozinho, e o que ele não acha vira pergunta. Quando
 * não sobra pergunta nenhuma, o trilho das dúvidas diz isso ("Nenhuma dúvida") em vez de parecer
 * pulado.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import type { EtapaDaMigracao } from '../../stores/migracao'

const props = defineProps<{ etapa: EtapaDaMigracao; semDuvidas?: boolean }>()

const { t } = useI18n()

const ETAPAS: EtapaDaMigracao[] = ['arquivo', 'duvidas', 'importar']

const atual = computed(() => ETAPAS.indexOf(props.etapa))
</script>

<template>
  <ol class="passos" :aria-label="t('clinico.migracao.passos.aria')">
    <li
      v-for="(etapa, indice) in ETAPAS"
      :key="etapa"
      class="passo"
      :class="{ 'passo--feito': indice < atual, 'passo--atual': indice === atual }"
      :aria-current="indice === atual ? 'step' : undefined"
    >
      <span class="passo__trilho" aria-hidden="true" />
      <span class="passo__rotulo">
        <span class="passo__numero" aria-hidden="true">
          <i v-if="indice < atual" class="pi pi-check" />
          <template v-else>{{ indice + 1 }}</template>
        </span>
        {{
          etapa === 'duvidas' && semDuvidas && indice < atual
            ? t('clinico.migracao.passos.semDuvidas')
            : t(`clinico.migracao.passos.${etapa}`)
        }}
      </span>
    </li>
  </ol>
</template>

<style scoped>
.passos {
  display: grid;
  margin: 0;
  padding: 0;
  gap: 0.6rem;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  list-style: none;
}

.passo {
  display: grid;
  gap: 0.55rem;
}

.passo__trilho {
  height: 0.35rem;
  border-radius: 999px;
  background: var(--hc-borda);
}

.passo--feito .passo__trilho {
  background: var(--hc-marca);
}

.passo--atual .passo__trilho {
  background: var(--hc-degrade-botao);
}

.passo__rotulo {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  color: var(--hc-tinta-3);
  font-size: 0.875rem;
  font-weight: 600;
  gap: 0.45rem;
}

.passo--feito .passo__rotulo {
  color: var(--hc-tinta-2);
}

.passo--atual .passo__rotulo {
  color: var(--hc-tinta);
  font-weight: 700;
}

.passo__numero {
  display: inline-grid;
  width: 1.4rem;
  height: 1.4rem;
  flex: none;
  border: 1px solid var(--hc-borda);
  border-radius: 999px;
  background: var(--hc-cartao);
  font-size: 0.75rem;
  place-items: center;
}

.passo--feito .passo__numero {
  border-color: var(--hc-marca);
  color: var(--hc-marca);
}

.passo--atual .passo__numero {
  border-color: transparent;
  background: var(--hc-degrade-botao);
  color: #ffffff;
}

.passo__numero .pi {
  font-size: 0.6rem;
}
</style>
