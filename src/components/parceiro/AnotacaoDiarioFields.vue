<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import { catalogoDiario } from '@/service/parceiro/compartilhamentos-service'
import type {
  AnotacaoDiarioInput,
  CatalogoDiario,
  OpcaoDiario,
  TipoServicoPrestador,
} from '@/service/parceiro/types'
import {
  CAMPOS_DIARIO_MULTIPLOS,
  camposDiarioDoTipo,
  type CampoDiario,
} from '@/utils/parceiro/anotacao-diario'

/**
 * Escolhas do Diário do pet na anotação (hotel, banho e tosa): as mesmas opções do Diário
 * do app, vindas do catálogo da API. Tocar de novo numa escolha desmarca.
 */
const props = defineProps<{ tipoServico: TipoServicoPrestador; disabled?: boolean }>()
const modelo = defineModel<AnotacaoDiarioInput>({ required: true })

const { t } = useI18n()

const catalogo = ref<CatalogoDiario | null>(null)
const falhou = ref(false)

onMounted(async () => {
  try {
    catalogo.value = await catalogoDiario()
  } catch {
    falhou.value = true
  }
})

const grupos = computed(() =>
  camposDiarioDoTipo(props.tipoServico).map((campo) => ({
    campo,
    multiplo: (CAMPOS_DIARIO_MULTIPLOS as readonly string[]).includes(campo),
    opcoes: (catalogo.value?.[campo] ?? []) as OpcaoDiario[],
  })),
)

function marcado(campo: CampoDiario, valor: string) {
  const atual = modelo.value[campo]
  return Array.isArray(atual) ? atual.includes(valor) : atual === valor
}

function alternar(campo: CampoDiario, valor: string, multiplo: boolean) {
  const proximo: Record<string, unknown> = { ...modelo.value }
  if (multiplo) {
    const lista = new Set((proximo[campo] as string[] | undefined) ?? [])
    if (lista.has(valor)) lista.delete(valor)
    else lista.add(valor)
    proximo[campo] = [...lista]
  } else {
    proximo[campo] = proximo[campo] === valor ? undefined : valor
  }
  modelo.value = proximo as AnotacaoDiarioInput
}
</script>

<template>
  <div class="folha__secao diario" data-teste="anotacao-diario">
    <h3 class="folha__subtitulo diario__titulo">
      <i class="ph ph-notebook" aria-hidden="true" />
      {{ t('acessos.diarioAnotacao.titulo') }}
    </h3>
    <p class="diario__ajuda">{{ t('acessos.diarioAnotacao.ajuda') }}</p>

    <p v-if="falhou" class="diario__ajuda" role="status">{{ t('acessos.diarioAnotacao.indisponivel') }}</p>
    <p v-else-if="!catalogo" class="diario__ajuda" role="status">
      {{ t('acessos.diarioAnotacao.carregando') }}
    </p>

    <template v-else>
      <fieldset v-for="grupo in grupos" :key="grupo.campo" class="diario__grupo">
        <legend class="diario__legenda">
          {{ t(`acessos.diarioAnotacao.grupos.${grupo.campo}`) }}
          <small v-if="grupo.multiplo">{{ t('acessos.diarioAnotacao.variasOpcoes') }}</small>
        </legend>
        <div class="diario__chips">
          <button
            v-for="opcao in grupo.opcoes"
            :key="opcao.value"
            type="button"
            class="diario__chip"
            :class="{ 'diario__chip--on': marcado(grupo.campo, opcao.value) }"
            :aria-pressed="marcado(grupo.campo, opcao.value)"
            :disabled="disabled"
            :data-valor="`${grupo.campo}:${opcao.value}`"
            @click="alternar(grupo.campo, opcao.value, grupo.multiplo)"
          >
            <i v-if="marcado(grupo.campo, opcao.value)" class="ph ph-check" aria-hidden="true" />
            {{ opcao.label }}
          </button>
        </div>
      </fieldset>
    </template>
  </div>
</template>

<style scoped>
.diario {
  display: grid;
  gap: 12px;
}

.diario__titulo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0;
  font-size: 15.5px;
  font-weight: 600;
}

.diario__ajuda {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.diario__grupo {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
  border: 0;
}

.diario__legenda {
  padding: 0;
  margin-bottom: 6px;
  color: var(--tinta);
  font-size: 13.5px;
  font-weight: 600;
}

.diario__legenda small {
  margin-left: 6px;
  color: var(--tinta-2);
  font-weight: 400;
}

.diario__chips {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.diario__chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  padding: 4px 12px;
  border: 1px solid var(--folha-fio, #d6d3d1);
  border-radius: 999px;
  background: transparent;
  color: var(--tinta);
  font: inherit;
  font-size: 13px;
  cursor: pointer;
}

.diario__chip:hover:not(:disabled) {
  border-color: var(--hotel-tinta, currentColor);
}

.diario__chip:focus-visible {
  outline: 2px solid var(--hotel-tinta, currentColor);
  outline-offset: 2px;
}

.diario__chip--on {
  border-color: var(--hotel-tinta, currentColor);
  background: var(--pj-lugar-fundo, #f5f5f4);
  font-weight: 600;
}

.diario__chip:disabled {
  cursor: default;
  opacity: 0.6;
}
</style>
