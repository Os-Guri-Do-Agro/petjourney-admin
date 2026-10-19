<script setup lang="ts">
/**
 * Registrar um procedimento realizado ou uma medicação aplicada.
 *
 * Grava só o que não tem registro próprio em outro lugar. Vacina tem a carteira, que guarda lote
 * e validade porque a farmacovigilância os exige; dose de internação tem o checklist, que guarda
 * o plantão em que caiu a execução. As duas entram na história do paciente derivadas — aceitar
 * gravá-las aqui criaria a segunda cópia que diverge no primeiro acerto feito de um lado só.
 *
 * Duas decisões que este formulário toma:
 *
 * - **A hora é digitada, não carimbada.** O ato quase sempre é lançado depois de acontecer: no
 *   fim da consulta, ou semanas depois, quando o responsável conta uma castração feita em outro
 *   serviço. Carimbar o instante do lançamento gravaria quando alguém digitou — a única hora que
 *   ninguém vai querer saber. Por isso ela nasce preenchida com agora e é editável, e o futuro é
 *   recusado: ato que ainda não aconteceu não é ato.
 * - **Quem executou pode ficar vazio, e isso tem nome.** Sem profissional, o ato nasce
 *   `avulso` — relatado, não presenciado. É a diferença entre "a clínica aplicou" e "alguém
 *   disse que aplicaram", e ela precisa sobreviver até a terceira leitura do dia.
 *
 * Redesenho (19/10/2026): o alto do diálogo diz o que se faz e em quem (ícone, título e o nome do
 * paciente), e os campos "Via" e "Quem executou" mostram o valor vazio por extenso ("Não se
 * aplica", "Ninguém da clínica") em vez de uma caixa em branco.
 */
import Button from 'primevue/button'
import Dialog from 'primevue/dialog'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Textarea from 'primevue/textarea'
import { computed, ref, useId, watch } from 'vue'
import { useI18n } from 'vue-i18n'

import { INTL_LOCALE, type Locale } from '@/i18n/locales'

import ClinicDateField from '../base/ClinicDateField.vue'
import ClinicField from '../base/ClinicField.vue'
import ClinicToggleGroup from '../base/ClinicToggleGroup.vue'
import type { AtoClinicoKind, ISODateTime, PrescriptionRoute } from '../../data/types'
import { clinicClock, useClinicoStore } from '../../stores/clinico'

const props = defineProps<{
  visivel: boolean
  petNome: string
}>()

const emit = defineEmits<{
  'update:visivel': [valor: boolean]
  registrar: [
    valor: {
      kind: AtoClinicoKind
      medicamentoId: string | null
      descricao: string
      via: PrescriptionRoute | null
      doseTexto: string
      realizadoEm: ISODateTime
      professionalId: string
      observacao: string
    },
  ]
}>()

const VIAS: PrescriptionRoute[] = [
  'oral',
  'subcutanea',
  'intramuscular',
  'intravenosa',
  'topica',
  'otologica',
]

const { t, locale } = useI18n()
const clinico = useClinicoStore()
/** O título do diálogo nomeia a caixa: com o cabeçalho em slot, o `Dialog` precisa do id. */
const idTitulo = useId()

const kind = ref<AtoClinicoKind>('medicamento')
const medicamentoId = ref<string | null>(null)
const descricao = ref('')
const via = ref<PrescriptionRoute | null>(null)
const doseTexto = ref('')
const quando = ref('')
const professionalId = ref<string | null>(null)
const observacao = ref('')
const tentouSalvar = ref(false)

const opcoesKind = computed(() => [
  { valor: 'medicamento' as AtoClinicoKind, rotulo: t('clinico.paciente.atos.kind.medicamento') },
  {
    valor: 'procedimento' as AtoClinicoKind,
    rotulo: t('clinico.paciente.atos.kind.procedimento'),
  },
])

const opcoesMedicamento = computed(() =>
  clinico.medicamentos
    .map((item) => ({
      valor: item.id as string | null,
      rotulo: item.nome,
      detalhe: item.principioAtivo,
    }))
    .sort((a, b) => a.rotulo.localeCompare(b.rotulo, INTL_LOCALE[locale.value as Locale])),
)

const opcoesVia = computed(() => [
  { valor: null as PrescriptionRoute | null, rotulo: t('clinico.paciente.atos.novo.semVia') },
  ...VIAS.map((valor) => ({
    valor: valor as PrescriptionRoute | null,
    rotulo: t(`clinico.prontuario.conduta.via_.${valor}`),
  })),
])

const opcoesProfissional = computed(() => [
  { valor: null as string | null, rotulo: t('clinico.paciente.atos.novo.quemNinguem') },
  ...clinico.profissionais.map((item) => ({
    valor: item.id as string | null,
    rotulo: item.nome,
  })),
])

