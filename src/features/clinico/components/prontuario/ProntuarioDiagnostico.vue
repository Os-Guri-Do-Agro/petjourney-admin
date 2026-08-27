<script setup lang="ts">
/**
 * Diagnóstico.
 *
 * A busca é por código **ou** descrição, porque quem digita "GE-01" e quem digita
 * "gastroenterite" estão procurando a mesma coisa. O tipo (presuntivo, definitivo,
 * diferencial) fica editável depois de adicionado: o diagnóstico muda de estatuto ao longo da
 * consulta, e obrigar a remover e readicionar seria fricção sem motivo.
 */
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed, ref } from 'vue'
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

function adicionar(codigo: string, descricao: string) {
  emit('atualizar', {
    diagnosticos: [
      ...props.valor,
      { id: `diag-${codigo}-${props.valor.length}`, codigo, descricao, kind: 'presuntivo' },
    ],
  })
  termo.value = ''
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
    <ul v-if="valor.length > 0" class="lista">
      <li v-for="diagnostico in valor" :key="diagnostico.id" class="lista__item">
        <span class="codigo codigo--forte">{{ diagnostico.codigo }}</span>
        <span class="lista__descricao">{{ clinico.descricaoDoDiagnostico(diagnostico) }}</span>

        <Select
          :model-value="diagnostico.kind"
          :options="opcoesTipo"
          option-label="rotulo"
          option-value="valor"
          size="small"
          :disabled="somenteLeitura"
          :aria-label="t('clinico.prontuario.diagnostico.titulo')"
          :pt="{ overlay: { class: 'clinic-overlay' } }"
          @update:model-value="alterarTipo(diagnostico.id, $event)"
        />

        <Button
          icon="pi pi-times"
          severity="secondary"
          text
          rounded
          size="small"
          :disabled="somenteLeitura"
          :aria-label="t('clinico.prontuario.diagnostico.remover')"
          @click="remover(diagnostico.id)"
        />
      </li>
    </ul>

    <p v-else class="vazio">{{ t('clinico.prontuario.diagnostico.vazio') }}</p>

    <div v-if="!somenteLeitura" class="busca">
      <label class="busca__campo">
        <i class="pi pi-search" aria-hidden="true" />
        <InputText
          v-model="termo"
          :placeholder="t('clinico.prontuario.diagnostico.buscar')"
          :aria-label="t('clinico.prontuario.diagnostico.buscar')"
          fluid
        />
      </label>

      <!--
        A sugestão é uma linha inteira clicável, com respiro suficiente para o olho separar uma
        da outra. Antes eram linhas coladas com um "+" minúsculo na ponta: parecia índice, não
        lista de escolha.
      -->
      <ul v-if="sugestoes.length > 0" class="sugestoes">
        <li v-for="sugestao in sugestoes" :key="sugestao.codigo">
          <button
            type="button"
            class="sugestoes__item clinic-focusable"
            @click="adicionar(sugestao.codigo, sugestao.descricao)"
          >
            <span class="codigo">{{ sugestao.codigo }}</span>
            <span class="sugestoes__descricao">{{ sugestao.descricao }}</span>
            <span class="sugestoes__acao">
              <i class="pi pi-plus" aria-hidden="true" />
              {{ t('clinico.prontuario.diagnostico.adicionar') }}
            </span>
          </button>
        </li>
      </ul>

      <p v-else class="vazio">{{ t('clinico.comum.semResultado') }}</p>
    </div>
  </ClinicForm>
</template>

<style scoped>
.lista {
  display: grid;
  gap: var(--clinic-space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.lista__item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) 9.5rem auto;
  align-items: center;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-2) var(--clinic-space-3);
  border: 1px solid var(--clinic-accent-soft);
  border-radius: var(--clinic-radius-control);
  background: color-mix(in srgb, var(--clinic-accent-tint) 55%, var(--clinic-surface));
}

.lista__descricao {
  overflow: hidden;
  font-size: var(--clinic-font-value);
  font-weight: 700;
  text-overflow: ellipsis;
}

/* O código é etiqueta de catálogo: largura fixa, tabular, para as linhas alinharem. */
.codigo {
  min-width: 3.6rem;
  padding: 0.1rem 0.4rem;
  border-radius: 0.35rem;
  background: var(--clinic-surface-sunken);
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-variant-numeric: tabular-nums;
  font-weight: 800;
  letter-spacing: 0.03em;
  text-align: center;
}

.codigo--forte {
  background: var(--clinic-accent);
  color: var(--clinic-on-accent);
}

.vazio {
  margin: 0;
  padding: var(--clinic-space-3) 0;
  color: var(--clinic-faint);
}

.busca {
  display: grid;
  gap: var(--clinic-space-2);
}

.busca__campo {
  position: relative;
  display: block;
}

.busca__campo i {
  position: absolute;
  top: 50%;
  left: var(--clinic-space-3);
  z-index: 1;
  color: var(--clinic-faint);
  font-size: 0.8rem;
  pointer-events: none;
  transform: translateY(-50%);
}

.busca__campo :deep(input) {
  padding-left: 2.1rem;
}

.sugestoes {
  display: grid;
  gap: 0.2rem;
  margin: 0;
  padding: var(--clinic-space-2);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
  list-style: none;
}

.sugestoes__item {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  width: 100%;
  align-items: center;
  gap: var(--clinic-space-3);
  min-height: calc(var(--clinic-row-height) + 4px);
  padding: 0 var(--clinic-space-2);
  border: 1px solid transparent;
  border-radius: var(--clinic-radius-control);
  background: transparent;
  color: inherit;
  cursor: pointer;
  font: inherit;
  text-align: left;
}

.sugestoes__item:hover {
  border-color: var(--clinic-accent);
  background: var(--clinic-surface);
}

.sugestoes__descricao {
  overflow: hidden;
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/*
 * A ação fica escrita, não só um "+". O sinal sozinho obriga a adivinhar se adiciona, expande
 * ou cria; ela aparece por inteiro quando o cursor chega na linha.
 */
.sugestoes__acao {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  color: var(--clinic-accent-strong);
  font-size: var(--clinic-font-label);
  font-weight: 750;
  opacity: 0;
  white-space: nowrap;
}

.sugestoes__item:hover .sugestoes__acao,
.sugestoes__item:focus-visible .sugestoes__acao {
  opacity: 1;
}

.sugestoes__acao i {
  font-size: 0.62rem;
}

@media (max-width: 760px) {
  .lista__item {
    grid-template-columns: auto minmax(0, 1fr) auto;
  }

  .lista__item > :nth-child(3) {
    grid-column: 1 / -1;
  }
}
</style>
