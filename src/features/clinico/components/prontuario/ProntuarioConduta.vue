<script setup lang="ts">
/**
 * Conduta: orientações, exames, prescrição e retorno.
 *
 * O que este componente não deixa passar em silêncio:
 *
 * - **A dose aparece por extenso.** "2 mL (500 mg) a cada 8 h por 5 dias — 15 administrações"
 *   é conferível em voz alta com o responsável; "500" num campo não é.
 * - **Alergia registrada exige confirmação explícita.** Prescrever segue possível — proibir
 *   empurraria a prescrição para fora do sistema —, mas com um aceite nomeado.
 * - **Retorno sem horário é pendência visível**, não um número esquecido no rodapé.
 */
import Button from 'primevue/button'
import InputNumber from 'primevue/inputnumber'
import MultiSelect from 'primevue/multiselect'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, ref } from 'vue'
import { useI18n } from 'vue-i18n'

import BularioPicker from '../bulario/BularioPicker.vue'
import ClinicAlertChip from '../base/ClinicAlertChip.vue'
import ClinicField from '../base/ClinicField.vue'
import ClinicForm from '../base/ClinicForm.vue'
import { useClinicFormat } from '../../composables/useClinicFormat'
import type {
  CarePlan,
  Medication,
  Pet,
  Prescription,
  PrescriptionRoute,
} from '../../data/types'
import { avisosDoMedicamento, sugestaoDePrescricao } from '../../domain/bulario'
import {
  alergiaConflitante,
  avaliarDose,
  calcularDose,
  faixaDeReferencia,
} from '../../domain/dose'
import { fracionar, passosDaConta, type PassoDaConta } from '../../domain/receita'
import { useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  valor: CarePlan
  pet: Pet | null
  /** Peso vigente do exame físico — a dose acompanha o que foi pesado hoje. */
  pesoKg: number | null
  somenteLeitura: boolean
  motivoLeitura: string
}>()

const emit = defineEmits<{
  atualizar: [patch: { conduta: CarePlan }]
  agendarRetorno: []
}>()

const { t } = useI18n()
const clinico = useClinicoStore()
const formato = useClinicFormat()

/** Escrito como variável CSS porque quem desenha o rótulo é uma regra global (ver tokens). */
const rotuloTodos = computed(() => ({
  '--clinic-rotulo-todos': JSON.stringify(t('clinico.comum.todos')),
}))

const opcoesExames = computed(() =>
  clinico.exames.map((exame) => ({ valor: exame.id, rotulo: exame.nome })),
)

const opcoesMedicamentos = computed(() =>
  clinico.medicamentos.map((medicamento) => ({
    valor: medicamento.id,
    rotulo: medicamento.nome,
  })),
)

const opcoesTipoRetorno = computed(() =>
  clinico.tipos.map((tipo) => ({ valor: tipo.id, rotulo: tipo.nome })),
)

function aplicar(patch: Partial<CarePlan>) {
  emit('atualizar', { conduta: { ...props.valor, ...patch } })
}

function aplicarPrescricao(id: string, patch: Partial<Prescription>) {
  aplicar({
    prescricoes: props.valor.prescricoes.map((item) =>
      item.id === id ? { ...item, ...patch } : item,
    ),
  })
}

/** Recalcula o número sempre que peso, dose, frequência ou duração mudam. */
function recalcular(prescricao: Prescription, mudanca: Partial<Prescription['calculo']>) {
  const medicamento = clinico.medicamento(prescricao.medicamentoId)

  if (!medicamento) {
    return
  }

  const entrada = {
    medicamento,
    pesoKg: props.pesoKg,
    mgPorKg: mudanca.mgPorKg ?? prescricao.calculo.mgPorKg,
    frequenciaHoras: mudanca.frequenciaHoras ?? prescricao.calculo.frequenciaHoras,
    duracaoDias: mudanca.duracaoDias ?? prescricao.calculo.duracaoDias,
  }

  const calculo = calcularDose(entrada)

  aplicarPrescricao(prescricao.id, {
    calculo: calculo ?? { ...prescricao.calculo, ...mudanca, pesoKg: props.pesoKg ?? 0 },
  })
}

