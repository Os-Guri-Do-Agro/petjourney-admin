<script setup lang="ts">
/**
 * Lista do bulário, com busca e filtros.
 *
 * É o mesmo componente na tela cheia e dentro do seletor que abre a partir da conduta — a
 * alternativa era manter duas listas com dois conjuntos de filtros que envelheceriam em
 * ritmos diferentes.
 *
 * A busca varre nome comercial, princípio ativo **e indicação**. Quem está com um cão com otite
 * na mesa procura "otite", não "enrofloxacina": bulário que só casa pelo nome do remédio serve
 * a quem já sabe a resposta.
 */
import Button from 'primevue/button'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicFilterBar from '../base/ClinicFilterBar.vue'
import type { GrupoDeFiltro } from '../base/filter-types'
import type { Medication, MedicationClass, Pet, PetSpecies } from '../../data/types'
import {
  avisosDoMedicamento,
  doseDaEspecie,
  filtrarMedicamentos,
  type BularioFiltro,
} from '../../domain/bulario'

const props = withDefaults(
  defineProps<{
    medicamentos: Medication[]
    filtro: BularioFiltro
    selecionadoId: string | null
    /** Paciente em atendimento: liga os avisos e a faixa de dose da espécie. */
    pet?: Pet | null
    /** Altura máxima da lista; no seletor a caixa é menor que na tela cheia. */
    compacta?: boolean
  }>(),
  { pet: null, compacta: false },
)

const emit = defineEmits<{
  'update:filtro': [valor: BularioFiltro]
  selecionar: [medicamento: Medication]
}>()

const { t } = useI18n()

const CLASSES: MedicationClass[] = [
  'antibiotico',
  'anti-inflamatorio',
  'analgesico',
  'corticoide',
  'antiemetico',
  'gastroprotetor',
  'antiparasitario',
  'sedativo',
  'cardiologico',
  'dermatologico',
]

const ESPECIES: PetSpecies[] = ['canina', 'felina', 'equina', 'roedor', 'ave', 'reptil']

const visiveis = computed(() => filtrarMedicamentos(props.medicamentos, props.filtro))

const grupos = computed<GrupoDeFiltro[]>(() => [
  {
    id: 'classe',
    rotulo: t('clinico.bulario.filtro.classe'),
    opcoes: CLASSES.map((classe) => ({
      valor: classe,
      rotulo: t(`clinico.bulario.classe.${classe}`),
      contagem: props.medicamentos.filter((item) => item.classe === classe).length,
    })).filter((opcao) => opcao.contagem > 0),
  },
  {
    id: 'especie',
    rotulo: t('clinico.bulario.filtro.especie'),
    opcoes: ESPECIES.map((especie) => ({
      valor: especie,
      rotulo: t(`clinico.especie.${especie}`),
      contagem: props.medicamentos.filter((item) => doseDaEspecie(item, especie)).length,
    })).filter((opcao) => opcao.contagem > 0),
  },
  {
    id: 'controle',
    rotulo: t('clinico.bulario.filtro.controle'),
    opcoes: [
      {
        valor: 'controlado',
        rotulo: t('clinico.bulario.controlado'),
        contagem: props.medicamentos.filter((item) => item.controlado).length,
      },
    ],
  },
])

/** A barra de filtros fala em `Record<string, string[]>`; o domínio fala em campos nomeados. */
const selecionados = computed<Record<string, string[]>>(() => ({
  classe: props.filtro.classes,
  especie: props.filtro.especie ? [props.filtro.especie] : [],
  controle: props.filtro.somenteControlados ? ['controlado'] : [],
}))

function aplicarSelecionados(valor: Record<string, string[]>) {
  emit('update:filtro', {
    ...props.filtro,
    classes: valor.classe ?? [],
    especie: (valor.especie?.[0] as PetSpecies | undefined) ?? null,
    somenteControlados: (valor.controle ?? []).includes('controlado'),
  })
}

