<script setup lang="ts">
/**
 * Prescrição da internação: o que está em curso e o que entra agora.
 *
 * Cada item mostra a **frequência e o próximo horário**, porque prescrição de internação sem
 * horário não existe. "Dipirona 8/8 h" não diz nada ao plantão da noite; "8/8 h, próxima às 22h"
 * diz tudo — e é a mesma informação que o aprazamento já calculou, trazida para onde a decisão é
 * tomada.
 *
 * Suspender pede motivo e **não apaga o passado**. O que já foi dado continua na lista do dia,
 * riscado e com quem deu: quando um paciente piora, o que se procura no registro é exatamente o
 * que ele recebeu antes de piorar.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import ClinicField from '../base/ClinicField.vue'
import type {
  AdministracaoAgendada,
  ISODateTime,
  ItemDePrescricaoKind,
  PrescricaoDeInternacao,
  PrescriptionRoute,
} from '../../data/types'
import { useClinicFormat } from '../../composables/useClinicFormat'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  prescricoes: PrescricaoDeInternacao[]
  administracoes: AdministracaoAgendada[]
  agora: ISODateTime
  salvando: boolean
  prescritorId: string
  /**
   * A internação já terminou.
   *
   * Prescrever para um animal que foi para casa é uma ordem que ninguém vai executar — e o que
   * ela produz é uma linha de checklist que nasce órfã. A lista continua inteira e legível: o
   * que some é a porta de escrever. Registro fechado se lê, não se continua.
   */
  encerrada?: boolean
}>()

const emit = defineEmits<{
  prescrever: [
    entrada: {
      kind: ItemDePrescricaoKind
      medicamentoId: string | null
      descricao: string
      via: PrescriptionRoute | null
      doseTexto: string
      frequenciaHoras: number
      continuo: boolean
      primeiroHorario: ISODateTime
      prescritoPor: string
    },
  ]
  suspender: [prescricaoId: string, motivo: string]
}>()

const { t } = useI18n()
const formato = useClinicFormat()
const clinico = useClinicoStore()

const KINDS: ItemDePrescricaoKind[] = [
  'medicamento',
  'fluido',
  'monitoramento',
  'alimentacao',
  'procedimento',
]

const VIAS: PrescriptionRoute[] = [
  'oral',
  'subcutanea',
  'intramuscular',
  'intravenosa',
  'topica',
  'otologica',
]

/** O mesmo ícone por tipo que o checklist usa: o item se reconhece nas duas abas. */
const ICONE: Record<ItemDePrescricaoKind, string> = {
  medicamento: 'ph ph-pill',
  fluido: 'ph ph-drop',
  monitoramento: 'ph ph-heartbeat',
  alimentacao: 'ph ph-bowl-food',
  procedimento: 'ph ph-first-aid-kit',
}

/** Frequências de internação. Não é campo livre: 7 em 7 horas não existe em plantão nenhum. */
const FREQUENCIAS = [1, 2, 4, 6, 8, 12, 24]

const abrindo = ref(false)
const suspendendo = ref<PrescricaoDeInternacao | null>(null)
const motivo = ref('')

function rascunhoVazio() {
  return {
    kind: 'medicamento' as ItemDePrescricaoKind,
    medicamentoId: null as string | null,
    descricao: '',
    via: 'intravenosa' as PrescriptionRoute | null,
    doseTexto: '',
    frequenciaHoras: 8,
    emQuantasHoras: 1,
  }
}

const nova = ref(rascunhoVazio())

const ativas = computed(() => props.prescricoes.filter((item) => !item.suspensaEm))
const suspensas = computed(() => props.prescricoes.filter((item) => item.suspensaEm))

const opcoesDeKind = computed(() =>
  KINDS.map((valor) => ({ valor, rotulo: t(`clinico.internacao.itemKind.${valor}`) })),
)

const opcoesDeVia = computed(() =>
  VIAS.map((valor) => ({ valor, rotulo: t(`clinico.prontuario.conduta.via_.${valor}`) })),
)

const opcoesDeFrequencia = computed(() =>
  FREQUENCIAS.map((horas) => ({
    valor: horas,
    rotulo: t('clinico.internacao.prescricao.aCada', { horas }),
  })),
)

