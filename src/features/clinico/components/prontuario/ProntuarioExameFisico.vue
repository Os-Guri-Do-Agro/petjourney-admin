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
 * Sobre a forma: cada vital ocupava dois blocos empilhados — o campo e um cartão repetindo o
 * rótulo para mostrar a faixa. Agora é um bloco só, com o julgamento numa linha discreta sob o
 * campo. E os oito sistemas viraram escolhas em linha: o campo de observação **só aparece
 * quando o achado é "alterado"**, porque é o único caso em que há o que escrever.
 */
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicField from '../base/ClinicField.vue'
import ClinicForm from '../base/ClinicForm.vue'
import ClinicRefValue from '../base/ClinicRefValue.vue'
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
import { medicaoPreenchida } from '../../domain/ranges'
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

const aferidos = computed(() => VITAIS.filter((vital) => medicaoPreenchida(medicao(vital))).length)

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
      <span class="contador clinic-value">
        {{
          t('clinico.prontuario.passos.vitaisAferidos', {
            preenchidos: aferidos,
            total: VITAIS.length,
          })
        }}
      </span>
    </template>

    <div class="vitais">
      <!--
        Cada vital é uma ficha de medição, não um campo solto: rótulo curto (a unidade mora
        dentro do campo, o que evita "Frequência respiratória · mpm" quebrando em duas linhas),
        número grande e tabular, e o rodapé com a faixa — ou com o julgamento, assim que houver
        valor. A decisão de não medir fica no rodapé, escrita, e apaga a ficha inteira.
      -->
      <label
        v-for="vital in VITAIS"
        :key="vital"
        class="vital"
        :class="{
          'vital--nao-aferido': medicao(vital).naoAferido,
          'vital--preenchido': medicaoPreenchida(medicao(vital)) && !medicao(vital).naoAferido,
        }"
      >
        <span class="vital__rotulo">{{ t(`clinico.prontuario.exameFisico.${vital}`) }}</span>

        <InputNumber
          class="vital__campo"
          :model-value="medicao(vital).valor"
          :min-fraction-digits="casasDe(vital)"
          :max-fraction-digits="casasDe(vital)"
          :suffix="unidadeDe(vital) ? ` ${unidadeDe(vital)}` : undefined"
          :placeholder="medicao(vital).naoAferido ? t('clinico.prontuario.naoAferido') : '—'"
          :disabled="somenteLeitura || medicao(vital).naoAferido"
          :aria-label="t(`clinico.prontuario.exameFisico.${vital}`)"
          fluid
          @update:model-value="aplicarVital(vital, { valor: $event ?? null })"
        />

        <span class="vital__rodape">
          <ClinicRefValue
            v-if="medicaoPreenchida(medicao(vital)) && !medicao(vital).naoAferido"
            variante="linha"
            :rotulo="t(`clinico.prontuario.exameFisico.${vital}`)"
            :valor="medicao(vital)"
            :faixa="faixaDe(vital)"
            compacto
          />
          <span v-else-if="faixaDe(vital)" class="vital__faixa">
            {{ formato.faixaDeReferencia(faixaDe(vital)) }}
          </span>
          <span v-else />

          <button
            type="button"
            class="vital__marcar clinic-focusable"
            :class="{ 'vital__marcar--ativo': medicao(vital).naoAferido }"
            :aria-pressed="medicao(vital).naoAferido"
            :disabled="somenteLeitura"
            @click.prevent="
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
      </label>
    </div>

    <!--
      Mucosas e hidratação ficam **entre** os vitais e os sistemas, e não dentro de nenhum dos
      dois: não têm número nem faixa (então não são vitais), e não são um dos oito sistemas.
      São a leitura de perfusão que o vet faz assim que põe a mão no paciente, e é nessa ordem
      que ela acontece.
    -->
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

    <fieldset class="sistemas">
      <legend class="clinic-label">
        {{ t('clinico.prontuario.exameFisico.sistemas') }}
        <span v-if="alterados > 0" class="sistemas__contagem">
          {{ t('clinico.prontuario.passos.sistemasAlterados', { contagem: alterados }, alterados) }}
        </span>
      </legend>

      <div
        v-for="sistema in SISTEMAS"
        :key="sistema"
        class="sistema"
        :class="[
          `sistema--${achado(sistema).status}`,
          { 'sistema--alterado': achado(sistema).status === 'alterado' },
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
          :model-value="achado(sistema).nota"
          :placeholder="t('clinico.prontuario.exameFisico.notaAlterado')"
          :aria-label="t('clinico.prontuario.exameFisico.notaAlterado')"
          :disabled="somenteLeitura"
          fluid
          @update:model-value="aplicarSistema(sistema, { nota: $event ?? '' })"
        />
        <span v-else />
      </div>
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
  color: var(--clinic-faint);
  font-weight: 700;
}

