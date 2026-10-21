<script setup lang="ts">
/**
 * Cabeçalho do paciente — a identidade que acompanha prontuário, drawer e histórico.
 *
 * É o componente que mais sofre com nome real. Três casos convivem no dataset de propósito:
 * "Ni" (duas letras), "Maximiliano Bartholomeu von Schnauzerhausen III" (longuíssimo) e
 * "Açaí Nhoque Çãpeçã" (acentuação densa). O nome ganha até duas linhas e quebra em qualquer
 * ponto; tudo o mais tem `min-width: 0` para que o flex não estoure a largura da coluna.
 *
 * Terminologia: em português a linha diz "responsável". `tutorId` continua sendo o campo.
 *
 * Na pele do Trilha: o rosto grande (`PetAvatar`, o mesmo de toda linha que fala do paciente), o
 * nome em 20 px, a linha de identificação em tinta secundária, o responsável com o telefone que
 * liga, os alertas em selo — e, à direita, o peso como número grande com a legenda embaixo,
 * porque é dele que sai toda dose.
 */
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import PetAvatar from '@/features/hotel/components/base/PetAvatar.vue'

import ClinicAlertChip from './ClinicAlertChip.vue'
import type { Pet, Tutor } from '../../data/types'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { porteDoPaciente } from '../../domain/porte'

const props = withDefaults(
  defineProps<{
    pet: Pet | null
    tutor: Tutor | null
    /** Variante de drawer/linha: mesma informação, menos respiro. */
    compacto?: boolean
    /** Esconde os alertas quando quem chama já os mostra em outro lugar. */
    semAlertas?: boolean
    /**
     * Peso **em vigor**, quando quem chama sabe mais que o cadastro.
     *
     * O prontuário calcula dose com o peso aferido hoje; o cabeçalho mostrava o do cadastro. Na
     * hora em que o vet pesa o animal na consulta, os dois divergiam na mesma tela — a receita
     * dizia uma coisa e o topo da página, outra. Numa demonstração é a incoerência que alguém
     * da plateia percebe primeiro.
     */
    pesoKg?: number | null
  }>(),
  { compacto: false, semAlertas: false, pesoKg: undefined },
)

const { t } = useI18n()
const formato = useClinicFormat()

/**
 * O peso que a tela mostra: o informado por quem chama, e o do cadastro como reserva.
 *
 * `aferidoHoje` marca quando ele vem da balança desta consulta e **difere** do cadastro — é o
 * que explica a diferença em vez de deixá-la parecer erro.
 */
const peso = computed(() => {
  const doCadastro = props.pet?.pesoKg ?? null
  const vigente = props.pesoKg === undefined ? doCadastro : props.pesoKg

  return {
    valor: vigente,
    aferidoHoje: vigente !== null && doCadastro !== null && vigente !== doCadastro,
  }
})

const meta = computed(() => {
  const pet = props.pet

  if (!pet) {
    return [] as string[]
  }

  /**
   * O porte entra na linha de identificação porque **é ele que escolhe a faixa de
   * referência** do exame físico. Sem ele visível, um valor marcado como alterado num cão
   * grande e normal num pequeno não teria explicação na tela.
   *
   * Aparece só quando a espécie tem porte clínico — em gato e ave a linha ganharia uma
   * palavra a mais sem informação nenhuma.
   */
  const porte = porteDoPaciente(pet)

  return [
    formato.especie(pet.especie),
    pet.raca,
    porte ? t(`clinico.paciente.porte.${porte}`) : '',
    formato.idade(pet.nascimento),
    formato.sexo(pet.sexo),
    pet.castrado ? t('clinico.paciente.castrado') : t('clinico.paciente.inteiro'),
    /*
     * No compacto (gaveta da agenda, diálogo) não há trilho para o número grande: o peso entra
     * na linha de identificação, como mais um dado. Sem ele, quem abre a gaveta para encaixar
     * uma vacina teria de abrir a ficha só para saber quanto o animal pesa.
     */
    props.compacto && peso.value.valor !== null ? formato.peso(peso.value.valor) : '',
  ].filter(Boolean)
})

/** Alerta de risco vem primeiro: é o que muda conduta antes de a consulta começar. */
const alertasOrdenados = computed(() => {
  const peso = { risco: 0, atencao: 1, info: 2 } as const

  return [...(props.pet?.alertas ?? [])].sort((a, b) => peso[a.severidade] - peso[b.severidade])
})
</script>