function adicionarPrescricao() {
  const medicamento = clinico.medicamentos[0]

  if (!medicamento) {
    return
  }

  const sugestao = sugestaoDePrescricao(medicamento, props.pet)
  const calculo = calcularDose({ medicamento, pesoKg: props.pesoKg, ...sugestao })

  aplicar({
    prescricoes: [
      ...props.valor.prescricoes,
      {
        id: `presc-${props.valor.prescricoes.length}-${medicamento.id}`,
        medicamentoId: medicamento.id,
        via: medicamento.viasPermitidas[0] ?? 'oral',
        calculo: calculo ?? {
          medicamentoId: medicamento.id,
          pesoKg: 0,
          mgPorAdministracao: 0,
          quantidadeApresentacao: 0,
          totalAdministracoes: 0,
          ...sugestao,
        },
        observacao: '',
        alergiaConfirmada: false,
      },
    ],
  })
}

function removerPrescricao(id: string) {
  aplicar({ prescricoes: props.valor.prescricoes.filter((item) => item.id !== id) })
}

function opcoesVia(prescricao: Prescription) {
  const medicamento = clinico.medicamento(prescricao.medicamentoId)
  const vias: PrescriptionRoute[] = medicamento?.viasPermitidas ?? ['oral']

  return vias.map((valor) => ({ valor, rotulo: t(`clinico.prontuario.conduta.via_.${valor}`) }))
}

function alergiaDe(prescricao: Prescription) {
  const medicamento = clinico.medicamento(prescricao.medicamentoId)

  if (!medicamento || !props.pet) {
    return null
  }

  return alergiaConflitante(props.pet, medicamento)
}

function avisoDaDose(prescricao: Prescription) {
  const medicamento = clinico.medicamento(prescricao.medicamentoId)

  if (!medicamento) {
    return null
  }

  return avaliarDose({
    medicamento,
    pesoKg: props.pesoKg,
    mgPorKg: prescricao.calculo.mgPorKg,
    frequenciaHoras: prescricao.calculo.frequenciaHoras,
    duracaoDias: prescricao.calculo.duracaoDias,
    especie: props.pet?.especie ?? null,
  })
}

/** A faixa citada no aviso é a da espécie do paciente — a geral só entra quando não há a dele. */
function faixaDoAviso(prescricao: Prescription) {
  const medicamento = clinico.medicamento(prescricao.medicamentoId)

  if (!medicamento) {
    return { min: 0, max: 0 }
  }

  return faixaDeReferencia(medicamento, props.pet?.especie ?? null)
}

/**
 * Avisos do bulário que não são alergia: condição crônica, gestação, idade, espécie proibida.
 *
 * A alergia continua com bloco próprio porque ela tem aceite explícito; estes aqui informam.
 */
function avisosDoBulario(prescricao: Prescription) {
  const medicamento = clinico.medicamento(prescricao.medicamentoId)

  if (!medicamento) {
    return []
  }

  return avisosDoMedicamento(medicamento, props.pet, new Date()).filter(
    (aviso) => aviso.kind !== 'alergia',
  )
}

function textoDoAviso(kind: string, cuidado: string | null, detalhe: string) {
  if (kind === 'cuidado' && cuidado) {
    return t(`clinico.bulario.cuidado.${cuidado}`, { detalhe })
  }

  return t(`clinico.bulario.aviso.${kind}`, { detalhe })
}

/* --- Seletor do bulário --------------------------------------------------- */

const pickerVisivel = ref(false)
const prescricaoEmEdicao = ref<string | null>(null)

function abrirBulario(prescricaoId: string) {
  prescricaoEmEdicao.value = prescricaoId
  pickerVisivel.value = true
}

/**
 * Troca o medicamento **e a dose junto**.
 *
 * Trocar só o identificador deixava o mg/kg da escolha anterior no campo: sair de meloxicam
 * canino para carprofeno mantinha 0,1 mg/kg, que é vinte vezes menos que a dose do carprofeno.
 * O bulário devolve a sugestão da espécie do paciente e o cálculo refaz a conta inteira.
 */