.vitais {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 11.5rem), 1fr));
  gap: var(--clinic-space-3);
}

.vital {
  display: grid;
  align-content: start;
  gap: var(--clinic-space-2);
  min-width: 0;
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface);
  cursor: text;
  transition:
    border-color 120ms ease,
    background 120ms ease;
}

.vital:hover {
  border-color: var(--clinic-line-strong);
}

/* Ficha preenchida ganha corpo: numa fileira de sete, o que já foi medido salta. */
.vital--preenchido {
  border-color: var(--clinic-accent);
  background: color-mix(in srgb, var(--clinic-accent-tint) 45%, var(--clinic-surface));
}

/* Não medir é decisão registrada, não campo vazio: a ficha apaga, mas continua legível. */
.vital--nao-aferido {
  background: var(--clinic-surface-sunken);
  cursor: default;
}

.vital__rotulo {
  overflow: hidden;
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-weight: 750;
  letter-spacing: 0.06em;
  text-overflow: ellipsis;
  text-transform: uppercase;
  white-space: nowrap;
}

/* O número é o conteúdo da ficha: maior, tabular e alinhado à direita, como em prontuário. */
.vital__campo :deep(input) {
  padding-inline: var(--clinic-space-2);
  font-size: 1.05rem;
  font-variant-numeric: tabular-nums;
  font-weight: 750;
  letter-spacing: -0.02em;
  text-align: right;
}

.vital__rodape {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-2);
  min-height: 1.15rem;
}

.vital__faixa {
  overflow: hidden;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
  font-variant-numeric: tabular-nums;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/*
 * "Não medir" é texto, não um ícone de proibido: o ícone dizia "bloqueado" quando o que se
 * quer dizer é "decidi não aferir". Discreto enquanto é oferta, marcado quando é registro.
 */
.vital__marcar {
  flex: 0 0 auto;
  padding: 0.1rem 0.4rem;
  border: 1px solid transparent;
  border-radius: var(--clinic-radius-chip);
  background: transparent;
  color: var(--clinic-faint);
  cursor: pointer;
  font: inherit;
  font-size: var(--clinic-font-label);
  font-weight: 700;
  white-space: nowrap;
}

.vital__marcar:hover:not(:disabled) {
  background: var(--clinic-surface-sunken);
  color: var(--clinic-muted);
}

.vital__marcar--ativo {
  border-color: var(--clinic-neutral-line);
  background: var(--clinic-neutral-bg);
  color: var(--clinic-neutral-text);
}

.vital__marcar:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/*
 * Mucosas e hidratação lado a lado. Em tela estreita empilham — são duas escolhas com seis e
 * quatro opções, e espremê-las na mesma linha quebraria as fichas ao meio.
 */
.perfusao {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(100%, 18rem), 1fr));
  gap: var(--clinic-space-3) var(--clinic-space-5);
}

.sistemas {
  display: grid;
  gap: 0.15rem;
  margin: 0;
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
}

.sistemas legend {
  display: flex;
  align-items: center;
  gap: var(--clinic-space-2);
  padding-inline: var(--clinic-space-2);
}

.sistemas__contagem {
  padding: 0 0.35rem;
  border-radius: var(--clinic-radius-chip);
  background: var(--clinic-attention-bg);
  color: var(--clinic-attention-text);
  letter-spacing: 0;
  text-transform: none;
}

/*
 * O controle fica logo depois do nome, não na outra ponta da linha. Com o nome à esquerda e a
 * escolha encostada na borda direita, o olho percorria sessenta por cento de vazio a cada uma
 * das oito linhas — e comparar sistemas virava trabalho.
 */
.sistema {
  display: grid;
  grid-template-columns: minmax(6rem, 9rem) auto minmax(0, 1fr);
  align-items: center;
  gap: var(--clinic-space-2) var(--clinic-space-3);
  padding: 0.25rem var(--clinic-space-2);
  border-bottom: 1px solid var(--clinic-line-soft);
  border-radius: var(--clinic-radius-control);
}

.sistema:last-of-type {
  border-bottom: none;
}

/* Sistema alterado é onde a consulta tem conteúdo: ganha fundo e marca na lateral. */
.sistema--alterado {
  background: color-mix(in srgb, var(--clinic-attention-bg) 55%, var(--clinic-surface));
}

/* Sem avaliação ainda, o nome recua — a linha existe, mas não pede leitura. */
.sistema--nao-avaliado .sistema__nome {
  color: var(--clinic-muted);
  font-weight: 600;
}

.sistema__nome {
  overflow: hidden;
  font-weight: 700;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 900px) {
  .sistema {
    grid-template-columns: 1fr;
  }
}
</style>
