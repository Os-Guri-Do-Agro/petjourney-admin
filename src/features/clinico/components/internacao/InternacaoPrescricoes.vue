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
    <section class="bloco">
      <header class="bloco__topo">
        <h3 class="bloco__titulo">{{ t('clinico.internacao.prescricao.ativasTitulo') }}</h3>
        <Button
          v-if="!encerrada"
          :label="t('clinico.internacao.prescricao.nova')"
          icon="ph ph-plus"
          size="small"
          severity="secondary"
          outlined
          @click="abrindo = true"
        />
      </header>

      <p v-if="ativas.length === 0" class="bloco__vazio">
        {{ t('clinico.internacao.prescricao.semAtivas') }}
      </p>

      <article v-for="prescricao in ativas" :key="prescricao.id" class="item">
        <div class="item__corpo">
          <p class="item__nome">
            <strong>{{ prescricao.descricao }}</strong>
            <span class="item__tag">{{ t(`clinico.internacao.itemKind.${prescricao.kind}`) }}</span>
          </p>

          <p class="item__linha">
            <span v-if="prescricao.doseTexto" class="clinic-value">{{ prescricao.doseTexto }}</span>
            <span v-if="prescricao.via">
              {{ t(`clinico.prontuario.conduta.via_.${prescricao.via}`) }}
            </span>
            <span>
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
            <span v-if="proximoHorario(prescricao)" class="item__proxima">
              {{
                t('clinico.internacao.prescricao.proxima', { hora: proximoHorario(prescricao) })
              }}
            </span>
          </p>

          <p class="item__rodape">
            {{
              t('clinico.internacao.prescricao.feitas', { total: feitas(prescricao) }, feitas(prescricao))
            }}
            ·
            {{
              t('clinico.internacao.prescricao.por', {
                nome: clinico.profissional(prescricao.prescritoPor)?.nome ?? '',
              })
            }}
          </p>

          <p v-if="prescricao.observacao" class="item__observacao">{{ prescricao.observacao }}</p>
        </div>

        <Button
          :label="t('clinico.internacao.prescricao.suspender')"
          severity="secondary"
          text
          size="small"
          :disabled="salvando"
          @click="suspendendo = prescricao"
        />
      </article>

      <!-- Confirmação em linha: pede o motivo onde o item está, sem tirar o contexto da tela. -->
      <div v-if="suspendendo" class="suspender">
        <p class="suspender__alvo">
          {{ t('clinico.internacao.prescricao.suspenderAlvo', { item: suspendendo.descricao }) }}
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
            :label="t('clinico.internacao.prescricao.cancelar')"
            severity="secondary"
            text
            size="small"
            @click="suspendendo = null"
          />
          <Button
            :label="t('clinico.internacao.prescricao.confirmarSuspensao')"
            severity="danger"
            size="small"
            :disabled="!motivo.trim() || salvando"
            @click="confirmarSuspensao"
          />
        </div>
      </div>
    </section>

<!--
      Prescrever é uma tarefa à parte, não um trecho a mais da lista.
      Como bloco solto abaixo dos itens em curso, o formulário empurrava a lista para cima, abria
      fora do campo de visão em telas cheias e deixava ambíguo se os campos descreviam um item já
      prescrito ou um novo. Em diálogo, a tarefa tem começo, fim e um lugar só.
    -->
    <Dialog
      v-model:visible="abrindo"
      modal
      class="clinic-dialog hc-tema"
      :style="{ width: 'min(42rem, 96vw)' }"
      :header="t('clinico.internacao.prescricao.novaTitulo')"
      dismissable-mask
    >
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
          :label="t('clinico.internacao.prescricao.cancelar')"
          severity="secondary"
          text
          @click="abrindo = false"
        />
        <Button
          :label="t('clinico.internacao.prescricao.criar')"
          icon="ph ph-check"
          :disabled="!podeCriar"
          :loading="salvando"
          @click="criar"
        />
      </template>
    </Dialog>

    <section v-if="suspensas.length > 0" class="bloco">
      <h3 class="bloco__titulo">{{ t('clinico.internacao.prescricao.suspensasTitulo') }}</h3>

      <article v-for="prescricao in suspensas" :key="prescricao.id" class="item item--suspensa">
        <div class="item__corpo">
          <p class="item__nome">
            <strong>{{ prescricao.descricao }}</strong>
          </p>
          <p class="item__rodape">
            {{
              t('clinico.internacao.prescricao.suspensaEm', {
                hora: formato.hora(prescricao.suspensaEm ?? ''),
                motivo: prescricao.motivoSuspensao,
              })
            }}
            ·
            {{ t('clinico.internacao.prescricao.feitas', { total: feitas(prescricao) }, feitas(prescricao)) }}
          </p>
        </div>
      </article>
    </section>
  </div>
</template>

<style scoped>
.prescricoes {
  display: grid;
  gap: var(--clinic-space-4);
}

.bloco {
  display: grid;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-4);
  border: 1px solid var(--clinic-line);
  border-radius: var(--clinic-radius-card);
  background: var(--clinic-surface);
}

.bloco__topo {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--clinic-space-2);
}

.bloco__titulo {
  margin: 0;
  font-size: var(--clinic-font-body);
  font-weight: 750;
}

.bloco__vazio {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.item {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-line-soft);
  border-radius: var(--clinic-radius-control);
  gap: var(--clinic-space-3);
  background: var(--clinic-surface-soft);
}

.item--suspensa {
  border-style: dashed;
  opacity: 0.75;
}

.item--suspensa .item__nome strong {
  text-decoration: line-through;
}

.item__corpo {
  display: grid;
  min-width: 0;
  gap: 0.15rem;
}

.item__nome {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  margin: 0;
  gap: var(--clinic-space-2);
}

.item__nome strong {
  overflow-wrap: anywhere;
  font-weight: 700;
}

.item__tag {
  padding: 0.05rem 0.4rem;
  border-radius: var(--clinic-radius-chip);
  background: var(--clinic-neutral-bg);
  color: var(--clinic-neutral-text);
  font-size: var(--clinic-font-label);
  font-weight: 650;
}

.item__linha {
  display: flex;
  flex-wrap: wrap;
  margin: 0;
  gap: var(--clinic-space-3);
  color: var(--clinic-muted);
  font-size: var(--clinic-font-label);
}

.item__proxima {
  color: var(--clinic-accent-strong);
  font-weight: 700;
}

.item__rodape,
.item__observacao {
  margin: 0;
  color: var(--clinic-faint);
  font-size: var(--clinic-font-label);
}

.suspender {
  display: grid;
  gap: var(--clinic-space-3);
  padding: var(--clinic-space-3);
  border: 1px solid var(--clinic-risk-line);
  border-radius: var(--clinic-radius-control);
  background: var(--clinic-risk-bg);
}

.suspender__alvo {
  margin: 0;
  color: var(--clinic-risk-text);
  font-size: var(--clinic-font-label);
  font-weight: 700;
}

.suspender__acoes {
  display: flex;
  justify-content: flex-end;
  gap: var(--clinic-space-2);
}

/*
 * Duas colunas de verdade, e não `auto-fit`.
 *
 * Com `minmax` automático a largura de cada campo mudava conforme o tipo escolhido: some o
 * campo de medicamento e os vizinhos se esticam. Duas colunas fixas mantêm a forma estável
 * enquanto o formulário troca de campos, e a descrição atravessa as duas por ser a linha que a
 * enfermagem lê no checklist.
 */
.formulario {
  display: grid;
  gap: var(--clinic-space-4) var(--clinic-space-3);
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

@media (width <= 640px) {
  .formulario {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
