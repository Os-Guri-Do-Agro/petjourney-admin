<script setup lang="ts">
/**
 * Diagnóstico.
 *
 * A busca é por código **ou** descrição, porque quem digita "GE-01" e quem digita
 * "gastroenterite" estão procurando a mesma coisa. O tipo (presuntivo, definitivo,
 * diferencial) fica editável depois de adicionado: o diagnóstico muda de estatuto ao longo da
 * consulta, e obrigar a remover e readicionar seria fricção sem motivo.
 *
 * ## A forma (redesenho total, 19/10/2026)
 *
 * Em cima, o que já foi registrado: uma lista do kit, uma linha por diagnóstico — o código em
 * selo de algarismos iguais, a descrição em destaque, o tipo e o remover na ponta. Embaixo, a
 * busca e as sugestões como linhas inteiras clicáveis, com "Adicionar" escrito.
 */
import Button from 'primevue/button'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed, nextTick, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicForm from '../base/ClinicForm.vue'
import type { Diagnosis, DiagnosisKind } from '../../data/types'
import { useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  valor: Diagnosis[]
  somenteLeitura: boolean
  motivoLeitura: string
}>()

const emit = defineEmits<{ atualizar: [patch: { diagnosticos: Diagnosis[] }] }>()

const { t } = useI18n()
const clinico = useClinicoStore()

const termo = ref('')

const TIPOS: DiagnosisKind[] = ['presuntivo', 'definitivo', 'diferencial']

const opcoesTipo = computed(() =>
  TIPOS.map((valor) => ({ valor, rotulo: t(`clinico.prontuario.diagnostico.tipo.${valor}`) })),
)

const jaAdicionados = computed(() => new Set(props.valor.map((item) => item.codigo)))

const sugestoes = computed(() => {
  const alvo = termo.value.trim().toLowerCase()

  return clinico.diagnosticos
    .filter((item) => !jaAdicionados.value.has(item.codigo))
    .filter(
      (item) =>
        !alvo ||
        item.descricao.toLowerCase().includes(alvo) ||
        item.codigo.toLowerCase().includes(alvo),
    )
    .slice(0, 6)
})

const campoDeBusca = ref<{ $el: HTMLElement } | null>(null)

function adicionar(codigo: string, descricao: string) {
  emit('atualizar', {
    diagnosticos: [
      ...props.valor,
      { id: `diag-${codigo}-${props.valor.length}`, codigo, descricao, kind: 'presuntivo' },
    ],
  })
  termo.value = ''

  /*
   * A sugestão clicada sai da lista e levava o foco junto (ia para o início da página): quem
   * adiciona pelo teclado volta para a busca, pronto para o próximo diagnóstico.
   */
  void nextTick(() => campoDeBusca.value?.$el.focus())
}

function remover(id: string) {
  emit('atualizar', { diagnosticos: props.valor.filter((item) => item.id !== id) })
}

function alterarTipo(id: string, kind: DiagnosisKind) {
  emit('atualizar', {
    diagnosticos: props.valor.map((item) => (item.id === id ? { ...item, kind } : item)),
  })
}
</script>

<template>
  <ClinicForm
    :titulo="t('clinico.prontuario.diagnostico.titulo')"
    :descricao="t('clinico.prontuario.diagnostico.descricao')"
    :colunas="1"
    ancora="diagnostico"
    :somente-leitura="somenteLeitura"
    :motivo-somente-leitura="motivoLeitura"
  >
    <ul v-if="valor.length > 0" class="registrados">
      <li v-for="diagnostico in valor" :key="diagnostico.id" class="registrado">
        <span class="codigo ui-num">{{ diagnostico.codigo }}</span>
        <span class="registrado__descricao">{{ clinico.descricaoDoDiagnostico(diagnostico) }}</span>

        <Select
          class="registrado__tipo"
          :model-value="diagnostico.kind"
          :options="opcoesTipo"
          option-label="rotulo"
          option-value="valor"
          size="small"
          :disabled="somenteLeitura"
          :aria-label="`${t('clinico.prontuario.nova.diagnostico.tipo')}: ${diagnostico.descricao}`"
          :pt="{ overlay: { class: 'clinic-overlay' } }"
          @update:model-value="alterarTipo(diagnostico.id, $event)"
        />

        <Button
          type="button"
          class="registrado__remover"
          icon="ph ph-x"
          severity="secondary"
          text
          rounded
          size="small"
          :disabled="somenteLeitura"
          :aria-label="`${t('clinico.prontuario.diagnostico.remover')}: ${diagnostico.descricao}`"
          :title="t('clinico.prontuario.diagnostico.remover')"
          @click="remover(diagnostico.id)"
        />
      </li>
    </ul>

    <p v-else class="vazio">
      <i class="ph ph-clipboard-text" aria-hidden="true" />
      {{ t('clinico.prontuario.diagnostico.vazio') }}
    </p>

    <div v-if="!somenteLeitura" class="busca">
      <IconField>
        <InputIcon class="ph ph-magnifying-glass" />
        <InputText
          ref="campoDeBusca"
          v-model="termo"
          :placeholder="t('clinico.prontuario.diagnostico.buscar')"
          :aria-label="t('clinico.prontuario.diagnostico.buscar')"
          fluid
        />
      </IconField>

      <!--
        A sugestão é uma linha inteira clicável, com respiro suficiente para o olho separar uma
        da outra, e a ação escrita na ponta: "+" sozinho obriga a adivinhar se adiciona, expande
        ou cria.
      -->
      <ul v-if="sugestoes.length > 0" class="sugestoes">
        <li v-for="sugestao in sugestoes" :key="sugestao.codigo">
          <button
            type="button"
            class="sugestao"
            @click="adicionar(sugestao.codigo, sugestao.descricao)"
          >
            <span class="codigo codigo--suave ui-num">{{ sugestao.codigo }}</span>
            <span class="sugestao__descricao">{{ sugestao.descricao }}</span>
            <span class="sugestao__acao">
              <i class="ph ph-plus" aria-hidden="true" />
              <span class="sugestao__acao-texto">
                {{ t('clinico.prontuario.diagnostico.adicionar') }}
              </span>
            </span>
          </button>
        </li>
      </ul>

      <p v-else class="vazio">{{ t('clinico.comum.semResultado') }}</p>
    </div>
  </ClinicForm>