/**
 * `datetime-local` fala `YYYY-MM-DDTHH:mm`; o módulo fala ISO com o fuso da clínica explícito.
 *
 * A conversão passa pelo relógio da parede em vez de `new Date()` porque todo instante deste
 * módulo carrega o offset da clínica — deixar o navegador decidir o fuso gravaria a hora do
 * computador de quem digitou, que numa rede com uma máquina fora do horário vira registro errado.
 */
const realizadoEm = computed<ISODateTime | null>(() => {
  if (!quando.value) {
    return null
  }

  const [data, hora] = quando.value.split('T')

  if (!data || !hora) {
    return null
  }

  const [h, m] = hora.split(':').map(Number)

  return clinicClock.toIso(data, (h ?? 0) * 60 + (m ?? 0))
})

const agoraLocal = computed(() => {
  const agora = clinicClock.nowIso()

  return agora.slice(0, 16)
})

const erroDescricao = computed(() =>
  tentouSalvar.value && !descricao.value.trim()
    ? t('clinico.paciente.atos.novo.erros.descricao')
    : '',
)

const erroQuando = computed(() => {
  if (!tentouSalvar.value) {
    return ''
  }

  if (!realizadoEm.value) {
    return t('clinico.paciente.atos.novo.erros.quando')
  }

  return realizadoEm.value > clinicClock.nowIso()
    ? t('clinico.paciente.atos.novo.erros.futuro')
    : ''
})

const completo = computed(
  () => Boolean(descricao.value.trim()) && Boolean(realizadoEm.value) && !erroQuando.value,
)

/** Escolher do bulário preenche a descrição: ninguém deve redigitar o que acabou de escolher. */
watch(medicamentoId, (valor) => {
  if (!valor) {
    return
  }

  const medicamento = clinico.medicamento(valor)

  descricao.value = medicamento?.nome ?? descricao.value

  if (!via.value) {
    via.value = medicamento?.viasPermitidas[0] ?? null
  }
})

/** Procedimento não tem catálogo: trocar de tipo larga o medicamento em vez de escondê-lo. */
watch(kind, (valor) => {
  if (valor === 'procedimento') {
    medicamentoId.value = null
    doseTexto.value = ''
  }
})

/* Reabrir limpo. Ato anterior sobrevivente é como um curativo vira uma castração. */
watch(
  () => props.visivel,
  (visivel) => {
    if (!visivel) {
      return
    }

    kind.value = 'medicamento'
    medicamentoId.value = null
    descricao.value = ''
    via.value = null
    doseTexto.value = ''
    quando.value = agoraLocal.value
    professionalId.value = null
    observacao.value = ''
    tentouSalvar.value = false
  },
  { immediate: true },
)

function salvar() {
  tentouSalvar.value = true

  if (!completo.value) {
    return
  }

  emit('registrar', {
    kind: kind.value,
    medicamentoId: medicamentoId.value,
    descricao: descricao.value,
    via: via.value,
    doseTexto: doseTexto.value,
    realizadoEm: realizadoEm.value as ISODateTime,
    professionalId: professionalId.value ?? '',
    observacao: observacao.value,
  })
}
</script>

