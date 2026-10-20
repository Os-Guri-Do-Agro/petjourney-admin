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
 *
 * ## A forma (redesenho de 19/10/2026)
 *
 * O campo de busca é o maior controle da coluna, com os filtros embaixo dele. Cada remédio é uma
 * linha de lista do kit: o nome em destaque, a classe embaixo (e o cadeado de controle especial,
 * com a palavra). Com paciente aberto, o aviso dele aparece **na linha**, em selo com a palavra —
 * "Contraindicado", "Alergia", "Cautela" — e não só num ponto colorido: quem percorre a lista
 * precisa saber o que evitar antes de abrir a ficha. O remédio aberto ganha o fundo e a marca do
 * lugar na borda.
 */
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

type Sinal = { tom: 'risco' | 'atencao'; rotulo: string; icone: string }

/**
 * O aviso mais grave do medicamento para o paciente aberto, em uma palavra. A lista diz que
 * **existe** aviso e de que tipo; a ficha diz qual é, com o detalhe.
 */
const sinais = computed(() => {
  const mapa = new Map<string, Sinal>()

  if (!props.pet) {
    return mapa
  }

  const hoje = new Date()

  for (const medicamento of visiveis.value) {
    const avisos = avisosDoMedicamento(medicamento, props.pet, hoje)

    if (avisos.some((aviso) => aviso.kind === 'especie-proibida')) {
      mapa.set(medicamento.id, {
        tom: 'risco',
        rotulo: t('clinico.bulario.sinal.contraindicado'),
        icone: 'ph ph-prohibit',
      })
    } else if (avisos.some((aviso) => aviso.kind === 'alergia')) {
      mapa.set(medicamento.id, {
        tom: 'risco',
        rotulo: t('clinico.bulario.sinal.alergia'),
        icone: 'ph ph-warning-diamond',
      })
    } else if (avisos.length > 0) {
      mapa.set(medicamento.id, {
        tom: 'atencao',
        rotulo: t('clinico.bulario.sinal.cautela'),
        icone: 'ph ph-warning',
      })
    }
  }

  return mapa
})
</script>

<template>
  <!--
    Na página, a lista é um cartão só: a busca no alto e as linhas embaixo. No seletor (compacta),
    que já mora num diálogo, a busca fica solta e as linhas numa folha.
  -->
  <div
    class="bulario-lista"
    :class="compacta ? 'bulario-lista--compacta' : 'bulario-lista--cartao ui-folha'"
  >
    <div class="bulario-lista__procura" role="search">
      <ClinicFilterBar
        :grupos="grupos"
        :selecionados="selecionados"
        :busca="filtro.busca"
        :placeholder-busca="t('clinico.bulario.buscaPlaceholder')"
        :resultado="visiveis.length"
        @update:busca="emit('update:filtro', { ...filtro, busca: $event })"
        @update:selecionados="aplicarSelecionados"
      />
    </div>

    <p
      v-if="visiveis.length === 0"
      class="bulario-lista__vazio ui-vazio"
      :class="{ 'ui-folha': compacta }"
    >
      <strong>{{ t('clinico.bulario.semResultado') }}</strong>
    </p>

    <ul
      v-else
      class="bulario-lista__itens ui-lista"
      :class="{ 'ui-folha': compacta }"
      :aria-label="t('clinico.bulario.titulo')"
    >
      <li v-for="medicamento in visiveis" :key="medicamento.id">
        <button
          type="button"
          class="ui-linha item"
          :class="{ 'item--aberto ui-marca ui-marca--lugar': medicamento.id === selecionadoId }"
          :aria-current="medicamento.id === selecionadoId ? 'true' : undefined"
          @click="emit('selecionar', medicamento)"
        >
          <span class="ui-linha__texto">
            <strong class="ui-linha__titulo item__nome">{{ medicamento.nome }}</strong>
            <span class="ui-linha__meta item__meta">
              <span>{{ t(`clinico.bulario.classe.${medicamento.classe}`) }}</span>
              <span v-if="medicamento.controlado" class="item__controle">
                <i class="ph ph-lock-simple" aria-hidden="true" />
                {{ t('clinico.bulario.controlado') }}
              </span>
            </span>
          </span>

          <span
            v-if="sinais.get(medicamento.id)"
            class="ui-selo item__sinal"
            :class="`ui-selo--${sinais.get(medicamento.id)!.tom}`"
            :title="t('clinico.bulario.temAviso')"
          >
            <i :class="sinais.get(medicamento.id)!.icone" aria-hidden="true" />
            {{ sinais.get(medicamento.id)!.rotulo }}
          </span>

          <i class="ph ph-caret-right ui-linha__seta item__seta" aria-hidden="true" />
        </button>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.bulario-lista {
  display: grid;
  min-width: 0;
  min-height: 0;
  align-content: start;
  gap: 14px;
}

/*
 * A busca ocupa a coluna inteira e é o maior controle dela: é por ela que se chega a qualquer
 * remédio. Os filtros e a contagem descem para a linha de baixo.
 */
.bulario-lista__procura :deep(.filtro__busca) {
  flex: 1 1 100%;
  max-width: none;
}

.bulario-lista:not(.bulario-lista--compacta) .bulario-lista__procura :deep(.filtro__busca .p-inputtext) {
  min-height: 48px;
  padding-inline-start: 46px;
  border-radius: var(--raio-controle);
  font-size: 15.5px;
}

.bulario-lista:not(.bulario-lista--compacta) .bulario-lista__procura :deep(.filtro__busca .p-inputicon) {
  inset-inline-start: 16px;
  color: var(--tinta-2);
  font-size: 20px;
}

.bulario-lista__vazio {
  margin: 0;
}

/* ------------------------------------------------------------------------------- o cartão */

.bulario-lista--cartao {
  gap: 0;
  overflow: hidden;
}

.bulario-lista--cartao .bulario-lista__procura {
  padding: 16px 16px 14px;
  border-bottom: 1px solid var(--linha-suave);
}

.bulario-lista--cartao .bulario-lista__procura :deep(.filtro__resultado) {
  margin-inline-start: auto;
  color: var(--tinta-2);
}

.bulario-lista--cartao .bulario-lista__itens > li > .ui-linha {
  border-radius: 0;
}

.bulario-lista--compacta .bulario-lista__itens {
  max-height: 19rem;
  overflow-y: auto;
}

/* ---------------------------------------------------------------------------------- a linha */

.item {
  min-height: 58px;
  gap: 10px;
  padding-block: 9px;
  padding-inline: 18px 14px;
  text-align: start;
  transition: background-color var(--pj-tempo-curto, 140ms) ease;
}

.item__nome {
  white-space: nowrap;
}

.item__meta {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 10px;
}

.item__controle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--atencao-tinta);
  font-weight: 550;
}

.item__controle i {
  font-size: 13px;
}

.item__sinal {
  height: 22px;
  padding-inline: 7px;
  font-size: 12px;
}

.item__sinal i {
  font-size: 13px;
}

/* O remédio aberto: o fundo e a marca do lugar, e o nome na tinta dele. */
.item--aberto,
.trilha button.item--aberto:hover {
  background: color-mix(in oklab, var(--pj-lugar-fundo, var(--clinica-fundo)) 70%, var(--superficie));
}

.item--aberto .item__nome,
.item--aberto .item__seta {
  color: var(--pj-lugar-tinta, var(--clinica-tinta));
}

@media (prefers-reduced-motion: reduce) {
  .item {
    transition: none;
  }
}
</style>