const opcoesDeMedicamento = computed(() =>
  clinico.medicamentos.map((medicamento) => ({
    valor: medicamento.id,
    rotulo: medicamento.nome,
  })),
)

function proximoHorario(prescricao: PrescricaoDeInternacao): string {
  const proxima = props.administracoes
    .filter(
      (item) =>
        item.prescricaoId === prescricao.id &&
        item.status === 'pendente' &&
        item.previstaPara >= props.agora,
    )
    .sort((a, b) => a.previstaPara.localeCompare(b.previstaPara))[0]

  return proxima ? formato.hora(proxima.previstaPara) : ''
}

function feitas(prescricao: PrescricaoDeInternacao): number {
  return props.administracoes.filter(
    (item) => item.prescricaoId === prescricao.id && item.status === 'feita',
  ).length
}

const podeCriar = computed(
  () => nova.value.descricao.trim().length > 0 && !props.salvando,
)

/**
 * O formulário nasce limpo a cada abertura.
 *
 * Enquanto ele era um bloco na página, fechar era o mesmo que sumir com ele e o rascunho não
 * incomodava ninguém. Como diálogo, cancelar e reabrir traria de volta a dose do item anterior —
 * e prescrição herdada de um rascunho abandonado é o tipo de erro que ninguém procura.
 */
watch(abrindo, (aberto) => {
  if (aberto) {
    nova.value = rascunhoVazio()
  }
})

function criar() {
  if (!podeCriar.value) {
    return
  }

  const data = clinicClock.dateOf(props.agora)
  const primeiroHorario = clinicClock.toIso(
    data,
    clinicClock.minutesFrom(props.agora, data) + nova.value.emQuantasHoras * 60,
  )

  emit('prescrever', {
    kind: nova.value.kind,
    medicamentoId: nova.value.kind === 'medicamento' ? nova.value.medicamentoId : null,
    descricao: nova.value.descricao,
    via: nova.value.kind === 'medicamento' || nova.value.kind === 'fluido' ? nova.value.via : null,
    doseTexto: nova.value.doseTexto,
    frequenciaHoras: nova.value.frequenciaHoras,
    continuo: nova.value.kind === 'fluido',
    primeiroHorario,
    prescritoPor: props.prescritorId,
  })

  abrindo.value = false
}

function confirmarSuspensao() {
  const alvo = suspendendo.value

  if (!alvo || !motivo.value.trim()) {
    return
  }

  emit('suspender', alvo.id, motivo.value)
  suspendendo.value = null
  motivo.value = ''
}

/** Preenche a descrição ao escolher o medicamento — ninguém digita o nome que já está no catálogo. */
function aoEscolherMedicamento(medicamentoId: string) {
  nova.value.medicamentoId = medicamentoId
  nova.value.descricao = clinico.medicamento(medicamentoId)?.nome ?? nova.value.descricao
}
</script>