/** Aviso mais grave do medicamento para o paciente aberto — a lista mostra só o ponto vermelho. */
function gravidade(medicamento: Medication) {
  const avisos = avisosDoMedicamento(medicamento, props.pet, new Date())

  if (avisos.some((aviso) => aviso.kind === 'especie-proibida' || aviso.kind === 'alergia')) {
    return 'risco'
  }

  return avisos.length > 0 ? 'atencao' : 'nenhum'
}
</script>

<template>
  <div class="bulario-lista" :class="{ 'bulario-lista--compacta': compacta }">
    <ClinicFilterBar
      :grupos="grupos"
      :selecionados="selecionados"
      :busca="filtro.busca"
      :placeholder-busca="t('clinico.bulario.buscaPlaceholder')"
      :resultado="visiveis.length"
      @update:busca="emit('update:filtro', { ...filtro, busca: $event })"
      @update:selecionados="aplicarSelecionados"
    />

    <p v-if="visiveis.length === 0" class="bulario-lista__vazio">
      {{ t('clinico.bulario.semResultado') }}
    </p>

    <ul v-else class="bulario-lista__itens">
      <li v-for="medicamento in visiveis" :key="medicamento.id">
        <Button
          type="button"
          class="item"
          :class="{ 'item--aberto': medicamento.id === selecionadoId }"
          text
          fluid
          :aria-current="medicamento.id === selecionadoId ? 'true' : undefined"
          @click="emit('selecionar', medicamento)"
        >
          <span class="item__corpo">
            <span class="item__topo">
              <strong>{{ medicamento.nome }}</strong>
              <span
                v-if="gravidade(medicamento) !== 'nenhum'"
                class="item__sinal"
                :class="`item__sinal--${gravidade(medicamento)}`"
                :title="t('clinico.bulario.temAviso')"
                aria-hidden="true"
              />
            </span>
            <small>
              {{ t(`clinico.bulario.classe.${medicamento.classe}`) }}
              <template v-if="medicamento.controlado">
                · {{ t('clinico.bulario.controlado') }}
              </template>
            </small>
          </span>

          <i class="pi pi-chevron-right" aria-hidden="true" />
        </Button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.bulario-lista {
  display: grid;
  min-height: 0;
  align-content: start;
  gap: var(--clinic-space-3);
}

.bulario-lista__vazio {
  margin: 0;
  padding: var(--clinic-space-4);
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  text-align: center;
}

.bulario-lista__itens {
  display: grid;
  overflow-y: auto;
  gap: 0.1rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.bulario-lista--compacta .bulario-lista__itens {
  max-height: 19rem;
}

/*
 * Linha da lista: botão de texto com conteúdo próprio. O tema centraliza e pinta o texto de
 * sálvia; a linha alinha à esquerda, herda a cor e usa o fundo suave da clínica no hover.
 */
.item.p-button {
  justify-content: flex-start;
  gap: var(--clinic-space-3);
  padding: var(--clinic-cell-padding-y) var(--clinic-space-3);
  border: 1px solid transparent;
  border-radius: var(--clinic-radius-control);
  color: inherit;
  font: inherit;
  text-align: start;
}

.item.p-button:not(:disabled):hover,
.item.p-button:not(:disabled):active {
  border-color: transparent;
  background: var(--clinic-surface-soft);
  color: inherit;
}

.item--aberto.p-button,
.item--aberto.p-button:not(:disabled):hover,
.item--aberto.p-button:not(:disabled):active {
  border-color: color-mix(in srgb, var(--clinic-accent) 34%, transparent);
  background: var(--clinic-accent-tint);
}

.item__corpo {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 0.1rem;
}

.item__topo {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  min-width: 0;
}

.item__topo strong {
  overflow: hidden;
  font-size: var(--clinic-font-base);
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/** Ponto, não texto: a lista diz que **existe** aviso; o detalhe diz qual é. */
.item__sinal {
  width: 0.45rem;
  height: 0.45rem;
  flex: 0 0 auto;
  border-radius: 999px;
}

.item__sinal--risco {
  background: var(--clinic-risk-text);
}

.item__sinal--atencao {
  background: var(--clinic-attention-text);
}

.item__corpo small {
  overflow: hidden;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.item i {
  color: var(--clinic-faint);
  font-size: 0.7rem;
}
</style>