function aplicarEscolhaDoBulario(escolha: {
  medicamento: Medication
  mgPorKg: number
  frequenciaHoras: number
  duracaoDias: number
}) {
  const prescricaoId = prescricaoEmEdicao.value

  if (!prescricaoId) {
    return
  }

  const calculo = calcularDose({
    medicamento: escolha.medicamento,
    pesoKg: props.pesoKg,
    mgPorKg: escolha.mgPorKg,
    frequenciaHoras: escolha.frequenciaHoras,
    duracaoDias: escolha.duracaoDias,
  })

  aplicarPrescricao(prescricaoId, {
    medicamentoId: escolha.medicamento.id,
    via: escolha.medicamento.viasPermitidas[0] ?? 'oral',
    alergiaConfirmada: false,
    calculo: calculo ?? {
      medicamentoId: escolha.medicamento.id,
      mgPorKg: escolha.mgPorKg,
      pesoKg: props.pesoKg ?? 0,
      mgPorAdministracao: 0,
      quantidadeApresentacao: 0,
      frequenciaHoras: escolha.frequenciaHoras,
      duracaoDias: escolha.duracaoDias,
      totalAdministracoes: 0,
    },
  })
}

/**
 * Os passos da conta, para o vet conferir de cabeça.
 *
 * O requisito é explícito: *"a conta precisa aparecer, não só o resultado"*. Um número pronto
 * num campo não se confere — e conferir de cabeça é o que impede o erro de vírgula de virar
 * erro de paciente.
 */
function contaDaPrescricao(prescricao: Prescription) {
  const medicamento = clinico.medicamento(prescricao.medicamentoId)

  return medicamento ? passosDaConta(prescricao.calculo, medicamento) : []
}

function textoDoPasso(passo: PassoDaConta) {
  return t(`clinico.prontuario.conduta.conta.${passo.kind}`, passo.params)
}

/**
 * Como a quantidade é dita a quem vai dar o remédio.
 *
 * "0,5 comprimido" é resultado de divisão; ninguém parte um comprimido em 0,5. O responsável
 * precisa de "meio comprimido" — e o vet precisa saber quando a conta **não** cai numa fração
 * que dê para partir na mão, porque essa decisão é dele.
 */
function fracionamentoDe(prescricao: Prescription) {
  const medicamento = clinico.medicamento(prescricao.medicamentoId)

  if (!medicamento) {
    return null
  }

  return fracionar(prescricao.calculo.quantidadeApresentacao, medicamento.unidadeApresentacao)
}

/** Uso contínuo: sem data de fim. Não é duração longa — é a ausência de duração. */
function ehContinuo(prescricao: Prescription) {
  return prescricao.calculo.duracaoDias === null
}

function alternarContinuo(prescricao: Prescription) {
  recalcular(prescricao, { duracaoDias: ehContinuo(prescricao) ? 7 : null })
}

function resumoDaDose(prescricao: Prescription) {
  const medicamento = clinico.medicamento(prescricao.medicamentoId)

  if (!medicamento || prescricao.calculo.quantidadeApresentacao <= 0) {
    return t('clinico.prontuario.conduta.semPeso')
  }

  return t('clinico.prontuario.conduta.resumoDose', {
    quantidade: formato.numero(prescricao.calculo.quantidadeApresentacao, 2),
    unidade: t(
      `clinico.prontuario.conduta.unidade.${medicamento.unidadeApresentacao}`,
      prescricao.calculo.quantidadeApresentacao,
    ),
    mg: formato.numero(prescricao.calculo.mgPorAdministracao, 1),
    frequencia: prescricao.calculo.frequenciaHoras,
    duracao: prescricao.calculo.duracaoDias,
    total: prescricao.calculo.totalAdministracoes,
  })
}
</script>

