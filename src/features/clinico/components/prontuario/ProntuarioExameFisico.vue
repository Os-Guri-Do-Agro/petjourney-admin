<script setup lang="ts">
/**
 * Exame físico.
 *
 * Duas regras clínicas viram interface aqui:
 *
 * 1. **`não aferido` é diferente de vazio.** Cada vital tem um botão que marca a decisão de
 *    não medir. Sem isso, um campo em branco significa ao mesmo tempo "não medi" e "não
 *    preenchi ainda", e quem lê o prontuário depois não sabe qual dos dois.
 * 2. **O status vem do cálculo, nunca do que foi digitado.** Editar o peso reavalia tudo na
 *    hora; nada de status congelado no registro.
 *
 * ## A forma (redesenho total, 19/10/2026)
 *
 * Os sete vitais são campos de verdade, numa grade: o rótulo em cima, o número grande e alinhado
 * à direita com a unidade dentro, e embaixo a faixa da espécie, o julgamento e "não medir — "acima" em selo de risco com a seta, "na faixa" com o visto. O número fora da faixa
 * pinta a borda do campo: o olho acha antes de ler.
 *
 * Os oito sistemas são uma lista de linhas, uma por sistema, com a escolha logo depois do nome. A
 * linha alterada ganha a marca de atenção na borda e o campo da nota — **só ela**, porque é o
 * único caso em que há o que escrever.
 */
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { computed, useId } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicField from '../base/ClinicField.vue'
import ClinicForm from '../base/ClinicForm.vue'
import ClinicToggleGroup from '../base/ClinicToggleGroup.vue'
import type {
  ExameFisico,
  HidratacaoGrau,
  Measurement,
  MucosaStatus,
  Pet,
  SystemFinding,
  SystemKey,
  VitalKey,
} from '../../data/types'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { statusDaMedicao } from '../../domain/ranges'
import { useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  valor: ExameFisico
  /**
   * O paciente inteiro, e não só a espécie.
   *
   * A faixa de referência é qualificada por **porte e idade**, não apenas por espécie: um
   * yorkshire de 3 kg em 140 bpm está em repouso e um são-bernardo em 140 bpm está
   * taquicárdico. Com só a espécie na mão, o componente marcaria um dos dois errado sempre.
   */
  pet: Pet | null
  somenteLeitura: boolean
  motivoLeitura: string
}>()

const emit = defineEmits<{ atualizar: [patch: { exameFisico: ExameFisico }] }>()

const { t } = useI18n()
const clinico = useClinicoStore()
const formato = useClinicFormat()
const idBase = useId()

const VITAIS: VitalKey[] = [
  'peso',
  'temperatura',
  'frequenciaCardiaca',
  'frequenciaRespiratoria',
  'tempoPreenchimentoCapilar',
  'escoreCorporal',
  'pressaoSistolica',
]

const SISTEMAS: SystemKey[] = [
  'cardiovascular',
  'respiratorio',
  'digestorio',
  'urinario',
  'tegumentar',
  'locomotor',
  'neurologico',
  'linfonodos',
]

/**
 * O tom da escolha é o que permite varrer a coluna inteira sem ler: verde é o que está normal,
 * âmbar é o que tem achado, cinza é o que ninguém avaliou ainda. Sem isso, oito linhas com as
 * mesmas três palavras obrigam a ler as vinte e quatro.
 */
const opcoesAchado = computed(() =>
  (
    [
      { valor: 'normal', tom: 'ok' },
      { valor: 'alterado', tom: 'atencao' },
      { valor: 'nao-avaliado', tom: 'neutro' },
    ] as const
  ).map((opcao) => ({
    valor: opcao.valor,
    tom: opcao.tom,
    rotulo: t(`clinico.prontuario.exameFisico.achado.${opcao.valor}`),
  })),
)

/**
 * Aferido é o que foi medido. O "não aferido" é registro (completa a etapa), mas contá-lo aqui
 * dava "7 de 7 aferidos" com a pressão marcada como não aferida logo abaixo.
 */
const aferidos = computed(
  () =>
    VITAIS.filter((vital) => {
      const atual = medicao(vital)

      return !atual.naoAferido && atual.valor !== null
    }).length,
)

const alterados = computed(
  () =>
    SISTEMAS.filter((sistema) => props.valor.sistemas[sistema]?.status === 'alterado').length,
)

function faixaDe(vital: VitalKey) {
  return clinico.faixaDoPaciente(vital, props.pet)
}