</template>

<style scoped>
/* ------------------------------------------------------------------ registrados */

.registrados {
  display: grid;
  margin: 0;
  padding: 0;
  border: 1px solid color-mix(in oklab, var(--pj-lugar) 30%, var(--linha));
  border-radius: 12px;
  background: color-mix(in oklab, var(--pj-lugar-fundo) 60%, var(--superficie));
  list-style: none;
}

.registrado {
  display: grid;
  min-height: 56px;
  align-items: center;
  gap: 12px;
  padding: 8px 8px 8px 14px;
  grid-template-columns: auto minmax(0, 1fr) 10rem auto;
}

.registrado + .registrado {
  border-top: 1px solid color-mix(in oklab, var(--pj-lugar) 18%, var(--linha));
}

.registrado__descricao {
  overflow: hidden;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
  text-overflow: ellipsis;
}

.registrado__remover.p-button.p-button-secondary.p-button-text:not(:disabled):hover {
  background: var(--risco-fundo);
  color: var(--risco-tinta);
}

/* O código é etiqueta de catálogo: algarismos de mesma largura, para as linhas alinharem. */
.codigo {
  display: inline-grid;
  min-width: 56px;
  height: 26px;
  padding: 0 8px;
  place-items: center;
  border-radius: 7px;
  background: var(--pj-lugar-tinta);
  color: var(--superficie);
  font-size: 12.5px;
  font-weight: 650;
}

.codigo--suave {
  background: var(--superficie-3);
  color: var(--tinta-2);
}

.vazio {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  color: var(--tinta-3);
  font-size: 14px;
}

.vazio .ph {
  font-size: 18px;
}

/* ------------------------------------------------------------------ busca */

.busca {
  display: grid;
  gap: 8px;
}

.sugestoes {
  display: grid;
  margin: 0;
  padding: 4px;
  border: 1px solid var(--linha);
  border-radius: 12px;
  list-style: none;
}

.sugestao {
  display: grid;
  width: 100%;
  min-height: 48px;
  align-items: center;
  gap: 12px;
  padding: 0 10px;
  border: 0;
  border-radius: 9px;
  background: none;
  color: var(--tinta);
  cursor: pointer;
  font: inherit;
  grid-template-columns: auto minmax(0, 1fr) auto;
  text-align: start;
}

.sugestao:hover {
  background: var(--superficie-2);
}

.sugestao:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: -2px;
}

.sugestao__descricao {
  overflow: hidden;
  font-size: 14.5px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* A ação aparece por inteiro quando o cursor ou o foco chega na linha. */
.sugestao__acao {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  color: var(--pj-lugar-tinta, var(--musgo));
  font-size: 13.5px;
  font-weight: 600;
  opacity: 0;
  white-space: nowrap;
}

.sugestao:hover .sugestao__acao,
.sugestao:focus-visible .sugestao__acao {
  opacity: 1;
}

@media (hover: none) {
  .sugestao__acao {
    opacity: 1;
  }
}

@media (max-width: 560px) {
  .sugestao__acao-texto {
    display: none;
  }
}

@media (max-width: 760px) {
  .registrado {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .registrado__tipo {
    grid-column: 2 / -1;
    grid-row: 2;
  }
}
</style>