<template>
  <div class="prescricoes">
    <section class="ui-folha ui-cartao" aria-labelledby="prescricao-ativas-titulo">
      <header class="ui-cartao__cabeca">
        <span class="ui-ladrilho" aria-hidden="true"><i class="ph ph-prescription" /></span>
        <span class="ui-cartao__titulos">
          <h2 id="prescricao-ativas-titulo" class="ui-cartao__titulo">
            {{ t('clinico.internacao.prescricao.ativasTitulo') }}
            <span v-if="ativas.length" class="ui-contagem">{{ ativas.length }}</span>
          </h2>
        </span>
        <span v-if="!encerrada" class="ui-cartao__acoes">
          <Button
            type="button"
            :label="t('clinico.internacao.prescricao.nova')"
            icon="ph ph-plus"
            size="small"
            severity="secondary"
            outlined
            @click="abrindo = true"
          />
        </span>
      </header>

      <p v-if="ativas.length === 0" class="ui-vazio">
        {{ t('clinico.internacao.prescricao.semAtivas') }}
      </p>

      <ul v-else class="ui-lista">
        <li v-for="prescricao in ativas" :key="prescricao.id" class="item">
          <div class="item__linha">
            <span class="item__icone" aria-hidden="true"><i :class="ICONE[prescricao.kind]" /></span>

            <div class="item__corpo">
              <p class="item__nome">
                <strong>{{ prescricao.descricao }}</strong>
                <span class="ui-selo ui-selo--contorno item__tipo">
                  {{ t(`clinico.internacao.itemKind.${prescricao.kind}`) }}
                </span>
              </p>

              <p class="item__meta">
                <span v-if="prescricao.doseTexto" class="item__dose ui-num">
                  {{ prescricao.doseTexto }}
                </span>
                <span v-if="prescricao.via">
                  {{ t(`clinico.prontuario.conduta.via_.${prescricao.via}`) }}
                </span>
                <span class="ui-num">
                  {{
                    prescricao.continuo
                      ? t('clinico.internacao.prescricao.continuo', {
                          horas: prescricao.frequenciaHoras,
                        })
                      : t('clinico.internacao.prescricao.aCada', {
                          horas: prescricao.frequenciaHoras,
                        })
                  }}
                </span>
              </p>

              <p class="item__rodape">
                <span class="ui-num">
                  {{
                    t(
                      'clinico.internacao.prescricao.feitas',
                      { total: feitas(prescricao) },
                      feitas(prescricao),
                    )
                  }}
                </span>
                <span>
                  {{
                    t('clinico.internacao.prescricao.por', {
                      nome: clinico.profissional(prescricao.prescritoPor)?.nome ?? '',
                    })
                  }}
                </span>
              </p>

              <p v-if="prescricao.observacao" class="item__observacao">
                {{ prescricao.observacao }}
              </p>
            </div>

            <div class="item__fim">
              <span v-if="proximoHorario(prescricao)" class="item__proxima ui-num">
                <i class="ph ph-clock" aria-hidden="true" />
                {{
                  t('clinico.internacao.prescricao.proxima', { hora: proximoHorario(prescricao) })
                }}
              </span>
              <Button
                type="button"
                :label="t('clinico.internacao.prescricao.suspender')"
                icon="ph ph-prohibit"
                severity="secondary"
                text
                size="small"
                :disabled="salvando"
                @click="suspendendo = prescricao"
              />
            </div>
          </div>

          <!-- Confirmação em linha: pede o motivo onde o item está, sem tirar o contexto da tela. -->
          <div v-if="suspendendo?.id === prescricao.id" class="suspender">
            <p class="suspender__alvo">
              {{
                t('clinico.internacao.prescricao.suspenderAlvo', { item: suspendendo.descricao })
              }}
            </p>

            <ClinicField :rotulo="t('clinico.internacao.prescricao.motivo')" obrigatorio>
              <template #default="{ id }">
                <InputText
                  :id="id"
                  v-model="motivo"
                  :placeholder="t('clinico.internacao.prescricao.motivoExemplo')"
                  fluid
                />
              </template>
            </ClinicField>

            <div class="suspender__acoes">
              <Button
                type="button"
                :label="t('clinico.internacao.prescricao.cancelar')"
                severity="secondary"
                text
                size="small"
                @click="suspendendo = null"
              />
              <Button
                type="button"
                :label="t('clinico.internacao.prescricao.confirmarSuspensao')"
                icon="ph ph-prohibit"
                severity="danger"
                size="small"
                :disabled="!motivo.trim() || salvando"
                @click="confirmarSuspensao"
              />
            </div>
          </div>
        </li>
      </ul>
    </section>

    <!--
      Prescrever é uma tarefa à parte, não um trecho a mais da lista: em diálogo, a tarefa tem
      começo, fim e um lugar só, e não fica ambíguo se os campos descrevem um item já prescrito.
    -->
    <Dialog
      v-model:visible="abrindo"
      modal
      class="clinic-dialog hc-tema"
      :style="{ width: 'min(42rem, 96vw)' }"
      dismissable-mask
    >
      <template #header>
        <h2 class="clinic-dialog__titulo">
          <span class="clinic-dialog__marca" aria-hidden="true"
            ><i class="ph ph-prescription"
          /></span>
          {{ t('clinico.internacao.prescricao.novaTitulo') }}
        </h2>
      </template>

      <div class="formulario clinic-scope">
        <ClinicField :rotulo="t('clinico.internacao.prescricao.tipo')">
          <template #default="{ id }">
            <Select
              :id="id"
              v-model="nova.kind"
              :options="opcoesDeKind"
              option-label="rotulo"
              option-value="valor"
              fluid
              :pt="{ overlay: { class: 'clinic-overlay' } }"
            />
          </template>
        </ClinicField>

        <ClinicField
          v-if="nova.kind === 'medicamento'"
          :rotulo="t('clinico.internacao.prescricao.medicamento')"
        >
          <template #default="{ id }">
            <Select
              :id="id"
              :model-value="nova.medicamentoId"
              :options="opcoesDeMedicamento"
              option-label="rotulo"
              option-value="valor"
              :placeholder="t('clinico.internacao.prescricao.escolhaMedicamento')"
              :filter-placeholder="t('clinico.internacao.prescricao.buscarMedicamento')"
              filter
              fluid
              :pt="{ overlay: { class: 'clinic-overlay' } }"
              @update:model-value="aoEscolherMedicamento"
            />
          </template>
        </ClinicField>

        <ClinicField :rotulo="t('clinico.internacao.prescricao.descricao')" obrigatorio largo>
          <template #default="{ id }">
            <InputText
              :id="id"
              v-model="nova.descricao"
              :placeholder="t('clinico.internacao.prescricao.descricaoExemplo')"
              fluid
            />
          </template>
        </ClinicField>

        <ClinicField
          :rotulo="t('clinico.internacao.prescricao.dose')"
          :dica="t('clinico.internacao.prescricao.doseDica')"
        >
          <template #default="{ id }">
            <InputText
              :id="id"
              v-model="nova.doseTexto"
              :placeholder="t('clinico.internacao.prescricao.doseExemplo')"
              fluid
            />
          </template>
        </ClinicField>

        <ClinicField
          v-if="nova.kind === 'medicamento' || nova.kind === 'fluido'"
          :rotulo="t('clinico.internacao.prescricao.via')"
        >
          <template #default="{ id }">
            <Select
              :id="id"
              v-model="nova.via"
              :options="opcoesDeVia"
              option-label="rotulo"
              option-value="valor"
              fluid
              :pt="{ overlay: { class: 'clinic-overlay' } }"
            />
          </template>
        </ClinicField>

        <ClinicField :rotulo="t('clinico.internacao.prescricao.frequencia')">
          <template #default="{ id }">
            <Select
              :id="id"
              v-model="nova.frequenciaHoras"
              :options="opcoesDeFrequencia"
              option-label="rotulo"
              option-value="valor"
              fluid
              :pt="{ overlay: { class: 'clinic-overlay' } }"
            />
          </template>
        </ClinicField>

        <ClinicField
          :rotulo="t('clinico.internacao.prescricao.primeira')"
          :dica="t('clinico.internacao.prescricao.primeiraDica')"
        >
          <template #default="{ id }">
            <InputNumber :id="id" v-model="nova.emQuantasHoras" :min="0" :max="12" fluid />
          </template>
        </ClinicField>
      </div>

      <template #footer>
        <Button
          type="button"
          :label="t('clinico.internacao.prescricao.cancelar')"
          severity="secondary"
          text
          @click="abrindo = false"
        />
        <Button
          type="button"
          :label="t('clinico.internacao.prescricao.criar')"
          icon="ph ph-check"
          :disabled="!podeCriar"
          :loading="salvando"
          @click="criar"
        />
      </template>
    </Dialog>

    <section
      v-if="suspensas.length > 0"
      class="ui-folha ui-cartao"
      aria-labelledby="prescricao-suspensas-titulo"
    >
      <header class="ui-cartao__cabeca">
        <span class="ui-ladrilho ui-ladrilho--neutro" aria-hidden="true">
          <i class="ph ph-prohibit" />
        </span>
        <span class="ui-cartao__titulos">
          <h2 id="prescricao-suspensas-titulo" class="ui-cartao__titulo">
            {{ t('clinico.internacao.prescricao.suspensasTitulo') }}
            <span class="ui-contagem">{{ suspensas.length }}</span>
          </h2>
        </span>
      </header>

      <ul class="ui-lista">
        <li v-for="prescricao in suspensas" :key="prescricao.id" class="item item--suspensa">
          <div class="item__linha">
            <span class="item__icone" aria-hidden="true"><i :class="ICONE[prescricao.kind]" /></span>
            <div class="item__corpo">
              <p class="item__nome">
                <strong>{{ prescricao.descricao }}</strong>
              </p>
              <p class="item__rodape">
                <span>
                  {{
                    t('clinico.internacao.prescricao.suspensaEm', {
                      hora: formato.hora(prescricao.suspensaEm ?? ''),
                      motivo: prescricao.motivoSuspensao,
                    })
                  }}
                </span>
                <span class="ui-num">
                  {{
                    t(
                      'clinico.internacao.prescricao.feitas',
                      { total: feitas(prescricao) },
                      feitas(prescricao),
                    )
                  }}
                </span>
              </p>
            </div>
          </div>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.prescricoes {
  display: grid;
  gap: 24px;
}