/**
 * Coloração das mucosas.
 *
 * Vive fora de `vitais` porque não tem número nem faixa — mas é exame físico, e dos que mais
 * mudam conduta sozinhos: pálida é hemorragia ou anemia até prova em contrário, ictérica manda
 * olhar fígado, cianótica é urgência respiratória.
 *
 * O tom acompanha a gravidade para a varredura funcionar sem leitura, no mesmo padrão dos oito
 * sistemas logo abaixo.
 */
const opcoesMucosas = computed(() =>
  (
    [
      { valor: 'normocoradas', tom: 'ok' },
      { valor: 'palidas', tom: 'atencao' },
      { valor: 'ictericas', tom: 'atencao' },
      { valor: 'cianoticas', tom: 'risco' },
      { valor: 'congestas', tom: 'atencao' },
      { valor: 'nao-avaliado', tom: 'neutro' },
    ] as const
  ).map((opcao) => ({
    valor: opcao.valor,
    tom: opcao.tom,
    rotulo: t(`clinico.prontuario.exameFisico.mucosa.${opcao.valor}`),
  })),
)

/**
 * Grau de desidratação.
 *
 * Estava na anamnese, que era o lugar errado: desidratação se estima por turgor cutâneo,
 * mucosas e enoftalmia — com o paciente na mesa, não por relato de telefone.
 */
const opcoesHidratacao = computed(() =>
  (
    [
      { valor: 'normal', tom: 'ok' },
      { valor: 'leve', tom: 'atencao' },
      { valor: 'moderada', tom: 'atencao' },
      { valor: 'grave', tom: 'risco' },
    ] as const
  ).map((opcao) => ({
    valor: opcao.valor,
    tom: opcao.tom,
    rotulo: t(`clinico.prontuario.exameFisico.hidratacao.${opcao.valor}`),
  })),
)

function aplicarMucosas(valor: MucosaStatus) {
  emit('atualizar', { exameFisico: { ...props.valor, mucosas: valor } })
}

function aplicarHidratacao(valor: HidratacaoGrau) {
  emit('atualizar', { exameFisico: { ...props.valor, hidratacao: valor } })
}

function medicao(vital: VitalKey): Measurement {
  return props.valor.vitais[vital] ?? { valor: null, naoAferido: false }
}

function achado(sistema: SystemKey): SystemFinding {
  return props.valor.sistemas[sistema] ?? { status: 'nao-avaliado', nota: '' }
}

function aplicarVital(vital: VitalKey, patch: Partial<Measurement>) {
  emit('atualizar', {
    exameFisico: {
      ...props.valor,
      vitais: { ...props.valor.vitais, [vital]: { ...medicao(vital), ...patch } },
    },
  })
}

function aplicarSistema(sistema: SystemKey, patch: Partial<SystemFinding>) {
  emit('atualizar', {
    exameFisico: {
      ...props.valor,
      sistemas: { ...props.valor.sistemas, [sistema]: { ...achado(sistema), ...patch } },
    },
  })
}

/** Precisão do campo segue a da faixa: temperatura com uma casa, frequência inteira. */
function casasDe(vital: VitalKey) {
  return faixaDe(vital)?.precisao ?? (vital === 'peso' ? 1 : 0)
}

function unidadeDe(vital: VitalKey) {
  return vital === 'peso' ? 'kg' : (faixaDe(vital)?.unidade ?? '')
}

/** O julgamento do valor digitado contra a faixa do paciente; vazio enquanto não há número. */
function situacaoDe(vital: VitalKey) {
  const atual = medicao(vital)

  if (atual.naoAferido || atual.valor === null) {
    return null
  }

  return statusDaMedicao(atual, faixaDe(vital))
}
</script>