<template>
  <ClinicForm
    :titulo="t('clinico.prontuario.conduta.titulo')"
    :descricao="t('clinico.prontuario.conduta.descricao')"
    :colunas="1"
    ancora="conduta"
    :somente-leitura="somenteLeitura"
    :motivo-somente-leitura="motivoLeitura"
  >
    <ClinicField :rotulo="t('clinico.prontuario.conduta.orientacoes')" largo>
      <template #default="{ id }">
        <Textarea
          :id="id"
          :model-value="valor.orientacoes"
          rows="3"
          auto-resize
          fluid
          :disabled="somenteLeitura"
          @update:model-value="aplicar({ orientacoes: $event ?? '' })"
        />
      </template>
    </ClinicField>

    <ClinicField :rotulo="t('clinico.prontuario.conduta.exames')" largo>
      <template #default="{ id }">
        <MultiSelect
          :input-id="id"
          :model-value="valor.examesSolicitados"
          :options="opcoesExames"
          option-label="rotulo"
          option-value="valor"
          display="chip"
          fluid
          :disabled="somenteLeitura"
          :pt="{
            overlay: {
              class: 'clinic-overlay',
              /*
               * O rótulo 'Todos' do seletor de tudo chega por variável CSS, com o texto já
               * traduzido: o overlay é teleportado para fora do escopo e a regra que o desenha
               * é global, então ela não tem como saber o idioma da tela.
               */
              style: rotuloTodos,
            },
          }"
          @update:model-value="aplicar({ examesSolicitados: $event ?? [] })"
        />
      </template>
    </ClinicField>

    <!-- ------------------------------------------------------------- prescrição -->
    <section class="prescricoes">
      <header class="prescricoes__topo">
        <h4 class="clinic-label">{{ t('clinico.prontuario.conduta.prescricoes') }}</h4>
        <Button
          v-if="!somenteLeitura"
          :label="t('clinico.prontuario.conduta.adicionarPrescricao')"
          icon="pi pi-plus"
          size="small"
          severity="secondary"
          outlined
          @click="adicionarPrescricao"
        />
      </header>

      <p v-if="valor.prescricoes.length === 0" class="vazio">
        {{ t('clinico.prontuario.conduta.semPrescricao') }}
      </p>

      <article
        v-for="prescricao in valor.prescricoes"
        :key="prescricao.id"
        class="prescricao"
        :class="{ 'prescricao--alerta': Boolean(alergiaDe(prescricao)) }"
      >
        <div class="prescricao__linha">
          <ClinicField :rotulo="t('clinico.prontuario.conduta.medicamento')">
            <template #default="{ id }">
              <div class="prescricao__medicamento">
                <Select
                  :input-id="id"
                  :model-value="prescricao.medicamentoId"
                  :options="opcoesMedicamentos"
                  option-label="rotulo"
                  option-value="valor"
                  fluid
                  :disabled="somenteLeitura"
                  :pt="{ overlay: { class: 'clinic-overlay' } }"
                  @update:model-value="
                    aplicarPrescricao(prescricao.id, {
                      medicamentoId: $event,
                      alergiaConfirmada: false,
                    })
                  "
                />

                <!--
                  O atalho para o bulário fica ao lado do campo, não escondido num menu: é
                  daqui que sai a dose da espécie certa, e ela é a razão de o bulário existir.
                -->
                <Button
                  v-if="!somenteLeitura"
                  icon="pi pi-book"
                  severity="secondary"
                  outlined
                  :aria-label="t('clinico.bulario.escolherTitulo')"
                  :title="t('clinico.bulario.escolherTitulo')"
                  @click="abrirBulario(prescricao.id)"
                />
              </div>
            </template>
          </ClinicField>

          <ClinicField :rotulo="t('clinico.prontuario.conduta.via')">
            <template #default="{ id }">
              <Select
                :input-id="id"
                :model-value="prescricao.via"
                :options="opcoesVia(prescricao)"
                option-label="rotulo"
                option-value="valor"
                fluid
                :disabled="somenteLeitura"
                :pt="{ overlay: { class: 'clinic-overlay' } }"
                @update:model-value="aplicarPrescricao(prescricao.id, { via: $event })"
              />
            </template>
          </ClinicField>

          <!--
            Remover mora **na linha**, não flutuando sobre ela.
            Antes era `position: absolute` no canto do cartão: caía por cima do rótulo "Via" e
            encostava no seletor. Como terceira coluna, ele ganha a própria faixa e desce até a
            altura dos campos, alinhado com eles.
          -->
          <Button
            v-if="!somenteLeitura"
            icon="pi pi-trash"
            severity="danger"
            text
            class="prescricao__remover"
            :aria-label="t('clinico.prontuario.diagnostico.remover')"
            :title="t('clinico.prontuario.diagnostico.remover')"
            @click="removerPrescricao(prescricao.id)"
          />
        </div>

        <div class="prescricao__linha prescricao__linha--numeros">
          <ClinicField :rotulo="t('clinico.prontuario.conduta.dosePorKg')">
            <template #default="{ id }">
              <InputNumber
                :input-id="id"
                :model-value="prescricao.calculo.mgPorKg"
                :min-fraction-digits="1"
                :max-fraction-digits="2"
                :disabled="somenteLeitura"
                fluid
                @update:model-value="recalcular(prescricao, { mgPorKg: $event ?? 0 })"
              />
            </template>
          </ClinicField>

          <ClinicField :rotulo="t('clinico.prontuario.conduta.frequencia')">
            <template #default="{ id }">
              <InputNumber
                :input-id="id"
                :model-value="prescricao.calculo.frequenciaHoras"
                :disabled="somenteLeitura"
                fluid
                @update:model-value="recalcular(prescricao, { frequenciaHoras: $event ?? 12 })"
              />
            </template>
          </ClinicField>

          <ClinicField :rotulo="t('clinico.prontuario.conduta.duracao')">
            <template #default="{ id }">
              <div class="duracao">
                <InputNumber
                  :input-id="id"
                  :model-value="prescricao.calculo.duracaoDias"
                  :disabled="somenteLeitura || ehContinuo(prescricao)"
                  :placeholder="ehContinuo(prescricao) ? '—' : undefined"
                  fluid
                  @update:model-value="recalcular(prescricao, { duracaoDias: $event ?? 1 })"
                />

                <!--
                  Uso contínuo é um estado, não um número grande. Anti-hipertensivo com "365
                  dias" faz a receita vencer sozinha e o lembrete do responsável parar num dia
                  arbitrário — e, num contínuo, parar é o efeito adverso.
                -->
                <button
                  type="button"
                  class="duracao__continuo clinic-focusable"
                  :class="{ 'duracao__continuo--ativo': ehContinuo(prescricao) }"
                  :aria-pressed="ehContinuo(prescricao)"
                  :disabled="somenteLeitura"
                  @click="alternarContinuo(prescricao)"
                >
                  {{ t('clinico.prontuario.conduta.usoContinuo') }}
                </button>
              </div>
            </template>
          </ClinicField>
        </div>

        <!--
          A conta, aberta. Cada linha é um passo que o vet confere de cabeça; é aqui que um erro
          de concentração aparece antes de a receita sair impressa.
        -->
        <ol v-if="contaDaPrescricao(prescricao).length > 0" class="conta">
          <li v-for="(passo, indice) in contaDaPrescricao(prescricao)" :key="indice">
            {{ textoDoPasso(passo) }}
          </li>
        </ol>

        <!-- A dose por extenso: é isto que se lê em voz alta para o responsável. -->
        <p class="prescricao__resumo clinic-value">{{ resumoDaDose(prescricao) }}</p>

        <!--
          Fracionamento em palavra, não em decimal. E quando a conta não cai numa fração
          partível, a tela diz — em vez de imprimir 0,37 comprimido e deixar a decisão para
          quem está segurando o animal.
        -->
        <p v-if="fracionamentoDe(prescricao)" class="fracao" :class="{ 'fracao--aproximada': fracionamentoDe(prescricao)!.aproximado }">
          <i
            :class="fracionamentoDe(prescricao)!.aproximado ? 'pi pi-exclamation-circle' : 'pi pi-check-circle'"
            aria-hidden="true"
          />
          <span>
            {{
              t(`clinico.prontuario.conduta.fracao.${fracionamentoDe(prescricao)!.kind}`, {
                inteiros: fracionamentoDe(prescricao)!.inteiros,
                quantidade: formato.numero(fracionamentoDe(prescricao)!.quantidade, 2),
              })
            }}
            <template v-if="fracionamentoDe(prescricao)!.aproximado">
              — {{ t('clinico.prontuario.conduta.fracao.arredondado', {
                calculado: formato.numero(prescricao.calculo.quantidadeApresentacao, 2),
              }) }}
            </template>
          </span>
        </p>

        <ClinicAlertChip
          v-if="avisoDaDose(prescricao)"
          severidade="atencao"
          :rotulo="
            t(`clinico.prontuario.conduta.avisoDose.${avisoDaDose(prescricao)}`, {
              min: faixaDoAviso(prescricao).min,
              max: faixaDoAviso(prescricao).max,
            })
          "
        />

        <ClinicAlertChip
          v-for="(aviso, indice) in avisosDoBulario(prescricao)"
          :key="`${prescricao.id}-${aviso.kind}-${aviso.cuidado ?? indice}`"
          :severidade="aviso.kind === 'especie-proibida' ? 'risco' : 'atencao'"
          :rotulo="textoDoAviso(aviso.kind, aviso.cuidado, aviso.detalhe)"
        />

        <!-- Alergia: confirmação explícita, não bloqueio. -->
        <div v-if="alergiaDe(prescricao)" class="alergia">
          <strong>
            {{
              t('clinico.prontuario.conduta.alergiaTitulo', {
                principio: alergiaDe(prescricao)?.detalhe,
              })
            }}
          </strong>
          <p>
            {{
              t('clinico.prontuario.conduta.alergiaDescricao', {
                principio: alergiaDe(prescricao)?.detalhe,
              })
            }}
          </p>
          <label class="alergia__aceite">
            <input
              type="checkbox"
              :checked="prescricao.alergiaConfirmada"
              :disabled="somenteLeitura"
              @change="
                aplicarPrescricao(prescricao.id, {
                  alergiaConfirmada: ($event.target as HTMLInputElement).checked,
                })
              "
            />
            <span>{{ t('clinico.prontuario.conduta.alergiaConfirmar') }}</span>
          </label>
        </div>
      </article>
    </section>

    <!-- ---------------------------------------------------------------- retorno -->
    <section class="retorno">
      <h4 class="clinic-label">{{ t('clinico.prontuario.conduta.retorno') }}</h4>

      <div class="retorno__linha">
        <ClinicField :rotulo="t('clinico.prontuario.conduta.retornoEmDias')">
          <template #default="{ id }">
            <InputNumber
              :input-id="id"
              :model-value="valor.retorno.emDias"
              :disabled="somenteLeitura"
              fluid
              @update:model-value="
                aplicar({ retorno: { ...valor.retorno, emDias: $event ?? null } })
              "
            />
          </template>
        </ClinicField>

        <ClinicField :rotulo="t('clinico.prontuario.conduta.retornoTipo')">
          <template #default="{ id }">
            <Select
              :input-id="id"
              :model-value="valor.retorno.typeId"
              :options="opcoesTipoRetorno"
              option-label="rotulo"
              option-value="valor"
              show-clear
              fluid
              :disabled="somenteLeitura"
              :pt="{ overlay: { class: 'clinic-overlay' } }"
              @update:model-value="
                aplicar({ retorno: { ...valor.retorno, typeId: $event ?? null } })
              "
            />
          </template>
        </ClinicField>

        <Button
          v-if="valor.retorno.emDias !== null && !valor.retorno.appointmentId"
          :label="t('clinico.prontuario.conduta.retornoAgendar')"
          icon="pi pi-calendar-plus"
          size="small"
          :disabled="somenteLeitura"
          @click="emit('agendarRetorno')"
        />
      </div>

      <p v-if="valor.retorno.emDias !== null && !valor.retorno.appointmentId" class="retorno__aviso">
        <i class="pi pi-exclamation-circle" aria-hidden="true" />
        {{ t('clinico.prontuario.conduta.retornoPendente') }}
      </p>
    </section>
    <BularioPicker
      v-model:visivel="pickerVisivel"
      :medicamentos="clinico.medicamentos"
      :pet="pet"
      :atual-id="
        valor.prescricoes.find((item) => item.id === prescricaoEmEdicao)?.medicamentoId ?? null
      "
      @escolher="aplicarEscolhaDoBulario"
    />
  </ClinicForm>
