<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { catalogoDiario } from '@/service/parceiro/compartilhamentos-service'
import type { AnotacaoDiario, CatalogoDiario } from '@/service/parceiro/types'
import { CAMPOS_DIARIO_MULTIPLOS, CAMPOS_DIARIO_UNICOS } from '@/utils/parceiro/anotacao-diario'

/** Escolhas do Diário de uma anotação salva, como etiquetas. Sem escolhas, não desenha nada. */
const props = defineProps<{ diario?: AnotacaoDiario | null }>()

const { t } = useI18n()
const catalogo = ref<CatalogoDiario | null>(null)

onMounted(async () => {
  if (!props.diario) return
  catalogo.value = await catalogoDiario().catch(() => null)
})

function rotulo(campo: keyof CatalogoDiario, valor: string) {
  return catalogo.value?.[campo]?.find((o) => o.value === valor)?.label ?? valor
}

const linhas = computed(() => {
  const d = props.diario
  if (!d) return []
  const saida: { campo: string; valores: string[] }[] = []
  for (const campo of [...CAMPOS_DIARIO_UNICOS, ...CAMPOS_DIARIO_MULTIPLOS]) {
    const bruto = d[campo]
    const valores: string[] = Array.isArray(bruto) ? bruto : bruto ? [bruto] : []
    if (valores.length) saida.push({ campo, valores: valores.map((v) => rotulo(campo, v)) })
  }
  return saida
})
</script>

<template>
  <dl v-if="linhas.length" class="diario-view" data-teste="anotacao-diario-view">
    <div v-for="linha in linhas" :key="linha.campo" class="diario-view__linha">
      <dt>{{ t(`acessos.diarioAnotacao.grupos.${linha.campo}`) }}</dt>
      <dd>
        <span v-for="v in linha.valores" :key="v" class="diario-view__tag">{{ v }}</span>
      </dd>
    </div>
  </dl>
</template>

<style scoped>
.diario-view {
  display: grid;
  gap: 6px;
  margin: 8px 0 0;
}

.diario-view__linha {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
}

.diario-view dt {
  min-width: 110px;
  color: var(--tinta-2);
  font-size: 12.5px;
}

.diario-view dd {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin: 0;
}

.diario-view__tag {
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--pj-lugar-fundo, #f5f5f4);
  color: var(--tinta);
  font-size: 12.5px;
}
</style>