<template>
  <header v-if="pet" class="paciente" :class="{ 'paciente--compacto': compacto }">
    <PetAvatar
      class="paciente__rosto"
      :nome="pet.nome"
      :iniciais="pet.iniciais"
      :especie="pet.especie"
      :foto-url="pet.fotoUrl"
      :tamanho="compacto ? 'lg' : 'xl'"
    />

    <div class="paciente__corpo">
      <h2 class="paciente__nome" :title="pet.nome">{{ pet.nome }}</h2>

      <p class="paciente__meta">
        <span class="paciente__dados">
          <span v-for="(item, indice) in meta" :key="`${indice}-${item}`" class="paciente__dado">
            <span class="paciente__sep" aria-hidden="true">·</span>{{ item }}
          </span>
        </span>
      </p>

      <p v-if="tutor" class="paciente__tutor">
        <span class="paciente__tutor-rotulo">{{ t('clinico.paciente.responsavel') }}</span>
        <span class="paciente__tutor-nome" :title="tutor.nome">{{ tutor.nome }}</span>
        <a v-if="tutor.telefone" class="paciente__telefone" :href="`tel:${tutor.telefone}`">
          <i class="ph ph-phone" aria-hidden="true" />
          <bdi dir="ltr">{{ tutor.telefone }}</bdi>
        </a>
      </p>

      <ul v-if="!semAlertas && alertasOrdenados.length > 0" class="paciente__alertas">
        <li v-for="alerta in alertasOrdenados" :key="alerta.id">
          <ClinicAlertChip
            class="paciente__chip"
            :severidade="alerta.severidade"
            :rotulo="formato.alerta(alerta.kind)"
            :detalhe="alerta.detalhe"
          />
        </li>
      </ul>
    </div>

    <!--
      Trilho da direita: **dado em cima, ação embaixo**. O peso é o número mais consultado do
      cabeçalho (toda dose sai dele): número grande, unidade ao lado e a legenda embaixo, como o
      "46 min esperando" do Hoje. No compacto ele mora na linha de identificação.
    -->
    <div v-if="(!compacto && peso.valor !== null) || $slots.acoes" class="paciente__trilho">
      <div v-if="!compacto && peso.valor !== null" class="peso">
        <span class="peso__numero">
          <strong class="peso__valor ui-num">{{ formato.numero(peso.valor, 1) }}</strong>
          <span class="peso__unidade">{{ t('clinico.formato.kg') }}</span>
        </span>
        <!-- Pesado hoje e diferente do cadastro: a legenda explica a diferença. -->
        <small class="peso__legenda" :class="{ 'peso__legenda--hoje': peso.aferidoHoje }">
          <i v-if="peso.aferidoHoje" class="ph ph-scales" aria-hidden="true" />
          {{ peso.aferidoHoje ? t('clinico.paciente.pesadoHoje') : t('clinico.ficha.peso') }}
        </small>
      </div>

      <div v-if="$slots.acoes" class="paciente__acoes">
        <slot name="acoes" />
      </div>
    </div>
  </header>
</template>

<style scoped>
/*
 * Uma folha do kit com três colunas: o rosto, o que identifica o paciente e o trilho do peso.
 *
 * O cabeçalho decide o próprio arranjo pela largura que **recebeu** (`container-type`), não pela
 * da janela: ele aparece no prontuário em coluna larga e na gaveta de 360 px da agenda. A consulta
 * de contêiner estiliza só descendentes, nunca o próprio contêiner — por isso a grade fica aqui,
 * fixa, e o que muda no estreito é o lugar do trilho (um filho), lá embaixo.
 */
.paciente {
  display: grid;
  min-width: 0;
  align-items: start;
  gap: 4px 18px;
  grid-template-columns: auto minmax(0, 1fr) auto;
  padding: 18px 24px;
  border: 1px solid var(--linha);
  border-radius: 16px;
  background: var(--superficie);
  color: var(--tinta);
  container-type: inline-size;
}

.paciente--compacto {
  gap: 4px 14px;
  padding: 14px 16px;
  border-radius: 14px;
}

.paciente__rosto {
  align-self: start;
}

.paciente__corpo {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 4px;
}

/*
 * Nome longo ganha duas linhas e quebra onde precisar. Sem isto, "Maximiliano Bartholomeu von
 * Schnauzerhausen III" empurra o trilho da direita para fora da coluna em 1024.
 */