</template>

<style scoped>
/* Campo e atalho do bulário na mesma linha: o botão não deve empurrar o Select para baixo. */
.prescricao__medicamento {
  display: grid;
  gap: var(--clinic-space-2);
  grid-template-columns: minmax(0, 1fr) auto;
}

.prescricoes {
  display: grid;
  gap: var(--clinic-space-3);
}

.prescricoes__topo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-3);
}

.prescricao {
  display: grid;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
}

.prescricao--alerta {
  border-color: var(--clinic-risk-line);
}

.prescricao__linha {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) auto;
  gap: var(--clinic-space-3);
}

/* A linha de números não tem o botão de remover: três colunas iguais e nada mais. */
.prescricao__linha--numeros {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.duracao {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--clinic-space-2);
}

.duracao__continuo {
  min-height: var(--clinic-hit-target);
  padding: 0 var(--clinic-space-3);
  border: 1px solid var(--clinic-line-strong);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface);
  color: var(--clinic-muted);
  cursor: pointer;
  font: inherit;
  font-size: var(--clinic-font-label);
  font-weight: 700;
  white-space: nowrap;
}

.duracao__continuo--ativo {
  border-color: var(--clinic-accent-strong);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
}

.duracao__continuo:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

/*
 * A conta em passos numerados: a numeração aqui **é** informação — é a ordem em que se confere,
 * e cada linha depende da anterior.
 */