<template>
  <Dialog
    :visible="visivel"
    modal
    class="clinic-dialog hc-tema"
    :style="{ width: 'min(38rem, 94vw)' }"
    :dismissable-mask="true"
    :aria-labelledby="idTitulo"
    @update:visible="emit('update:visivel', $event)"
  >
    <!-- O "onde estou" do diálogo: o que se está fazendo, e em quem. -->
    <template #header>
      <div class="topo">
        <span class="topo__icone" aria-hidden="true"><i class="ph ph-first-aid-kit" /></span>
        <span class="topo__texto">
          <h2 :id="idTitulo" class="topo__titulo">{{ t('clinico.paciente.atos.novo.titulo') }}</h2>
          <span class="topo__sub">{{ petNome }}</span>
        </span>
      </div>
    </template>

    <form class="ato clinic-scope" @submit.prevent="salvar">
      <p class="ato__quem">{{ t('clinico.paciente.atos.novo.ajuda', { nome: petNome }) }}</p>

      <ClinicField :rotulo="t('clinico.paciente.atos.novo.tipo')">
        <ClinicToggleGroup
          v-model="kind"
          :opcoes="opcoesKind"
          :rotulo="t('clinico.paciente.atos.novo.tipo')"
        />
      </ClinicField>

      <ClinicField
        v-if="kind === 'medicamento'"
        :rotulo="t('clinico.paciente.atos.novo.medicamento')"
        :dica="t('clinico.paciente.atos.novo.medicamentoDica')"
      >
        <template #default="{ id, descrito }">
          <Select
            :input-id="id"
            v-model="medicamentoId"
            filter
            fluid
            show-clear
            option-label="rotulo"
            option-value="valor"
            :options="opcoesMedicamento"
            :placeholder="t('clinico.paciente.atos.novo.medicamentoVazio')"
            :aria-describedby="descrito"
            :pt="{ overlay: { class: 'clinic-overlay' } }"
          >
            <template #option="{ option }">
              <span class="opcao">
                <strong>{{ option.rotulo }}</strong>
                <small v-if="option.detalhe">{{ option.detalhe }}</small>
              </span>
            </template>
          </Select>
        </template>
      </ClinicField>

      <ClinicField
        :rotulo="t('clinico.paciente.atos.novo.descricao')"
        obrigatorio
        :dica="t('clinico.paciente.atos.novo.descricaoDica')"
        :erro="erroDescricao"
      >
        <template #default="{ id, descrito }">
          <InputText :id="id" v-model="descricao" fluid :aria-describedby="descrito" />
        </template>
      </ClinicField>

      <div v-if="kind === 'medicamento'" class="ato__linha">
        <ClinicField :rotulo="t('clinico.paciente.atos.novo.via')">
          <template #default="{ id }">
            <Select
              :input-id="id"
              v-model="via"
              fluid
              option-label="rotulo"
              option-value="valor"
              :options="opcoesVia"
              :placeholder="t('clinico.paciente.atos.novo.semVia')"
              :pt="{ overlay: { class: 'clinic-overlay' } }"
            />
          </template>
        </ClinicField>

        <ClinicField
          :rotulo="t('clinico.paciente.atos.novo.dose')"
          :dica="t('clinico.paciente.atos.novo.doseDica')"
        >
          <template #default="{ id, descrito }">
            <InputText :id="id" v-model="doseTexto" fluid :aria-describedby="descrito" />
          </template>
        </ClinicField>
      </div>

      <div class="ato__linha">
        <ClinicField
          :rotulo="t('clinico.paciente.atos.novo.quando')"
          obrigatorio
          :dica="t('clinico.paciente.atos.novo.quandoDica')"
          :erro="erroQuando"
        >
          <template #default="{ id, descrito }">
            <ClinicDateField
              v-model="quando"
              :input-id="id"
              com-hora
              :max="agoraLocal"
              :aria-describedby="descrito"
            />
          </template>
        </ClinicField>

        <ClinicField
          :rotulo="t('clinico.paciente.atos.novo.quem')"
          :dica="t('clinico.paciente.atos.novo.quemDica')"
        >
          <template #default="{ id, descrito }">
            <Select
              :input-id="id"
              v-model="professionalId"
              fluid
              option-label="rotulo"
              option-value="valor"
              :options="opcoesProfissional"
              :placeholder="t('clinico.paciente.atos.novo.quemNinguem')"
              :aria-describedby="descrito"
              :pt="{ overlay: { class: 'clinic-overlay' } }"
            />
          </template>
        </ClinicField>
      </div>

      <ClinicField :rotulo="t('clinico.paciente.atos.novo.observacao')">
        <template #default="{ id }">
          <Textarea :id="id" v-model="observacao" fluid rows="2" auto-resize />
        </template>
      </ClinicField>
    </form>

    <template #footer>
      <Button
        severity="secondary"
        text
        :label="t('clinico.comum.cancelar')"
        @click="emit('update:visivel', false)"
      />
      <Button icon="ph ph-check" :label="t('clinico.paciente.atos.novo.salvar')" @click="salvar" />
    </template>
  </Dialog>
</template>

<style scoped>
.topo {
  display: flex;
  min-width: 0;
  align-items: center;
  gap: 14px;
}

.topo__icone {
  display: grid;
  width: 40px;
  height: 40px;
  flex: none;
  place-items: center;
  border-radius: 12px;
  background: var(--clinica-fundo);
  color: var(--clinica-tinta);
  font-size: 20px;
}

.topo__texto {
  display: grid;
  min-width: 0;
  gap: 2px;
}

.topo__titulo {
  margin: 0;
  color: var(--tinta);
  font-family: var(--font-texto);
  font-size: 18px;
  font-weight: 600;
  letter-spacing: -0.01em;
  line-height: 1.3;
}

.topo__sub {
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.4;
}

.ato {
  display: grid;
  gap: 16px;
}

.ato__quem {
  margin: 0;
  color: var(--tinta-2);
  font-size: 13.5px;
  line-height: 1.5;
}

.ato__linha {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
}

.opcao {
  display: grid;
  gap: 1px;
}

.opcao small {
  color: var(--tinta-2);
  font-size: 12.5px;
}

@media (max-width: 620px) {
  .ato__linha {
    grid-template-columns: minmax(0, 1fr);
  }
}
</style>
