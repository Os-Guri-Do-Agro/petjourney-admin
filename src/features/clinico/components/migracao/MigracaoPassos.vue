<script setup lang="ts">
/**
 * Onde a pessoa está: três passos numerados, o atual aceso.
 *
 * O número existe porque a ordem é de verdade — não dá para ver o resumo antes de abrir o arquivo.
 * Passo feito troca o número pelo visto; o fio entre dois passos acende quando o da esquerda acaba.
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
      <span class="passo__numero ui-num" aria-hidden="true">
        <i v-if="indice < atual" class="ph ph-check" />
        <template v-else>{{ indice + 1 }}</template>
      </span>
      <span class="passo__rotulo">
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
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.passo {
  display: flex;
  min-width: 0;
  flex: 1 1 0;
  align-items: center;
  gap: 10px;
}

.passo:last-child {
  flex: 0 0 auto;
}

/* O fio até o próximo passo: ocupa o resto da largura, e acende quando este passo acaba. */
.passo:not(:last-child)::after {
  height: 2px;
  min-width: 24px;
  flex: 1 1 auto;
  margin-inline-start: 4px;
  border-radius: 2px;
  background: var(--linha-forte);
  content: '';
}

.passo--feito:not(:last-child)::after {
  background: var(--musgo);
}

.passo__numero {
  display: grid;
  width: 30px;
  height: 30px;
  flex: none;
  place-items: center;
  border: 1.5px solid var(--linha-forte);
  border-radius: 50%;
  background: var(--superficie);
  color: var(--tinta-2);
  font-size: 13.5px;
  font-weight: 650;
}

.passo--feito .passo__numero {
  border-color: transparent;
  background: var(--musgo-fundo);
  color: var(--musgo);
}

.passo--atual .passo__numero {
  border-color: transparent;
  background: var(--musgo);
  color: var(--sobre-musgo);
}

.passo__numero .ph {
  font-size: 15px;
}

.passo__rotulo {
  overflow: hidden;
  color: var(--tinta-2);
  font-size: 14.5px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.passo--atual .passo__rotulo {
  color: var(--tinta);
  font-weight: 600;
}

@media (max-width: 560px) {
  .passos {
    gap: 8px;
  }

  .passo:not(:last-child)::after {
    min-width: 12px;
  }

  /* No celular só o passo atual diz o nome: os outros são o número, e o fio diz a ordem. */
  .passo:not(.passo--atual) .passo__rotulo {
    position: absolute;
    overflow: hidden;
    width: 1px;
    height: 1px;
    clip-path: inset(50%);
  }
}
</style>