.conta {
  display: grid;
  gap: 0.1rem;
  margin: 0;
  padding: var(--clinic-space-2) var(--clinic-space-3) var(--clinic-space-2) var(--clinic-space-5);
  border: 1px dashed var(--clinic-line-strong);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-surface-soft);
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
  font-variant-numeric: tabular-nums;
  line-height: 1.5;
}

.fracao {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  margin: 0;
  color: var(--clinic-ok-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
  line-height: 1.45;
}

/* Arredondamento é decisão do vet: aparece em tom de atenção, não como confirmação. */
.fracao--aproximada {
  color: var(--clinic-attention-text);
}

.prescricao__resumo {
  margin: 0;
  padding: var(--clinic-space-3);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-accent-tint);
  color: var(--clinic-accent-strong);
  font-weight: 700;
  line-height: 1.5;
}

/*
 * Alinhado com os campos, não com os rótulos: `end` desce o botão até a base da linha, que é
 * onde os seletores estão. Alinhado ao topo, ele ficaria na altura do texto "Via".
 */
.prescricao__remover {
  align-self: end;
  margin-bottom: 1px;
}

.alergia {
  display: grid;
  gap: var(--clinic-space-2);
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-risk-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-risk-bg);
  color: var(--clinic-risk-text);
}

.alergia p {
  margin: 0;
  line-height: 1.5;
}

.alergia__aceite {
  display: flex;
  align-items: flex-start;
  gap: 0.4rem;
  cursor: pointer;
  font-weight: 750;
}

.retorno {
  display: grid;
  gap: var(--clinic-space-2);
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-control);
}

.retorno__linha {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1.5fr) auto;
  align-items: end;
  gap: var(--clinic-space-3);
}

.retorno__aviso {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  margin: 0;
  color: var(--clinic-attention-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.vazio {
  margin: 0;
  color: var(--clinic-faint);
}

@media (max-width: 860px) {
  .prescricao__linha,
  .prescricao__linha--numeros,
  .retorno__linha {
    grid-template-columns: 1fr;
  }
}
</style>