.item {
  display: grid;
}

.item__linha {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  padding: 16px 20px;
}

.item__icone {
  display: grid;
  width: 40px;
  height: 40px;
  flex: none;
  place-items: center;
  border-radius: 12px;
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
  font-size: 19px;
}

.item__corpo {
  display: grid;
  min-width: 0;
  flex: 1;
  gap: 4px;
}

.item__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px 10px;
  margin: 0;
}

.item__nome strong {
  overflow-wrap: anywhere;
  color: var(--tinta);
  font-size: 15px;
  font-weight: 600;
}

.item__tipo.ui-selo {
  height: 22px;
  font-size: 12px;
}

.item__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 14px;
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
}

.item__dose {
  color: var(--tinta);
  font-weight: 550;
}

.item__rodape {
  display: flex;
  flex-wrap: wrap;
  gap: 2px 14px;
  margin: 0;
  color: var(--tinta-3);
  font-size: 13px;
}

.item__observacao {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13px;
}

.item__fim {
  display: flex;
  flex: none;
  flex-wrap: wrap;
  align-items: center;
  justify-content: flex-end;
  gap: 6px 10px;
}

/* A próxima dose, numa pílula na cor do lugar: é o horário que o plantão procura na linha. */
.item__proxima {
  display: inline-flex;
  height: 30px;
  align-items: center;
  gap: 6px;
  padding: 0 11px;
  border-radius: 999px;
  background: var(--pj-lugar-fundo);
  color: var(--pj-lugar-tinta);
  font-size: 13.5px;
  font-weight: 650;
  white-space: nowrap;
}