<template>
  <ClinicForm
    :titulo="t('clinico.prontuario.exameFisico.titulo')"
    :descricao="t('clinico.prontuario.exameFisico.descricao')"
    :colunas="1"
    ancora="exame-fisico"
    :somente-leitura="somenteLeitura"
    :motivo-somente-leitura="motivoLeitura"
  >
    <template #acoes>
      <span class="contador">
        <i class="ph ph-heartbeat" aria-hidden="true" />
        <span class="ui-num">
          {{
            t('clinico.prontuario.passos.vitaisAferidos', {
              preenchidos: aferidos,
              total: VITAIS.length,
            })
          }}
        </span>
      </span>
    </template>

    <fieldset class="grupo grupo--primeiro">
      <legend class="grupo__titulo">{{ t('clinico.prontuario.exameFisico.vitais') }}</legend>

      <div class="vitais">
        <!--
          Cada vital: o rótulo curto (a unidade mora dentro do campo, o que evita "Frequência
          respiratória · mpm" quebrando em duas linhas), o número tabular, e embaixo a faixa e o
          julgamento. A decisão de não medir fica escrita no fim dessa linha, e apaga o campo.
        -->
        <div
          v-for="vital in VITAIS"
          :key="vital"
          class="vital"
          :class="[
            situacaoDe(vital) ? `vital--${situacaoDe(vital)}` : '',
            { 'vital--nao-aferido': medicao(vital).naoAferido },
          ]"
        >
          <label class="vital__rotulo" :for="`${idBase}-${vital}`">
            {{ t(`clinico.prontuario.exameFisico.${vital}`) }}
          </label>

          <InputNumber
            class="vital__campo"
            :input-id="`${idBase}-${vital}`"
            :model-value="medicao(vital).valor"
            :min-fraction-digits="casasDe(vital)"
            :max-fraction-digits="casasDe(vital)"
            :suffix="unidadeDe(vital) ? formato.comUnidade(unidadeDe(vital)) : undefined"
            :placeholder="medicao(vital).naoAferido ? t('clinico.prontuario.naoAferido') : ''"
            :disabled="somenteLeitura || medicao(vital).naoAferido"
            fluid
            @update:model-value="aplicarVital(vital, { valor: $event ?? null })"
          />

          <!--
            O rodapé tem duas colunas: a leitura (julgamento e faixa), que quebra linha dentro
            da dela, e o "não medir", sempre na primeira linha à direita. Solto no mesmo fluxo,
            ele descia para a linha de baixo em uns vitais e não em outros, conforme o tamanho
            da faixa.
          -->
          <span class="vital__rodape">
            <span class="vital__leitura">
              <span
                v-if="situacaoDe(vital) === 'acima' || situacaoDe(vital) === 'abaixo'"
                class="ui-selo ui-selo--risco vital__situacao"
              >
                <i
                  :class="situacaoDe(vital) === 'acima' ? 'ph ph-arrow-up' : 'ph ph-arrow-down'"
                  aria-hidden="true"
                />
                {{ formato.statusDeFaixa(situacaoDe(vital)!) }}
              </span>
              <span v-else-if="situacaoDe(vital) === 'dentro'" class="vital__ok">
                <i class="ph ph-check" aria-hidden="true" />
                {{ formato.statusDeFaixa('dentro') }}
              </span>
              <span v-if="faixaDe(vital)" class="vital__faixa ui-num">
                {{ formato.faixaDeReferencia(faixaDe(vital)) }}
              </span>
            </span>

            <!--
              Depois do campo no DOM: o Tab passa pelo número primeiro. Fora do avanço por
              Enter: com ele na sequência, "8,3 Enter 38,6 Enter" caía aqui e o segundo Enter
              apagava o peso e o marcava como não aferido.
            -->
            <button
              type="button"
              class="vital__marcar"
              data-fora-do-teclado
              :aria-pressed="medicao(vital).naoAferido"
              :disabled="somenteLeitura"
              @click="
                aplicarVital(vital, {
                  naoAferido: !medicao(vital).naoAferido,
                  valor: medicao(vital).naoAferido ? medicao(vital).valor : null,
                })
              "
            >
              {{
                medicao(vital).naoAferido
                  ? t('clinico.prontuario.naoAferido')
                  : t('clinico.prontuario.naoMedir')
              }}
            </button>
          </span>
        </div>
      </div>
    </fieldset>

    <!--
      Mucosas e hidratação ficam **entre** os vitais e os sistemas, e não dentro de nenhum dos
      dois: não têm número nem faixa (então não são vitais), e não são um dos oito sistemas.
      São a leitura de perfusão que o vet faz assim que põe a mão no paciente, e é nessa ordem
      que ela acontece.
    -->
    <fieldset class="grupo">
      <legend class="grupo__titulo">{{ t('clinico.prontuario.exameFisico.perfusao') }}</legend>

      <div class="perfusao">
        <ClinicField :rotulo="t('clinico.prontuario.exameFisico.mucosas')">
          <ClinicToggleGroup
            :model-value="valor.mucosas"
            :opcoes="opcoesMucosas"
            :desabilitado="somenteLeitura"
            :rotulo="t('clinico.prontuario.exameFisico.mucosas')"
            @update:model-value="aplicarMucosas($event as MucosaStatus)"
          />
        </ClinicField>

        <ClinicField :rotulo="t('clinico.prontuario.exameFisico.hidratacaoRotulo')">
          <ClinicToggleGroup
            :model-value="valor.hidratacao"
            :opcoes="opcoesHidratacao"
            :desabilitado="somenteLeitura"
            :rotulo="t('clinico.prontuario.exameFisico.hidratacaoRotulo')"
            @update:model-value="aplicarHidratacao($event as HidratacaoGrau)"
          />
        </ClinicField>
      </div>
    </fieldset>

    <fieldset class="grupo">
      <legend class="grupo__titulo">
        {{ t('clinico.prontuario.exameFisico.sistemas') }}
        <span v-if="alterados > 0" class="ui-selo ui-selo--atencao">
          {{ t('clinico.prontuario.passos.sistemasAlterados', { contagem: alterados }, alterados) }}
        </span>
      </legend>

      <ul class="sistemas">
        <li
          v-for="sistema in SISTEMAS"
          :key="sistema"
          class="sistema"
          :class="[
            `sistema--${achado(sistema).status}`,
            { 'ui-marca ui-marca--atencao': achado(sistema).status === 'alterado' },
          ]"
        >
          <span class="sistema__nome">
            {{ t(`clinico.prontuario.exameFisico.sistema.${sistema}`) }}
          </span>

          <ClinicToggleGroup
            :model-value="achado(sistema).status"
            :opcoes="opcoesAchado"
            :rotulo="t(`clinico.prontuario.exameFisico.sistema.${sistema}`)"
            :desabilitado="somenteLeitura"
            @update:model-value="aplicarSistema(sistema, { status: $event })"
          />

          <!-- A nota só existe quando há alteração para descrever. -->
          <InputText
            v-if="achado(sistema).status === 'alterado'"
            class="sistema__nota"
            :model-value="achado(sistema).nota"
            :placeholder="t('clinico.prontuario.exameFisico.notaAlterado')"
            :aria-label="`${t(`clinico.prontuario.exameFisico.sistema.${sistema}`)}: ${t('clinico.prontuario.exameFisico.notaAlterado')}`"
            :disabled="somenteLeitura"
            fluid
            @update:model-value="aplicarSistema(sistema, { nota: $event ?? '' })"
          />
        </li>
      </ul>
    </fieldset>

    <ClinicField :rotulo="t('clinico.prontuario.exameFisico.observacao')" largo>
      <template #default="{ id }">
        <Textarea
          :id="id"
          :model-value="valor.observacao"
          rows="3"
          auto-resize
          fluid
          :disabled="somenteLeitura"
          @update:model-value="
            emit('atualizar', { exameFisico: { ...valor, observacao: $event ?? '' } })
          "
        />
      </template>
    </ClinicField>
  </ClinicForm>
