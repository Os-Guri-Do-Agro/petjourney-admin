<script setup lang="ts">
/**
 * A lista do que pede ação: uma linha por assunto, da mais grave para a menos, cada uma levando à
 * tela onde ele se resolve.
 *
 * A gravidade aparece duas vezes, de propósito: na marca da borda (para quem passa os olhos) e no
 * selo com a palavra (para quem lê e para quem não distingue a cor).
 */
import Button from 'primevue/button'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { RouterLink } from 'vue-router'

import type { LinhaDaTabela } from '@/components/home/pauta-tabela'
import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

const props = withDefaults(defineProps<{ linhas: LinhaDaTabela[]; limite?: number }>(), {
  limite: 6,
})

const { t } = useI18n()
const aberta = ref(false)

const visiveis = computed(() =>
  aberta.value ? props.linhas : props.linhas.slice(0, props.limite),
)
const escondidas = computed(() => Math.max(0, props.linhas.length - props.limite))

const ICONE_DO_TOM = { risco: 'ph ph-warning-octagon', atencao: 'ph ph-warning', neutro: 'ph ph-info' }
</script>

<template>
  <div class="pauta">
    <ul class="ui-lista ui-folha">
      <li v-for="linha in visiveis" :key="linha.id">
        <RouterLink class="ui-linha ui-marca pauta__linha" :class="`ui-marca--${linha.tom}`" :to="linha.to">
          <PetAvatar
            v-if="linha.pet"
            :nome="linha.pet.nome"
            :iniciais="linha.pet.iniciais"
            :especie="linha.pet.especie ?? null"
            :foto-url="linha.pet.fotoUrl ?? ''"
            tamanho="md"
          />
          <span v-else class="pauta__sem-rosto" aria-hidden="true"><i class="ph ph-stack" /></span>

          <span class="ui-linha__texto">
            <span class="ui-linha__titulo">{{ linha.frase }}</span>
            <span v-if="linha.detalhe" class="ui-linha__meta">{{ linha.detalhe }}</span>
          </span>

          <span class="ui-linha__fim">
            <span class="ui-selo" :class="`ui-selo--${linha.tom}`">
              <i :class="ICONE_DO_TOM[linha.tom]" aria-hidden="true" />
              {{ t(`inicio.pauta.gravidade.${linha.tom}`) }}
            </span>
            <span class="pauta__onde">{{ linha.onde }}</span>
            <i class="ph ph-caret-right ui-linha__seta" aria-hidden="true" />
          </span>
        </RouterLink>
      </li>
    </ul>

    <Button
      v-if="escondidas > 0"
      type="button"
      class="pauta__mais"
      severity="secondary"
      text
      :icon="aberta ? 'ph ph-caret-up' : 'ph ph-caret-down'"
      :label="
        aberta
          ? t('clinico.meuDia.pauta.mostrarMenos')
          : t('clinico.meuDia.pauta.mostrarMais', { total: escondidas })
      "
      :aria-expanded="aberta"
      @click="aberta = !aberta"
    />
  </div>
</template>

<style scoped>
.pauta {
  display: grid;
  justify-items: start;
  gap: 8px;
}

.pauta > .ui-lista {
  width: 100%;
}

.pauta__linha {
  padding-left: 20px;
}

.pauta__sem-rosto {
  display: grid;
  width: 36px;
  height: 36px;
  flex: none;
  place-items: center;
  border-radius: 50%;
  background: var(--superficie-3);
  color: var(--tinta-2);
  font-size: 17px;
}

.pauta__onde {
  min-width: 96px;
  color: var(--tinta-2);
  font-size: 13px;
  text-align: right;
}

@media (max-width: 720px) {
  .pauta__onde {
    display: none;
  }

  .pauta__linha {
    align-items: flex-start;
  }
}
</style>