.paciente__nome {
  display: -webkit-box;
  min-width: 0;
  overflow: hidden;
  margin: 0;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  color: var(--tinta);
  font-size: 20px;
  font-weight: 650;
  letter-spacing: -0.015em;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.paciente--compacto .paciente__nome {
  -webkit-line-clamp: 1;
  line-clamp: 1;
  font-size: 16px;
}

/*
 * A linha de identificação quebra **entre** dados, nunca dentro de um ("Shih Tzu" não vira
 * "Shih / Tzu"), e nenhuma linha começa com o ponto: cada dado leva o ponto à frente, a lista
 * entra 14 px para a esquerda, e o ponto do primeiro dado de cada linha cai fora da caixa, cortado.
 */
.paciente__meta {
  overflow: hidden;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.paciente--compacto .paciente__meta {
  font-size: 13px;
}

.paciente__dados {
  display: flex;
  flex-wrap: wrap;
  margin-inline-start: -14px;
}

/* Item de flex que quebra linha: o dado desce inteiro, e só o que não cabe numa linha se parte. */
.paciente__dado {
  min-width: 0;
  overflow-wrap: anywhere;
}

.paciente__sep {
  display: inline-block;
  width: 14px;
  color: var(--tinta-3);
  text-align: center;
}

.paciente__tutor {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 2px 8px;
  margin: 4px 0 0;
  font-size: 14px;
}

.paciente__tutor-rotulo {
  color: var(--tinta-2);
  font-size: 13px;
}

.paciente__tutor-nome {
  min-width: 0;
  overflow: hidden;
  color: var(--tinta);
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.paciente__telefone {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border-radius: 6px;
  color: var(--pj-lugar-tinta, var(--musgo));
  font-family: var(--font-dados);
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  text-decoration: none;
  white-space: nowrap;
}

.paciente__telefone i {
  align-self: center;
  font-size: 15px;
}

.paciente__telefone:hover {
  text-decoration: underline;
  text-underline-offset: 3px;
}

.paciente__telefone:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: 2px;
}

.paciente__alertas {
  display: flex;
  min-width: 0;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}

.paciente__alertas li {
  min-width: 0;
  max-width: 100%;
}

/*
 * Aqui o alerta não se corta em reticências: "Alergia: Dipi…" esconde justo a palavra que muda a
 * receita. No cartão estreito o selo cresce para duas linhas, como os alertas da recepção no Hoje:
 * o ícone fica no alto e o texto do selo (rótulo e detalhe, uma frase só) quebra ao lado dele.
 */
.paciente__alertas .paciente__chip {
  height: auto;
  min-height: 24px;
  align-items: flex-start;
  padding-block: 3px;
  white-space: normal;
}

.paciente__chip :deep(i) {
  margin-top: 1px;
}

.paciente__chip :deep(.chip__texto) {
  overflow: visible;
}

/* ------------------------------------------------------------------- trilho direito */

.paciente__trilho {
  display: flex;
  min-width: 0;
  max-width: 100%;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
}

.peso {
  display: grid;
  justify-items: end;
  gap: 2px;
  white-space: nowrap;
}

.peso__numero {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.peso__valor {
  color: var(--tinta);
  font-size: 28px;
  font-weight: 650;
  letter-spacing: -0.02em;
  line-height: 1;
}

.peso__unidade {
  color: var(--tinta-2);
  font-size: 14px;
  font-weight: 500;
}

.peso__legenda {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: var(--tinta-3);
  font-size: 12px;
}

/* Pesado nesta consulta e diferente do cadastro: a legenda vira um aviso discreto, na cor do lugar. */
.peso__legenda--hoje {
  color: var(--pj-lugar-tinta, var(--musgo));
  font-weight: 600;
}

.paciente__acoes {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
}

/*
 * Estreito (coluna de painel, gaveta): o trilho desce para uma faixa embaixo, peso à esquerda e
 * ações à direita, separada por um fio. Empilhado à direita numa coluna estreita ele espremia o
 * corpo do cartão e o nome quebrava em três linhas.
 */
@container (max-width: 26rem) {
  .paciente .paciente__rosto {
    width: 52px;
    height: 52px;
    font-size: 1.05rem;
  }
}

@container (max-width: 32rem) {
  .paciente__trilho {
    flex-direction: row;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    grid-column: 1 / -1;
    margin-top: 10px;
    padding-top: 12px;
    border-top: 1px solid var(--linha);
  }

  .peso {
    justify-items: start;
  }

  .peso__valor {
    font-size: 24px;
  }
}
</style>