</template>

<style scoped>
.contador {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  height: 30px;
  padding: 0 11px;
  border-radius: 999px;
  background: var(--superficie-2);
  color: var(--tinta-2);
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
}

.contador .ph {
  font-size: 15px;
}

/* Grupo da folha: um fio em cima e o título em frase, sem caixa dentro da caixa. */
.grupo {
  display: grid;
  min-width: 0;
  gap: 14px;
  margin: 4px 0 0;
  padding: 18px 0 0;
  border: 0;
  border-top: 1px solid var(--linha);
}

.grupo--primeiro {
  margin-top: 0;
  padding-top: 0;
  border-top: 0;
}

/* A legenda flutua para virar linha da grade: no lugar padrão ela cortaria o fio ao meio. */
.grupo__titulo {
  display: flex;
  float: left;
  width: 100%;
  align-items: center;
  gap: 10px;
  margin: 0;
  padding: 0;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

/* ------------------------------------------------------------------ vitais */

.vitais {
  display: grid;
  gap: 18px 16px;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 168px), 1fr));
}

.vital {
  display: grid;
  min-width: 0;
  align-content: start;
  gap: 7px;
}

.vital__rotulo {
  display: block;
  overflow: hidden;
  color: var(--tinta);
  font-size: 13px;
  font-weight: 550;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/*
 * "Não medir" é texto, não ícone de proibido: o ícone dizia "bloqueado" quando o que se quer
 * dizer é "decidi não aferir". Discreto enquanto é oferta, em selo quando é registro.
 */
.vital__marcar {
  flex: none;
  margin-inline-start: auto;
  padding: 2px 6px;
  border: 0;
  border-radius: 6px;
  background: none;
  color: var(--tinta-3);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  white-space: nowrap;
}

.vital__marcar:hover:not(:disabled) {
  background: var(--superficie-2);
  color: var(--tinta);
}

.vital__marcar[aria-pressed='true'] {
  background: var(--neutro-fundo);
  color: var(--neutro-tinta);
  font-weight: 600;
}

.vital__marcar:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.vital__marcar:focus-visible {
  outline: 2px solid var(--pj-lugar, var(--musgo));
  outline-offset: 1px;
}

/* O número é o conteúdo do campo: maior, tabular e alinhado à direita, como em prontuário. */
.vital__campo :deep(input) {
  font-family: var(--font-dados);
  font-size: 18px !important;
  font-variant-numeric: tabular-nums;
  font-weight: 650;
  letter-spacing: -0.01em;
  text-align: end;
}

.vital--acima .vital__campo :deep(input),
.vital--abaixo .vital__campo :deep(input) {
  border-color: var(--risco);
  color: var(--risco-tinta);
}

.vital--dentro .vital__campo :deep(input) {
  border-color: color-mix(in oklab, var(--ok) 60%, var(--linha-forte));
}

.vital__rodape {
  display: grid;
  min-height: 22px;
  align-items: start;
  gap: 4px 8px;
  grid-template-columns: minmax(0, 1fr) auto;
}

.vital__leitura {
  display: flex;
  min-width: 0;
  min-height: 22px;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 8px;
}

.vital__situacao {
  height: 22px;
  padding: 0 7px;
  font-size: 12px;
}

.vital__ok {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  color: var(--ok-tinta);
  font-size: 12.5px;
  font-weight: 600;
}

.vital__faixa {
  color: var(--tinta-3);
  font-size: 12.5px;
}

/* ------------------------------------------------------------------ perfusão e sistemas */

/*
 * Mucosas e hidratação lado a lado. Em tela estreita empilham — são duas escolhas com seis e
 * quatro opções, e espremê-las na mesma linha quebraria os botões ao meio.
 */
.perfusao {
  display: grid;
  gap: 16px 32px;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
}

.sistemas {
  display: grid;
  margin: 0;
  padding: 0;
  border: 1px solid var(--linha);
  border-radius: 12px;
  list-style: none;
}

/*
 * O controle fica logo depois do nome, não na outra ponta da linha: comparar oito sistemas não
 * pode custar ao olho sessenta por cento de vazio a cada linha.
 */
.sistema {
  position: relative;
  display: grid;
  min-height: 52px;
  align-items: center;
  gap: 8px 16px;
  padding: 7px 12px 7px 16px;
  grid-template-columns: minmax(7rem, 10rem) auto minmax(0, 1fr);
}

.sistema + .sistema {
  border-top: 1px solid var(--linha);
}

/* Sistema alterado é onde a consulta tem conteúdo: ganha o fundo e a marca de atenção. */
.sistema--alterado {
  background: color-mix(in oklab, var(--atencao-fundo) 60%, var(--superficie));
}

.sistema:first-child {
  border-radius: 11px 11px 0 0;
}

.sistema:last-child {
  border-radius: 0 0 11px 11px;
}

.sistema__nome {
  overflow: hidden;
  color: var(--tinta);
  font-size: 14.5px;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Sem avaliação ainda, o nome recua — a linha existe, mas não pede leitura. */
.sistema--nao-avaliado .sistema__nome {
  color: var(--tinta-2);
  font-weight: 500;
}

/*
 * A nota desce para a linha de baixo, sob a escolha, e vai até a borda. Na terceira coluna ela
 * ficava com o que sobrava depois do grupo (130 px com o histórico aberto) e o achado escrito
 * ("Dor à extensão do quadril esquerdo, sem crepitação") se lia como "aveta negativo".
 */
.sistema__nota.p-inputtext {
  width: 100%;
  padding-block: 7px;
  grid-column: 2 / -1;
}

@media (max-width: 900px) {
  .sistema {
    grid-template-columns: minmax(0, 1fr);
  }

  .sistema__nota.p-inputtext {
    grid-column: 1 / -1;
  }
}
</style>