.item--suspensa .item__nome strong {
  color: var(--tinta-2);
  text-decoration: line-through;
}

.item--suspensa .item__icone {
  background: var(--superficie-2);
  color: var(--tinta-3);
}

/* ----------------------------------------------------------------- suspender */

.suspender {
  display: grid;
  gap: 12px;
  margin: 0 20px 16px 74px;
  padding: 14px 16px;
  border: 1px solid color-mix(in oklab, var(--risco) 25%, transparent);
  border-radius: var(--raio-cartao-pequeno);
  background: var(--risco-fundo);
}

.suspender__alvo {
  margin: 0;
  color: var(--risco-tinta);
  font-size: 14px;
  font-weight: 600;
}

.suspender__acoes {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

/*
 * Duas colunas de verdade, e não `auto-fit`: some o campo de medicamento e os vizinhos não se
 * esticam. A descrição atravessa as duas por ser a linha que a enfermagem lê no checklist.
 */
.formulario {
  display: grid;
  gap: 16px 12px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (width <= 640px) {
  .formulario {
    grid-template-columns: minmax(0, 1fr);
  }

  .item__linha {
    flex-wrap: wrap;
  }

  .item__fim {
    width: 100%;
    justify-content: flex-start;
  }

  .suspender {
    margin-inline: 12px;
  }
}
</style>
